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
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their planner" on public.planner_profiles;
create policy "Users can insert their planner"
  on public.planner_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their planner" on public.planner_profiles;
create policy "Users can update their planner"
  on public.planner_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their planner" on public.planner_profiles;
create policy "Users can delete their planner"
  on public.planner_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.planner_profiles from anon;
grant select, insert, update, delete on table public.planner_profiles to authenticated;
grant select, insert, update, delete on table public.planner_profiles to service_role;

do $$ begin
  alter publication supabase_realtime add table public.planner_profiles;
exception when duplicate_object then null;
end $$;

create table if not exists public.planner_reminder_delivery (
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null,
  last_sent_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, reminder_type)
);

alter table public.planner_reminder_delivery enable row level security;
drop policy if exists "Users can read their reminder delivery state" on public.planner_reminder_delivery;
create policy "Users can read their reminder delivery state"
  on public.planner_reminder_delivery
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.planner_reminder_delivery from anon, authenticated;
grant select on table public.planner_reminder_delivery to authenticated;
grant select, insert, update, delete on table public.planner_reminder_delivery to service_role;
