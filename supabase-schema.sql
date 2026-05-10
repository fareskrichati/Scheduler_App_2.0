create table if not exists public.planner_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.planner_profiles enable row level security;

drop policy if exists "Users can read their planner" on public.planner_profiles;
create policy "Users can read their planner"
  on public.planner_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their planner" on public.planner_profiles;
create policy "Users can insert their planner"
  on public.planner_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their planner" on public.planner_profiles;
create policy "Users can update their planner"
  on public.planner_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their planner" on public.planner_profiles;
create policy "Users can delete their planner"
  on public.planner_profiles
  for delete
  using (auth.uid() = user_id);
