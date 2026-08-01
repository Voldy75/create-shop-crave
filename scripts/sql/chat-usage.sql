-- Chat quota: usage table + atomic check-and-increment RPC.
-- This is the existing free-tier rate-limit for /api/chat; the file was added
-- after-the-fact to capture the canonical definition that's already running in
-- production. Idempotent — safe to re-run.
--
-- Companion to photo-usage.sql.

-- ─── usage table ──────────────────────────────────────────────────────────

create table if not exists public.usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  count      int  not null default 0,
  primary key (user_id, usage_date)
);

alter table public.usage enable row level security;

drop policy if exists "Users can read own usage" on public.usage;
create policy "Users can read own usage"
  on public.usage for select
  using (auth.uid() = user_id);

-- Writes go through the service-role client only; no insert/update/delete
-- policies for anon/authenticated.

-- ─── check_and_increment_usage RPC ─────────────────────────────────────────

create or replace function public.check_and_increment_usage(
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
  v_allowed boolean;
begin
  insert into public.usage (user_id, usage_date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, usage_date) do update
    set count = case
      when public.usage.count < p_limit then public.usage.count + 1
      else public.usage.count
    end;

  select count into v_count
  from public.usage
  where user_id = p_user_id and usage_date = p_date;

  v_allowed := (v_count <= p_limit);

  return json_build_object('allowed', v_allowed, 'count', v_count);
end;
$$;

-- Lock down execute: this function is SECURITY DEFINER and takes a user_id
-- parameter, so any caller could increment any user's counter if granted.
-- Only the service-role client (used by /api/chat) needs to call it.
revoke execute on function public.check_and_increment_usage(uuid, date, int) from public;
revoke execute on function public.check_and_increment_usage(uuid, date, int) from anon;
revoke execute on function public.check_and_increment_usage(uuid, date, int) from authenticated;
grant execute on function public.check_and_increment_usage(uuid, date, int) to service_role;
