-- =====================================================================
-- Jurassic — Étape 6 bis : photos des envies
-- Fichiers dans le stockage Supabase (bucket privé « envies »),
-- rangés par espace : <space_id>/<wish_id>/<photo>.jpg (+ vignette -mini.jpg)
-- À exécuter dans Supabase > SQL Editor
-- =====================================================================

-- ---------- Stockage --------------------------------------------------

-- Photos réduites dans le navigateur avant l'envoi : 5 Mo suffisent largement
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('envies', 'envies', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Le premier dossier du chemin est l'espace : seuls ses membres y accèdent
create or replace function public.can_access_space_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.is_space_member(split_part(p_name, '/', 1)::uuid);
exception when invalid_text_representation then
  return false;
end;
$$;

create policy envies_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'envies' and public.can_access_space_path(name));
create policy envies_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'envies' and public.can_access_space_path(name));
create policy envies_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'envies' and public.can_access_space_path(name));

-- ---------- Photos d'une envie ----------------------------------------

create table public.wish_photos (
  id         uuid primary key default gen_random_uuid(),
  wish_id    uuid not null references public.wishes(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  path       text not null,  -- photo réduite (2048 px max)
  thumb_path text not null,  -- vignette (480 px max)
  width      int,
  height     int,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index wish_photos_wish_idx on public.wish_photos(wish_id, created_at);

alter table public.wish_photos enable row level security;
create policy wish_photos_all on public.wish_photos for all to authenticated
  using (public.is_space_member(space_id))
  with check (
    public.is_space_member(space_id)
    and exists (select 1 from public.wishes w where w.id = wish_id and w.space_id = wish_photos.space_id)
  );

alter publication supabase_realtime add table public.wish_photos;
