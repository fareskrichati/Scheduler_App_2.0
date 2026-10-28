-- Run once in the same Supabase project as planner_profiles.
-- Only the backend service role may access credentials. Users manage connections
-- through authenticated, owner-scoped Netlify endpoints.
create table if not exists public.planner_connector_grants (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  client_name text not null,
  scopes text[] not null check (scopes <@ array['planner:read','planner:write']::text[] and 'planner:read' = any(scopes)),
  redirect_uri text not null,
  code_challenge text not null,
  code_hash text,
  code_expires_at timestamptz,
  refresh_hash text,
  refresh_expires_at timestamptz not null,
  timezone text not null default 'UTC',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.planner_connector_grants enable row level security;
revoke all on table public.planner_connector_grants from anon, authenticated;
grant select, insert, update, delete on table public.planner_connector_grants to service_role;
create index if not exists planner_connector_grants_owner_idx on public.planner_connector_grants(user_id);
