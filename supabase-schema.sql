-- ============================================================================
-- HELIX: premium tier, admin panel, submissions, games, suggestions
-- Run this whole file once in the Supabase SQL editor (Project -> SQL Editor
-- -> New query -> paste -> Run). Safe to re-run; uses "if not exists" /
-- "or replace" throughout.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES — one row per signed-up user, created automatically.
--    premium: manual flag for now (toggled from the admin panel).
--    role:    'user' or 'admin'.
--    accent:  a premium-only cosmetic setting (accent color).
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  premium boolean not null default false,
  role text not null default 'user',
  accent text default 'cyan',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by their owner or an admin" on public.profiles;
create policy "profiles are readable by their owner or an admin"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "users can update their own row" on public.profiles;
create policy "users can update their own row"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "admins can update any profile" on public.profiles;
create policy "admins can update any profile"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. SUBMISSIONS — beta / moderator / feedback applications from apply.html.
--    Anyone can insert (that's how applying works); only admins can read,
--    update the status, or delete.
-- ----------------------------------------------------------------------------
create table if not exists public.submissions (
  id bigint generated always as identity primary key,
  type text not null,
  fields jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.submissions enable row level security;

drop policy if exists "anyone can submit an application" on public.submissions;
create policy "anyone can submit an application"
  on public.submissions for insert
  with check (true);

drop policy if exists "only admins can view submissions" on public.submissions;
create policy "only admins can view submissions"
  on public.submissions for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "only admins can update submissions" on public.submissions;
create policy "only admins can update submissions"
  on public.submissions for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "only admins can delete submissions" on public.submissions;
create policy "only admins can delete submissions"
  on public.submissions for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ----------------------------------------------------------------------------
-- 3. GAMES — the arcade catalog, manageable from the admin panel.
--    "premium_only" is the hook for gating extra games behind premium.
-- ----------------------------------------------------------------------------
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
create policy "games are readable by everyone"
  on public.games for select
  using (true);

drop policy if exists "only admins can insert games" on public.games;
create policy "only admins can insert games"
  on public.games for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "only admins can update games" on public.games;
create policy "only admins can update games"
  on public.games for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "only admins can delete games" on public.games;
create policy "only admins can delete games"
  on public.games for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ----------------------------------------------------------------------------
-- 4. SUGGESTIONS + VOTES — "more say in stuff". Premium votes count double
--    (weight is set to 2 at vote time when the voter is premium).
-- ----------------------------------------------------------------------------
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
  weight int not null default 1,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

alter table public.suggestions enable row level security;
alter table public.suggestion_votes enable row level security;

drop policy if exists "suggestions are readable by everyone" on public.suggestions;
create policy "suggestions are readable by everyone"
  on public.suggestions for select using (true);

drop policy if exists "signed-in users can post a suggestion" on public.suggestions;
create policy "signed-in users can post a suggestion"
  on public.suggestions for insert
  with check (auth.uid() = created_by);

drop policy if exists "admins can update suggestions" on public.suggestions;
create policy "admins can update suggestions"
  on public.suggestions for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admins can delete suggestions" on public.suggestions;
create policy "admins can delete suggestions"
  on public.suggestions for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "votes are readable by everyone" on public.suggestion_votes;
create policy "votes are readable by everyone"
  on public.suggestion_votes for select using (true);

drop policy if exists "signed-in users can vote once per suggestion" on public.suggestion_votes;
create policy "signed-in users can vote once per suggestion"
  on public.suggestion_votes for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can remove their own vote" on public.suggestion_votes;
create policy "users can remove their own vote"
  on public.suggestion_votes for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5. MAKE YOURSELF THE FIRST ADMIN
--    Sign up on /login.html with the account you want to use, THEN run this
--    (edit the email first):
--
--    update public.profiles set role = 'admin' where email = 'you@example.com';
-- ----------------------------------------------------------------------------
