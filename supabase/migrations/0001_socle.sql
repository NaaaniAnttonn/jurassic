-- =====================================================================
-- Jurassic — Étape 1 : socle (profils, espace couple, notifications)
-- À exécuter dans Supabase > SQL Editor (ou `supabase db push`)
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  color        text not null default '#2E7D5B',
  created_at   timestamptz not null default now()
);

create table public.spaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Notre espace',
  invite_code text not null unique,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.space_members (
  space_id  uuid not null references public.spaces(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
-- Un compte = un seul espace (simplifie toute l'app)
create unique index space_members_one_space_per_user on public.space_members(user_id);

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- ---------- Fonctions utilitaires (utilisées par les règles RLS) -------

create or replace function public.is_space_member(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from space_members where space_id = p_space and user_id = auth.uid()
  );
$$;

create or replace function public.shares_space_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from space_members a
    join space_members b on a.space_id = b.space_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

create or replace function public.gen_invite_code()
returns text language sql volatile as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), ''
  ) from generate_series(1, 6);
$$;

-- ---------- Profil créé automatiquement à l'inscription ---------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Créer / rejoindre / quitter un espace ---------------------

create or replace function public.create_space(p_name text default 'Notre espace')
returns public.spaces language plpgsql security definer set search_path = public as $$
declare
  v_space spaces;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if exists (select 1 from space_members where user_id = auth.uid()) then
    raise exception 'Tu fais déjà partie d''un espace';
  end if;

  loop
    begin
      insert into spaces (name, invite_code, created_by)
      values (coalesce(nullif(trim(p_name), ''), 'Notre espace'), gen_invite_code(), auth.uid())
      returning * into v_space;
      exit;
    exception when unique_violation then
      -- code déjà pris, on retente
    end;
  end loop;

  insert into space_members (space_id, user_id, role) values (v_space.id, auth.uid(), 'owner');
  return v_space;
end;
$$;

create or replace function public.join_space(p_code text)
returns public.spaces language plpgsql security definer set search_path = public as $$
declare
  v_space spaces;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if exists (select 1 from space_members where user_id = auth.uid()) then
    raise exception 'Tu fais déjà partie d''un espace';
  end if;

  select * into v_space from spaces where invite_code = upper(trim(p_code));
  if v_space.id is null then raise exception 'Code introuvable'; end if;

  if (select count(*) from space_members where space_id = v_space.id) >= 2 then
    raise exception 'Cet espace est déjà complet';
  end if;

  insert into space_members (space_id, user_id) values (v_space.id, auth.uid());
  return v_space;
end;
$$;

create or replace function public.leave_space()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_space uuid;
begin
  delete from space_members where user_id = auth.uid() returning space_id into v_space;
  -- Espace vide = supprimé avec toutes ses données
  if v_space is not null and not exists (select 1 from space_members where space_id = v_space) then
    delete from spaces where id = v_space;
  end if;
end;
$$;

revoke execute on function public.create_space(text), public.join_space(text), public.leave_space() from public, anon;
grant execute on function public.create_space(text), public.join_space(text), public.leave_space() to authenticated;

-- ---------- Sécurité (RLS) --------------------------------------------

alter table public.profiles           enable row level security;
alter table public.spaces             enable row level security;
alter table public.space_members      enable row level security;
alter table public.push_subscriptions enable row level security;

-- Profils : le sien + celui de son/sa partenaire
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_space_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Espaces : visibles et modifiables par leurs membres
create policy spaces_select on public.spaces for select to authenticated
  using (public.is_space_member(id));
create policy spaces_update on public.spaces for update to authenticated
  using (public.is_space_member(id)) with check (public.is_space_member(id));

-- Membres : visibles par les membres du même espace (création via create_space/join_space)
create policy members_select on public.space_members for select to authenticated
  using (public.is_space_member(space_id));

-- Abonnements push : chacun gère les siens
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Temps réel ------------------------------------------------
-- Permet de voir instantanément l'arrivée de son/sa partenaire dans l'espace
alter publication supabase_realtime add table public.space_members;
alter publication supabase_realtime add table public.profiles;
