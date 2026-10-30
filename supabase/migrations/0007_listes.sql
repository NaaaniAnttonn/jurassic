-- =====================================================================
-- Jurassic — Étape 4 : listes partagées (courses, valise, bricolage...)
-- À exécuter dans Supabase > SQL Editor
-- =====================================================================

create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index lists_space_idx on public.lists(space_id);

create table public.list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 200),
  quantity   text check (char_length(quantity) <= 40),
  position   double precision not null, -- ordre manuel : on insère entre deux voisins
  checked    boolean not null default false,
  checked_at timestamptz,
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  notified   boolean not null default false -- l'autre a été prévenu de cet ajout
);
create index list_items_list_idx on public.list_items(list_id, position);
-- Pour la notification groupée (send-reminders)
create index list_items_pending_idx on public.list_items(created_at) where not notified;

-- ---------- Sécurité --------------------------------------------------

alter table public.lists enable row level security;
create policy lists_all on public.lists for all to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

alter table public.list_items enable row level security;
create policy list_items_all on public.list_items for all to authenticated
  using (public.is_space_member(space_id))
  with check (
    public.is_space_member(space_id)
    -- l'article et sa liste sont dans le même espace
    and exists (select 1 from public.lists l where l.id = list_id and l.space_id = list_items.space_id)
  );

-- ---------- Liste « Courses » d'office --------------------------------
-- (le futur bouton « ajouter aux courses » des recettes s'en servira)

insert into public.lists (space_id, name, created_by)
  select id, 'Courses', created_by from public.spaces;

create or replace function public.create_default_lists()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into lists (space_id, name, created_by) values (new.id, 'Courses', new.created_by);
  return new;
end;
$$;
create trigger spaces_default_lists after insert on public.spaces
  for each row execute function public.create_default_lists();

-- ---------- Temps réel ------------------------------------------------

alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.list_items;
