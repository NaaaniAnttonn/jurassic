-- =====================================================================
-- Jurassic — Étape 5 : tâches partagées
-- À exécuter dans Supabase > SQL Editor
-- =====================================================================

create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  notes      text check (char_length(notes) <= 2000),
  for_users  uuid[] not null default '{}',   -- qui doit la faire
  due_date   date,                           -- échéance (un jour, sans heure)
  recurrence text check (recurrence in ('daily', 'weekly', 'monthly', 'yearly')),
  done       boolean not null default false,
  done_at    timestamptz,
  done_by    uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- une tâche répétée se reprogramme d'échéance en échéance
  check (recurrence is null or due_date is not null)
);
create index tasks_space_idx on public.tasks(space_id, due_date);

create or replace function public.touch_task()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_task();

alter table public.tasks enable row level security;
create policy tasks_all on public.tasks for all to authenticated
  using (public.is_space_member(space_id))
  with check (public.is_space_member(space_id));

-- Récapitulatif du matin (send-reminders) : un seul par personne et par jour
create table public.task_digest_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
alter table public.task_digest_log enable row level security;

alter publication supabase_realtime add table public.tasks;
