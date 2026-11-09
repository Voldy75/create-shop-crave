-- Bo agent: task store, per-task metering, retention, and the bo_agent flag.
-- Idempotent — safe to re-run. Additive only: no existing table, column,
-- function, policy or grant is touched (new rows only in feature_flags and
-- app_config).
--
--   agent_tasks        — one row per user request Bo works on ("something
--                        spicy for dinner, 2 people"): mode, status, plan,
--                        and the step counters the per-task cap reads.
--   agent_task_events  — the task's timeline: status changes, tool calls,
--                        approvals asked / granted / rejected. Short summaries
--                        and minimised data only — never full tool payloads.
--   usage_tasks        — daily task count per user. A task is counted ONCE
--                        when it is created, however many turns it takes.
--
-- Retention: every task carries expires_at (90 days, DPDP purpose limitation);
-- purge_expired_agent_tasks() deletes past-due tasks and their events, and is
-- run daily by /api/cron/bo-retention. Account deletion cascades everything.
--
-- Writes are service-role only (app/api/bo/*). Owners can read their own rows.

-- ─── agent_tasks ───────────────────────────────────────────────────────────

create table if not exists public.agent_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  intent      text not null check (char_length(intent) <= 500),
  mode        text not null default 'undecided'
                check (mode in ('undecided','cook','order','dine_in','grocery')),
  status      text not null default 'planning'
                check (status in ('planning','awaiting_approval','executing',
                                  'awaiting_payment','tracking','done','failed','cancelled')),
  plan        jsonb not null default '{}'::jsonb,
  steps       int not null default 0,   -- model steps spent on this task
  tool_calls  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '90 days')
);

create index if not exists agent_tasks_user_idx    on public.agent_tasks (user_id, created_at desc);
create index if not exists agent_tasks_expires_idx on public.agent_tasks (expires_at);

alter table public.agent_tasks enable row level security;

drop policy if exists "agent_tasks_select_own" on public.agent_tasks;
create policy "agent_tasks_select_own" on public.agent_tasks
  for select using (auth.uid() = user_id);

-- ─── agent_task_events ─────────────────────────────────────────────────────

create table if not exists public.agent_task_events (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.agent_tasks(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('status','tool_call','tool_result',
                'approval_requested','approval_granted','approval_rejected','message','error')),
  tool        text,
  summary     text check (char_length(summary) <= 500),
  data        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists agent_task_events_task_idx on public.agent_task_events (task_id, id);
create index if not exists agent_task_events_user_idx on public.agent_task_events (user_id);

alter table public.agent_task_events enable row level security;

drop policy if exists "agent_task_events_select_own" on public.agent_task_events;
create policy "agent_task_events_select_own" on public.agent_task_events
  for select using (auth.uid() = user_id);

-- ─── usage_tasks + quota RPC ───────────────────────────────────────────────

create table if not exists public.usage_tasks (
  user_id     uuid not null references auth.users(id) on delete cascade,
  usage_date  date not null,
  count       int not null default 0,
  primary key (user_id, usage_date)
);

alter table public.usage_tasks enable row level security;

drop policy if exists "usage_tasks_select_own" on public.usage_tasks;
create policy "usage_tasks_select_own" on public.usage_tasks
  for select using (auth.uid() = user_id);

-- Same semantics as check_and_increment_usage after the off-by-one fix:
-- NULL p_limit = unlimited, <= 0 blocks without touching a row, otherwise the
-- increment happens only while under the limit and RETURNING decides.
create or replace function public.check_and_increment_task_usage(
  p_user_id uuid,
  p_date    date,
  p_limit   int
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count   int;
  v_current int;
begin
  if p_limit is null then
    insert into public.usage_tasks (user_id, usage_date, count)
    values (p_user_id, p_date, 1)
    on conflict (user_id, usage_date) do update
      set count = public.usage_tasks.count + 1
    returning count into v_count;
    return json_build_object('allowed', true, 'count', v_count);
  end if;

  if p_limit <= 0 then
    select count into v_current from public.usage_tasks
     where user_id = p_user_id and usage_date = p_date;
    return json_build_object('allowed', false, 'count', coalesce(v_current, 0));
  end if;

  insert into public.usage_tasks as u (user_id, usage_date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, usage_date) do update
    set count = u.count + 1
    where u.count < p_limit
  returning u.count into v_count;

  if v_count is null then
    select count into v_current from public.usage_tasks
     where user_id = p_user_id and usage_date = p_date;
    return json_build_object('allowed', false, 'count', coalesce(v_current, 0));
  end if;

  return json_build_object('allowed', true, 'count', v_count);
end;
$$;

-- Add a turn's spend to a task and report whether it is now over the per-task
-- cap. Scoped by user as well as task id, so a forged task id cannot charge or
-- read someone else's task.
create or replace function public.agent_task_record_steps(
  p_task_id    uuid,
  p_user_id    uuid,
  p_steps      int,
  p_tool_calls int,
  p_max_steps  int
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_steps int;
begin
  update public.agent_tasks
     set steps      = steps + greatest(p_steps, 0),
         tool_calls = tool_calls + greatest(p_tool_calls, 0),
         updated_at = now()
   where id = p_task_id and user_id = p_user_id
  returning steps into v_steps;

  if v_steps is null then
    return json_build_object('found', false, 'steps', 0, 'over_cap', true);
  end if;
  return json_build_object('found', true, 'steps', v_steps, 'over_cap', v_steps >= p_max_steps);
end;
$$;

-- Retention. Events go with their task (on delete cascade).
create or replace function public.purge_expired_agent_tasks()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted int;
begin
  delete from public.agent_tasks where expires_at < now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- `create or replace function` leaves PUBLIC EXECUTE on a new function; these
-- are SECURITY DEFINER, so lock them to the service role. Keep this block last.
revoke execute on function public.check_and_increment_task_usage(uuid, date, int)          from public, anon, authenticated;
revoke execute on function public.agent_task_record_steps(uuid, uuid, int, int, int)       from public, anon, authenticated;
revoke execute on function public.purge_expired_agent_tasks()                              from public, anon, authenticated;
grant  execute on function public.check_and_increment_task_usage(uuid, date, int)          to service_role;
grant  execute on function public.agent_task_record_steps(uuid, uuid, int, int, int)       to service_role;
grant  execute on function public.purge_expired_agent_tasks()                              to service_role;

-- ─── Config ────────────────────────────────────────────────────────────────

-- Fail-closed master switch: off until flipped in Admin → Flags. Off restores
-- today's chat and agent exactly.
insert into public.feature_flags (id, enabled, description) values
  ('bo_agent', false, 'Bo as an autonomous food agent (task flow, approvals, food profile)')
on conflict (id) do nothing;

-- Defaults for plans without their own numbers. A plan overrides tasks_daily
-- with features.bo_tasks_daily (Admin → Plans); null there = unlimited.
insert into public.app_config (key, value, description) values
  ('bo.limits', '{"tasks_daily": 3, "max_steps_per_task": 24, "max_steps_per_turn": 8}'::jsonb,
   'Bo agent: tasks per day (default for plans without features.bo_tasks_daily), and the per-task / per-turn model-step caps.')
on conflict (key) do nothing;
