-- Apply after supabase-schema.sql. The Netlify functions own all access.
create table if not exists public.planner_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.planner_profiles(user_id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  timezone text not null,
  unique (user_id, endpoint)
);

create table if not exists public.planner_push_deliveries (
  subscription_id uuid not null references public.planner_push_subscriptions(id) on delete cascade,
  notification_key text not null,
  created_at timestamptz not null default now(),
  primary key (subscription_id, notification_key)
);

create index if not exists planner_push_deliveries_created_idx
  on public.planner_push_deliveries (created_at);

alter table public.planner_push_subscriptions enable row level security;
alter table public.planner_push_deliveries enable row level security;
revoke all on public.planner_push_subscriptions, public.planner_push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.planner_push_subscriptions, public.planner_push_deliveries to service_role;
