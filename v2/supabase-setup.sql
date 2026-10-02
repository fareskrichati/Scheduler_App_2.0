-- Additive setup for 2.0. Existing 1.5.1 planner records/schema remain intact.
create table if not exists public.planner_canvas_automation (
 user_id uuid primary key references auth.users(id) on delete cascade,
 mode text not null default 'manual' check(mode in ('manual','automatic')),
 timezone text not null default 'UTC',
 last_checked_at timestamptz,
 next_check_at timestamptz,
 last_error text
);
alter table public.planner_canvas_automation enable row level security;
revoke all on public.planner_canvas_automation from anon,authenticated;
grant select on public.planner_canvas_automation to authenticated;
grant insert(user_id,mode,timezone,next_check_at),update(user_id,mode,timezone,next_check_at) on public.planner_canvas_automation to authenticated;
grant all on public.planner_canvas_automation to service_role;
drop policy if exists "Read own Canvas preferences" on public.planner_canvas_automation;
create policy "Read own Canvas preferences" on public.planner_canvas_automation for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Create own Canvas preferences" on public.planner_canvas_automation;
create policy "Create own Canvas preferences" on public.planner_canvas_automation for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Update own Canvas preferences" on public.planner_canvas_automation;
create policy "Update own Canvas preferences" on public.planner_canvas_automation for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index if not exists planner_canvas_automation_due on public.planner_canvas_automation(next_check_at) where mode='automatic';
