-- Run this entire script in Supabase SQL Editor.
-- SECURITY: roles are not accepted from signup metadata. New profiles are always students.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.study_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 10000),
  kind text not null check (kind in ('goal','note')),
  created_at timestamptz not null default now()
);

create index if not exists study_items_user_created_idx
  on public.study_items(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.study_items enable row level security;

-- Role is intentionally never copied from user-editable auth metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', ''), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Use a SECURITY DEFINER helper to avoid recursive RLS lookups on profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- Restrict table privileges as well as row visibility.
revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;
revoke all on table public.study_items from anon, authenticated;
grant select, insert, update, delete on table public.study_items to authenticated;

-- A signed-in user can read their own profile; admins can read profiles.
drop policy if exists "profile read own or admin" on public.profiles;
create policy "profile read own or admin" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

-- Users can update their own profile but cannot change their role.
drop policy if exists "profile update own non-role" on public.profiles;
create policy "profile update own non-role" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and role = (
    select p.role from public.profiles p where p.id = (select auth.uid())
  ));

drop policy if exists "study items read own or admin" on public.study_items;
create policy "study items read own or admin" on public.study_items
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "students insert own items" on public.study_items;
create policy "students insert own items" on public.study_items
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "students update own items" on public.study_items;
create policy "students update own items" on public.study_items
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "students delete own items" on public.study_items;
create policy "students delete own items" on public.study_items
  for delete to authenticated
  using (auth.uid() = user_id);

-- Important: do NOT expose the service_role key in NEXT_PUBLIC_* variables.
