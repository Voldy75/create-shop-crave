-- Photo analysis quota table + atomic check-and-increment RPC.
-- Separate from the chat quota (`usage` table) so we can meter independently.
-- Run this in the Supabase SQL editor against the project.

create table if not exists public.usage_photo (
  user_id    uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  count      int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.usage_photo enable row level security;

drop policy if exists "usage_photo_read_own" on public.usage_photo;
create policy "usage_photo_read_own"
  on public.usage_photo for select
  using (auth.uid() = user_id);

-- Writes go through the service-role client only (mirrors `usage` table).

create or replace function public.check_and_increment_photo_usage(
  p_user_id uuid,
  p_date    date,
  p_limit   int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count   int;
  v_allowed boolean;
begin
  insert into public.usage_photo (user_id, usage_date, count)
  values (p_user_id, p_date, 0)
  on conflict (user_id, usage_date) do nothing;

  select count into v_count
  from public.usage_photo
  where user_id = p_user_id and usage_date = p_date
  for update;

  if v_count < p_limit then
    update public.usage_photo
       set count = count + 1,
           updated_at = now()
     where user_id = p_user_id and usage_date = p_date
     returning count into v_count;
    v_allowed := true;
  else
    v_allowed := false;
  end if;

  return json_build_object('allowed', v_allowed, 'count', v_count);
end;
$$;

grant execute on function public.check_and_increment_photo_usage(uuid, date, int) to service_role;
