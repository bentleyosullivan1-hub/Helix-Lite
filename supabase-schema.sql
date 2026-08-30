-- HELIX-LITE hardened Supabase schema
-- Run this in Supabase SQL Editor.
-- IMPORTANT: the first-admin UPDATE at the bottom is intentionally manual.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  premium boolean not null default false,
  role text not null default 'user' check (role in ('user', 'admin')),
  accent text default 'cyan',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- SECURITY DEFINER helper avoids recursive RLS checks against profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles are readable by their owner or an admin" on public.profiles;
create policy "profiles are readable by their owner or an admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "users can update their own row" on public.profiles;
create policy "users can update their own row"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "admins can update any profile" on public.profiles;
create policy "admins can update any profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- Non-admins may only change their cosmetic accent. This protects role/premium/email
-- even if a malicious client submits a full-row UPDATE.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    new.id := old.id;
    new.email := old.email;
    new.premium := old.premium;
    new.role := old.role;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
before update on public.profiles
for each row execute function public.protect_profile_fields();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.submissions (
  id bigint generated always as identity primary key,
  type text not null,
  fields jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
alter table public.submissions enable row level security;
drop policy if exists "anyone can submit an application" on public.submissions;
create policy "anyone can submit an application" on public.submissions for insert with check (true);
drop policy if exists "only admins can view submissions" on public.submissions;
create policy "only admins can view submissions" on public.submissions for select using (public.is_admin());
drop policy if exists "only admins can update submissions" on public.submissions;
create policy "only admins can update submissions" on public.submissions for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "only admins can delete submissions" on public.submissions;
create policy "only admins can delete submissions" on public.submissions for delete using (public.is_admin());

create table if not exists public.games (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  category text not null default 'arcade',
  file text,
  premium_only boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.games enable row level security;
drop policy if exists "games are readable by everyone" on public.games;
create policy "games are readable by everyone" on public.games for select using (true);
drop policy if exists "only admins can insert games" on public.games;
create policy "only admins can insert games" on public.games for insert with check (public.is_admin());
drop policy if exists "only admins can update games" on public.games;
create policy "only admins can update games" on public.games for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "only admins can delete games" on public.games;
create policy "only admins can delete games" on public.games for delete using (public.is_admin());

create table if not exists public.suggestions (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  created_by uuid references public.profiles(id),
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create table if not exists public.suggestion_votes (
  suggestion_id bigint not null references public.suggestions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight int not null default 1 check (weight in (1,2)),
  created_at timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);
alter table public.suggestions enable row level security;
alter table public.suggestion_votes enable row level security;
drop policy if exists "suggestions are readable by everyone" on public.suggestions;
create policy "suggestions are readable by everyone" on public.suggestions for select using (true);
drop policy if exists "signed-in users can post a suggestion" on public.suggestions;
create policy "signed-in users can post a suggestion" on public.suggestions for insert with check (auth.uid() = created_by);
drop policy if exists "admins can update suggestions" on public.suggestions;
create policy "admins can update suggestions" on public.suggestions for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins can delete suggestions" on public.suggestions;
create policy "admins can delete suggestions" on public.suggestions for delete using (public.is_admin());
drop policy if exists "votes are readable by everyone" on public.suggestion_votes;
create policy "votes are readable by everyone" on public.suggestion_votes for select using (true);
drop policy if exists "signed-in users can vote once per suggestion" on public.suggestion_votes;
create policy "signed-in users can vote once per suggestion" on public.suggestion_votes for insert with check (auth.uid() = user_id);
drop policy if exists "users can remove their own vote" on public.suggestion_votes;
create policy "users can remove their own vote" on public.suggestion_votes for delete using (auth.uid() = user_id);

-- FIRST ADMIN SETUP: after signing up, run exactly one statement like:
-- update public.profiles set role = 'admin' where email = 'you@example.com';
