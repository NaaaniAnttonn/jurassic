-- =====================================================================
-- Jurassic — Étape 2 : agenda partagé
-- À exécuter dans Supabase > SQL Editor
-- =====================================================================

create table public.events (
  id               uuid primary key default gen_random_uuid(),
  space_id         uuid not null references public.spaces(id) on delete cascade,
  created_by       uuid not null references auth.users(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 200),
  location         text,
  notes            text,
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  all_day          boolean not null default false,
  recurrence       text check (recurrence in ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_until date,
  for_users        uuid[] not null default '{}',   -- qui est concerné
  is_private       boolean not null default false, -- visible uniquement par son créateur
  reminder_minutes int check (reminder_minutes >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null,
  check (end_at >= start_at)
);
create index events_space_start_idx on public.events(space_id, start_at);

-- Date de modification + auteur mis à jour automatiquement
create or replace function public.touch_event()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger events_touch before update on public.events
  for each row execute function public.touch_event();

-- Sécurité : membres de l'espace, et événements privés réservés à leur créateur
alter table public.events enable row level security;

create policy events_select on public.events for select to authenticated
  using (public.is_space_member(space_id) and (not is_private or created_by = auth.uid()));

create policy events_insert on public.events for insert to authenticated
  with check (public.is_space_member(space_id) and created_by = auth.uid());

create policy events_update on public.events for update to authenticated
  using (public.is_space_member(space_id) and (not is_private or created_by = auth.uid()))
  with check (public.is_space_member(space_id) and (not is_private or created_by = auth.uid()));

create policy events_delete on public.events for delete to authenticated
  using (public.is_space_member(space_id) and (not is_private or created_by = auth.uid()));

-- Journal des rappels envoyés (évite les doublons) — accessible au serveur uniquement
create table public.reminder_log (
  event_id         uuid not null references public.events(id) on delete cascade,
  occurrence_start timestamptz not null,
  sent_at          timestamptz not null default now(),
  primary key (event_id, occurrence_start)
);
alter table public.reminder_log enable row level security;

-- Temps réel entre les deux téléphones
alter publication supabase_realtime add table public.events;
