-- =====================================================================
-- Jurassic — Étape 7 : compteurs
--   • temps passé ensemble depuis la date de rencontre (+ notification d'anniversaire)
--   • comptes à rebours vers les dates importantes
-- À exécuter dans Supabase > SQL Editor
-- =====================================================================

alter table public.spaces add column met_on date; -- date de rencontre

create table public.countdowns (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 80),
  date       date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index countdowns_space_idx on public.countdowns(space_id, date);

alter table public.countdowns enable row level security;
create policy countdowns_all on public.countdowns for all to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

-- Notification d'anniversaire de rencontre (send-reminders) : une seule par an
create table public.anniversary_log (
  space_id uuid not null references public.spaces(id) on delete cascade,
  day      date not null,
  primary key (space_id, day)
);
alter table public.anniversary_log enable row level security;

-- Temps réel : nouveaux comptes à rebours, date de rencontre modifiée par l'autre
alter publication supabase_realtime add table public.countdowns;
alter publication supabase_realtime add table public.spaces;
