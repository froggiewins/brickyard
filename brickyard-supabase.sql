-- Brickyard website backend: accounts, published games and mesh files.
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- Safe to run more than once.

-- ---------- Accounts ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,20}$')
    check (username not in ('admin','brickyard','roblox','claude','anthropic','moderator','mod','staff','official','system','guest','player')),
  color text not null default '#ff8a1f' check (color ~ '^#[0-9a-fA-F]{6}$'),
  bio text not null default '' check (char_length(bio) <= 140),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "create own profile" on public.profiles;
create policy "create own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "edit own profile" on public.profiles;
create policy "edit own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "delete own profile" on public.profiles;
create policy "delete own profile" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

-- ---------- Published games ----------
create table if not exists public.games (
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  id text not null check (id ~ '^[a-z0-9]{2,20}$'),
  name text not null check (char_length(name) between 1 and 60),
  json text not null check (char_length(json) <= 260000),
  thumb text not null default '' check (thumb = '' or (thumb like 'data:image/jpeg;base64,%' and char_length(thumb) <= 60000)),
  parts int not null default 0,
  scripts int not null default 0,
  meshes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);
create index if not exists games_updated_idx on public.games (updated_at desc);
alter table public.games enable row level security;

drop policy if exists "games are public" on public.games;
create policy "games are public" on public.games for select to anon, authenticated using (true);
drop policy if exists "publish own games" on public.games;
create policy "publish own games" on public.games for insert to authenticated with check ((select auth.uid()) = owner);
drop policy if exists "update own games" on public.games;
create policy "update own games" on public.games for update to authenticated using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
drop policy if exists "unpublish own games" on public.games;
create policy "unpublish own games" on public.games for delete to authenticated using ((select auth.uid()) = owner);

-- ---------- Mesh files (public to read, each user writes only their own folder) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meshes', 'meshes', true, 20971520, array['application/json'])
on conflict (id) do update set public = true, file_size_limit = 20971520, allowed_mime_types = array['application/json'];

drop policy if exists "upload own meshes" on storage.objects;
create policy "upload own meshes" on storage.objects for insert to authenticated
  with check (bucket_id = 'meshes' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "replace own meshes" on storage.objects;
create policy "replace own meshes" on storage.objects for update to authenticated
  using (bucket_id = 'meshes' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "read own meshes" on storage.objects;
create policy "read own meshes" on storage.objects for select to authenticated
  using (bucket_id = 'meshes' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "delete own meshes" on storage.objects;
create policy "delete own meshes" on storage.objects for delete to authenticated
  using (bucket_id = 'meshes' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- Let people delete their own account ----------
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Make the API see the new tables straight away.
notify pgrst, 'reload schema';
