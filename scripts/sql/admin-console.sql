-- Admin console data model + runtime-configurable limits.
--
-- Additive and idempotent. Seeded so behaviour is IDENTICAL to the hardcoded
-- constants on day one: free plan = 2 chat / 3 photo per day, matching
-- lib/constants.ts.
--
-- Note on sequencing: the plan filed these tables under "Phase 7 (admin API)",
-- but Phase 6's resolveLimits() and requireUser() read user_profiles, plans and
-- app_config, so the schema has to land with Phase 6. Phase 7 adds the admin
-- API surface and UI on top of these tables.

-- ─── plans ─────────────────────────────────────────────────────────────────
-- Entitlements as rows instead of constants. NULL limit = unlimited.

create table if not exists public.plans (
  id                text primary key,
  name              text not null,
  is_active         boolean not null default true,
  sort              int not null default 0,
  chat_daily_limit  int,
  photo_daily_limit int,
  features          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Seeded with `do nothing` so re-running never clobbers admin edits.
insert into public.plans (id, name, sort, chat_daily_limit, photo_daily_limit, features) values
  ('free', 'Free', 0, 2,    3,    '{"byok": true}'::jsonb),
  ('pro',  'Pro',  1, null, null, '{"byok": true, "unlimited": true}'::jsonb)
on conflict (id) do nothing;

-- ─── plan_prices ───────────────────────────────────────────────────────────
-- Per-platform pricing. Not over-engineering: Apple's price tiers cannot match
-- ₹749 exactly, so web/iOS/Android prices WILL diverge. A single price column
-- on plans does not survive contact with IAP.

create table if not exists public.plan_prices (
  plan_id          text not null references public.plans(id) on delete cascade,
  platform         text not null check (platform in ('web','ios','android')),
  provider         text not null check (provider in ('razorpay','stripe','apple','google')),
  amount_minor     int  not null,
  currency         text not null,
  interval         text not null check (interval in ('one_time','month','year')),
  store_product_id text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  primary key (plan_id, platform, provider)
);

-- Current live web pricing, captured from the code it replaces:
--   app/api/subscribe/razorpay/route.ts -> PRO_AMOUNT_INR = 74900
--   components/UpgradeDialog.tsx        -> "$9/month via Stripe"
insert into public.plan_prices (plan_id, platform, provider, amount_minor, currency, interval) values
  ('pro', 'web', 'razorpay', 74900, 'INR', 'one_time'),
  ('pro', 'web', 'stripe',     900, 'USD', 'month')
on conflict (plan_id, platform, provider) do nothing;

-- ─── user_profiles ─────────────────────────────────────────────────────────
-- Admin-facing user row + moderation state. email is denormalized for ILIKE
-- search (auth.users is not reachable from PostgREST).

create table if not exists public.user_profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  email               text,
  display_name        text,
  role                text not null default 'user'
                        check (role in ('user','support','admin')),
  status              text not null default 'active'
                        check (status in ('active','restricted','banned')),
  status_reason       text,
  status_changed_at   timestamptz,
  status_changed_by   uuid,
  plan_id             text references public.plans(id),
  first_seen_platform text check (first_seen_platform in ('web','ios','android')),
  last_seen_platform  text check (last_seen_platform  in ('web','ios','android')),
  last_seen_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists user_profiles_email_idx  on public.user_profiles (lower(email));
create index if not exists user_profiles_status_idx on public.user_profiles (status) where status <> 'active';
-- Cursor pagination key for GET /api/admin/users (offset pagination rots as
-- rows are inserted mid-scroll).
create index if not exists user_profiles_cursor_idx on public.user_profiles (created_at desc, user_id desc);

-- Backfill existing users.
insert into public.user_profiles (user_id, email, created_at)
select id, email, created_at from auth.users
on conflict (user_id) do nothing;

-- Keep it current. SECURITY DEFINER because it writes public.user_profiles
-- from a trigger on auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The trigger fires as the table owner, so nothing needs EXECUTE on this.
-- Leaving the default PUBLIC grant would expose it at
-- POST /rest/v1/rpc/handle_new_user as a SECURITY DEFINER function -- the same
-- trap that left the admin_* RPCs open (see rpcs.sql).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ─── app_config ────────────────────────────────────────────────────────────
-- Runtime config. NEVER holds a secret value -- see the secrets boundary in
-- the plan. Payment/API secrets stay in Vercel env vars; this table holds only
-- public identifiers, booleans and numbers.

create table if not exists public.app_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

insert into public.app_config (key, value, description) values
  ('rate_limits.default', '{"chat_daily": 2, "photo_daily": 3}'::jsonb,
   'Fallback daily limits when a user has no plan. Mirrors lib/constants.ts.'),
  ('limits.fail_mode', '"open"'::jsonb,
   'Reserved. Today chat fails open and photo fails closed on PGRST202; harmonizing them is deliberately NOT part of this change.'),
  ('payments.providers.web',     '["razorpay","stripe"]'::jsonb, 'Checkout providers offered on web.'),
  ('payments.providers.ios',     '["apple"]'::jsonb,   'Apple mandates IAP for digital subscriptions.'),
  ('payments.providers.android', '["google"]'::jsonb,  'Play Billing for digital goods.')
on conflict (key) do nothing;

-- ─── admin_audit_log ───────────────────────────────────────────────────────
-- Without this, "who banned this user and why" is unanswerable, and
-- retrofitting means the first N bans have no record.

create table if not exists public.admin_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  action        text not null,
  target_type   text not null,
  target_id     text,
  before        jsonb,
  after         jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table public.user_profiles   enable row level security;
alter table public.plans           enable row level security;
alter table public.plan_prices     enable row level security;
alter table public.app_config      enable row level security;
alter table public.admin_audit_log enable row level security;

-- Users read their own profile. Writes are service-role only (admin API).
drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own" on public.user_profiles
  for select using (auth.uid() = user_id);

-- RLS controls ROWS, not columns. Without the column grants below, a moderated
-- user could read their own status_reason (free text written FOR admins, e.g.
-- "chargeback fraud, ticket #123") and status_changed_by (the acting admin's
-- uuid) via GET /rest/v1/user_profiles?select=* with their own JWT.
--
-- They can still see their own `status` -- they should -- just not the internal
-- note or who acted. status_reason / status_changed_at / status_changed_by stay
-- readable through the service role only.
revoke select on public.user_profiles from authenticated, anon;

grant select (
  user_id,
  email,
  display_name,
  role,
  status,
  plan_id,
  first_seen_platform,
  last_seen_platform,
  last_seen_at,
  created_at
) on public.user_profiles to authenticated;

-- Plans and prices are public catalogue data -- the paywall reads them from the
-- client. Only active rows are exposed.
drop policy if exists "plans_select_active" on public.plans;
create policy "plans_select_active" on public.plans
  for select using (is_active);

drop policy if exists "plan_prices_select_active" on public.plan_prices;
create policy "plan_prices_select_active" on public.plan_prices
  for select using (is_active);

-- app_config and admin_audit_log get NO anon/authenticated policies at all.
-- RLS enabled with zero policies = deny everything except service_role.

-- ─── pro_subscriptions: accept store providers ─────────────────────────────
-- Currently ARRAY['razorpay','stripe']; an Apple or Google grant would throw
-- 23514. Widened here so Phase 9 does not have to alter a live table under
-- submission pressure.

do $$
begin
  alter table public.pro_subscriptions drop constraint if exists pro_subscriptions_provider_check;
  alter table public.pro_subscriptions
    add constraint pro_subscriptions_provider_check
    check (provider in ('razorpay','stripe','apple','google'));
end $$;

-- ─── Quota RPCs: NULL p_limit means unlimited ──────────────────────────────
--
-- Unlimited must be NULL, never a large sentinel integer: with a sentinel, a
-- misconfigured 0 and an intended "unlimited" look identical in the logs.
--
-- WARNING: `create or replace function` RESETS the ACL to the default
-- PUBLIC EXECUTE. The revoke/grant block below MUST stay after these
-- definitions. Reordering it silently reopens the hole closed in rpcs.sql.

-- BUG FIX included here: the chat daily limit never blocked anyone.
--
-- The previous body capped `count` at p_limit via a conditional DO UPDATE, then
-- decided with `v_allowed := (v_count <= p_limit)`. Once count sticks at the
-- limit, `limit <= limit` stays true forever, so every request past the cap was
-- still served -- with p_limit = 2 the third, fourth, Nth call all returned
-- allowed = true. Verified against the live function before fixing.
--
-- Fix: decide by whether the increment ACTUALLY happened. `on conflict do
-- update ... where` performs no update when the predicate fails, so RETURNING
-- yields no row and v_count stays null -- an unambiguous "blocked" signal that
-- cannot drift out of sync with the counter.
--
-- check_and_increment_photo_usage does NOT share this bug: it reads the count
-- BEFORE incrementing, so its comparison was already correct.

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
  v_current int;
begin
  -- Unlimited: always increment (still metered for analytics), always allow.
  if p_limit is null then
    insert into public.usage (user_id, usage_date, count)
    values (p_user_id, p_date, 1)
    on conflict (user_id, usage_date) do update
      set count = public.usage.count + 1
    returning count into v_count;

    return json_build_object('allowed', true, 'count', v_count);
  end if;

  -- A non-positive limit blocks outright, without creating or touching a row.
  if p_limit <= 0 then
    select count into v_current
    from public.usage
    where user_id = p_user_id and usage_date = p_date;
    return json_build_object('allowed', false, 'count', coalesce(v_current, 0));
  end if;

  insert into public.usage as u (user_id, usage_date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, usage_date) do update
    set count = u.count + 1
    where u.count < p_limit
  returning u.count into v_count;

  if v_count is null then
    -- No row updated => already at or over the limit. Report the live count.
    select count into v_current
    from public.usage
    where user_id = p_user_id and usage_date = p_date;
    return json_build_object('allowed', false, 'count', coalesce(v_current, 0));
  end if;

  return json_build_object('allowed', true, 'count', v_count);
end;
$$;

create or replace function public.check_and_increment_photo_usage(
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
  insert into public.usage_photo (user_id, usage_date, count)
  values (p_user_id, p_date, 0)
  on conflict (user_id, usage_date) do nothing;

  select count into v_count
  from public.usage_photo
  where user_id = p_user_id and usage_date = p_date
  for update;

  -- NULL p_limit = unlimited. Without the explicit null test, `v_count < null`
  -- evaluates to NULL and falls through to the else branch, i.e. unlimited
  -- would mean DENIED.
  if p_limit is null or v_count < p_limit then
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

-- Re-apply the lockdown that `create or replace` just wiped. Do not reorder.
revoke execute on function public.check_and_increment_usage(uuid, date, int)       from public, anon, authenticated;
revoke execute on function public.check_and_increment_photo_usage(uuid, date, int) from public, anon, authenticated;
grant  execute on function public.check_and_increment_usage(uuid, date, int)       to service_role;
grant  execute on function public.check_and_increment_photo_usage(uuid, date, int) to service_role;
