-- =====================================================================
-- Jurassic — Étape 3 bis : ce que l'autre voit d'un agenda importé
--   details : tout (titre, lieu, notes)
--   busy    : seulement les créneaux, affichés « Occupé »
--   hidden  : rien
-- Les détails passent dans une table à part : la base ne les envoie
-- jamais à l'autre si l'agenda n'est pas en « details ».
-- À exécuter dans Supabase > SQL Editor
-- =====================================================================

-- ---------- Détails séparés des créneaux ------------------------------

create table public.external_event_details (
  event_id uuid primary key references public.external_events(id) on delete cascade,
  title    text not null,
  location text,
  notes    text
);
insert into public.external_event_details (event_id, title, location, notes)
  select id, title, location, notes from public.external_events;

-- ---------- shared (oui/non) → visibility (3 niveaux) -----------------

drop trigger external_calendars_propagate on public.external_calendars;
drop policy external_events_select on public.external_events;

alter table public.external_calendars
  add column visibility text not null default 'busy' check (visibility in ('details', 'busy', 'hidden'));
update public.external_calendars set visibility = case when shared then 'details' else 'hidden' end;
alter table public.external_calendars drop column shared;

alter table public.external_events
  add column visibility text not null default 'busy' check (visibility in ('details', 'busy', 'hidden'));
update public.external_events set visibility = case when shared then 'details' else 'hidden' end;
alter table public.external_events alter column visibility drop default;
alter table public.external_events drop column shared, drop column title, drop column location, drop column notes;

-- ---------- Sécurité --------------------------------------------------

-- Créneaux : visibles par l'autre sauf agenda masqué
create policy external_events_select on public.external_events for select to authenticated
  using (public.is_space_member(space_id) and (user_id = auth.uid() or visibility <> 'hidden'));

-- Détails : son propriétaire, ou l'autre si l'agenda est en « details »
alter table public.external_event_details enable row level security;
create policy external_event_details_select on public.external_event_details for select to authenticated
  using (exists (
    select 1 from public.external_events e
    where e.id = event_id
      and (e.user_id = auth.uid() or (e.visibility = 'details' and public.is_space_member(e.space_id)))
  ));

-- ---------- Écriture par sync-calendars -------------------------------

create or replace function public.replace_external_events(p_calendar uuid, p_hash text, p_events jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  c external_calendars;
begin
  select * into c from external_calendars where id = p_calendar;
  if c.id is null then return; end if;

  delete from external_events where calendar_id = c.id;

  with src as (
    select gen_random_uuid() as id, e.*
    from jsonb_to_recordset(p_events) as e(
      uid text, title text, location text, notes text, start_at timestamptz, end_at timestamptz, all_day boolean
    )
  ), ins as (
    insert into external_events (id, calendar_id, space_id, user_id, calendar_name, visibility, uid, start_at, end_at, all_day)
    select id, c.id, c.space_id, c.user_id, c.name, c.visibility, uid, start_at, end_at, all_day from src
    returning id
  )
  insert into external_event_details (event_id, title, location, notes)
  select s.id, s.title, s.location, s.notes from ins join src s using (id);

  update external_calendars
    set content_hash = p_hash, last_synced_at = now(), last_error = null
    where id = c.id;
end;
$$;
revoke execute on function public.replace_external_events(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_external_events(uuid, text, jsonb) to service_role;

-- Nom ou visibilité modifiés : on répercute sur les créneaux déjà importés
create or replace function public.propagate_external_calendar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update external_events set visibility = new.visibility, calendar_name = new.name where calendar_id = new.id;
  return new;
end;
$$;
create trigger external_calendars_propagate after update of visibility, name on public.external_calendars
  for each row execute function public.propagate_external_calendar();
