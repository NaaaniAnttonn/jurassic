-- =====================================================================
-- Jurassic — Étape 3 : synchro Google Agenda / iCloud (lecture seule)
-- À exécuter dans Supabase > SQL Editor
--   • Export : chaque personne a un lien d'abonnement iCal secret
--   • Import : agendas externes (adresse iCal) recopiés par sync-calendars
-- =====================================================================

-- ---------- Export : lien d'abonnement --------------------------------

create table public.calendar_feeds (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;
-- Aucune règle : lu par le serveur, ou via feed_token() ci-dessous

-- Renvoie le jeton de la personne connectée (le crée au besoin, ou le renouvelle)
create or replace function public.feed_token(p_regenerate boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if not p_regenerate then
    select token into v_token from calendar_feeds where user_id = auth.uid();
    if v_token is not null then return v_token; end if;
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into calendar_feeds (user_id, token) values (auth.uid(), v_token)
    on conflict (user_id) do update set token = excluded.token, created_at = now();
  return v_token;
end;
$$;
revoke execute on function public.feed_token(boolean) from public, anon;
grant execute on function public.feed_token(boolean) to authenticated;

-- ---------- Import : agendas externes ---------------------------------

create table public.external_calendars (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references public.spaces(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 60),
  url            text not null check (url ~* '^(https?|webcal)://'),
  shared         boolean not null default true, -- visible par l'autre
  content_hash   text,                          -- évite de tout réécrire si rien n'a changé
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now()
);
create index external_calendars_user_idx on public.external_calendars(user_id);

-- L'adresse iCal est secrète : seul son propriétaire voit la ligne
alter table public.external_calendars enable row level security;
create policy external_calendars_own on public.external_calendars for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_space_member(space_id));

-- Occurrences importées (répétitions déjà dépliées par le serveur)
create table public.external_events (
  id            uuid primary key default gen_random_uuid(),
  calendar_id   uuid not null references public.external_calendars(id) on delete cascade,
  space_id      uuid not null references public.spaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  calendar_name text not null,
  shared        boolean not null,
  uid           text not null,
  title         text not null,
  location      text,
  notes         text,
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  all_day       boolean not null default false
);
create index external_events_calendar_idx on public.external_events(calendar_id);
create index external_events_space_start_idx on public.external_events(space_id, start_at);

-- Lecture seule pour les membres ; écriture réservée au serveur
alter table public.external_events enable row level security;
create policy external_events_select on public.external_events for select to authenticated
  using (public.is_space_member(space_id) and (shared or user_id = auth.uid()));

-- Remplace d'un coup les occurrences d'un agenda (appelée par sync-calendars)
create or replace function public.replace_external_events(p_calendar uuid, p_hash text, p_events jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  c external_calendars;
begin
  select * into c from external_calendars where id = p_calendar;
  if c.id is null then return; end if;

  delete from external_events where calendar_id = c.id;
  insert into external_events (calendar_id, space_id, user_id, calendar_name, shared, uid, title, location, notes, start_at, end_at, all_day)
  select c.id, c.space_id, c.user_id, c.name, c.shared, e.uid, e.title, e.location, e.notes, e.start_at, e.end_at, e.all_day
  from jsonb_to_recordset(p_events) as e(
    uid text, title text, location text, notes text, start_at timestamptz, end_at timestamptz, all_day boolean
  );

  update external_calendars
    set content_hash = p_hash, last_synced_at = now(), last_error = null
    where id = c.id;
end;
$$;
revoke execute on function public.replace_external_events(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_external_events(uuid, text, jsonb) to service_role;

-- Nom ou partage modifié : on répercute sur les occurrences déjà importées
create or replace function public.propagate_external_calendar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update external_events set shared = new.shared, calendar_name = new.name where calendar_id = new.id;
  return new;
end;
$$;
create trigger external_calendars_propagate after update of shared, name on public.external_calendars
  for each row execute function public.propagate_external_calendar();

-- Temps réel : les occurrences apparaissent chez l'autre après chaque synchro
alter publication supabase_realtime add table public.external_events;
