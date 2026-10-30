-- =====================================================================
-- Jurassic — Étape 6 : envies (activités, voyages, restos...)
-- Ce qu'on a envie de faire, à cocher une fois fait ; bilan par année.
-- À exécuter dans Supabase > SQL Editor
-- =====================================================================

create table public.wishes (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  category   text not null default 'Activités' check (char_length(category) between 1 and 40),
  notes      text check (char_length(notes) <= 2000),
  done_on    date,                -- date de réalisation (null = encore à faire)
  done_by    uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index wishes_space_idx on public.wishes(space_id, done_on);

alter table public.wishes enable row level security;
create policy wishes_all on public.wishes for all to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

alter publication supabase_realtime add table public.wishes;
