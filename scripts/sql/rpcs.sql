-- Admin + subscription RPCs.
--
-- These 8 functions existed ONLY in the live database until now -- they were
-- created out-of-band and never captured in source. A project restore, or a
-- careless `create or replace`, would have silently destroyed the admin
-- dashboard and the pro-user check with no way to rebuild them. This file is
-- the source of truth from here on.
--
-- Idempotent -- safe to re-run.
--
-- Two hardening changes are baked in versus what was found live:
--
--   1. EXECUTE revoked from public/anon/authenticated.
--      All 8 are SECURITY DEFINER and had kept Postgres's default PUBLIC
--      EXECUTE grant. PostgREST exposes every public-schema function at
--      POST /rest/v1/rpc/<name> to any holder of the anon key -- and the anon
--      key ships in the client bundle, so it is public by design.
--      `admin_top_users` joins auth.users and returns email, which made this an
--      unauthenticated PII disclosure. Every caller in the app already uses
--      createServiceClient() (app/api/admin/stats/route.ts, lib/subscription.ts),
--      so service_role-only breaks nothing.
--      This matches the lockdown already applied to check_and_increment_usage
--      and check_and_increment_photo_usage in chat-usage.sql / photo-usage.sql.
--
--   2. search_path pinned to ''.
--      Supabase's linter flags mutable search_path on SECURITY DEFINER
--      functions as an escalation vector. Every table reference below is
--      already schema-qualified, so pinning is a no-op behaviourally.

-- ─── is_pro_user ───────────────────────────────────────────────────────────
-- Note: this DOES enforce expiry via current_period_end. The gap is that it is
-- only consulted by /api/subscribe/status -- no metered route calls it, so a
-- paying user is still rate-limited. Fixed by lib/limits.ts (Phase 6).

create or replace function public.is_pro_user(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  SELECT EXISTS (
    SELECT 1 FROM public.pro_subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$function$;

-- ─── admin dashboard ───────────────────────────────────────────────────────

create or replace function public.admin_dau()
returns integer
language sql
security definer
set search_path = ''
as $function$
  SELECT COUNT(DISTINCT user_id)::integer
  FROM public.usage
  WHERE usage_date = CURRENT_DATE;
$function$;

create or replace function public.admin_total_users()
returns integer
language sql
security definer
set search_path = ''
as $function$
  SELECT COUNT(*)::integer FROM auth.users;
$function$;

create or replace function public.admin_pro_count()
returns integer
language sql
security definer
set search_path = ''
as $function$
  SELECT COUNT(*)::integer
  FROM public.pro_subscriptions
  WHERE status = 'active'
    AND (current_period_end IS NULL OR current_period_end > now());
$function$;

create or replace function public.admin_requests_today()
returns integer
language sql
security definer
set search_path = ''
as $function$
  SELECT COALESCE(SUM(count), 0)::integer
  FROM public.usage
  WHERE usage_date = CURRENT_DATE;
$function$;

create or replace function public.admin_requests_week()
returns integer
language sql
security definer
set search_path = ''
as $function$
  SELECT COALESCE(SUM(count), 0)::integer
  FROM public.usage
  WHERE usage_date >= CURRENT_DATE - INTERVAL '7 days';
$function$;

create or replace function public.admin_daily_requests(days_back integer default 14)
returns table(usage_date date, total integer)
language sql
security definer
set search_path = ''
as $function$
  SELECT usage_date, COALESCE(SUM(count), 0)::integer AS total
  FROM public.usage
  WHERE usage_date >= CURRENT_DATE - (days_back || ' days')::interval
  GROUP BY usage_date
  ORDER BY usage_date ASC;
$function$;

-- Returns user emails. Keep service_role-only, always.
create or replace function public.admin_top_users(lim integer default 10)
returns table(user_id uuid, email text, total_requests bigint, is_pro boolean)
language sql
security definer
set search_path = ''
as $function$
  SELECT
    u.user_id,
    au.email,
    SUM(u.count) AS total_requests,
    EXISTS (
      SELECT 1 FROM public.pro_subscriptions ps
      WHERE ps.user_id = u.user_id AND ps.status = 'active'
        AND (ps.current_period_end IS NULL OR ps.current_period_end > now())
    ) AS is_pro
  FROM public.usage u
  JOIN auth.users au ON au.id = u.user_id
  WHERE u.usage_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY u.user_id, au.email
  ORDER BY total_requests DESC
  LIMIT lim;
$function$;

-- ─── Lock down execution ───────────────────────────────────────────────────
-- `create or replace` resets the ACL to the default (PUBLIC EXECUTE), so these
-- revokes MUST run after every definition above. Do not reorder.

revoke execute on function public.is_pro_user(uuid)             from public, anon, authenticated;
revoke execute on function public.admin_dau()                   from public, anon, authenticated;
revoke execute on function public.admin_total_users()           from public, anon, authenticated;
revoke execute on function public.admin_pro_count()             from public, anon, authenticated;
revoke execute on function public.admin_requests_today()        from public, anon, authenticated;
revoke execute on function public.admin_requests_week()         from public, anon, authenticated;
revoke execute on function public.admin_daily_requests(integer) from public, anon, authenticated;
revoke execute on function public.admin_top_users(integer)      from public, anon, authenticated;

grant execute on function public.is_pro_user(uuid)              to service_role;
grant execute on function public.admin_dau()                    to service_role;
grant execute on function public.admin_total_users()            to service_role;
grant execute on function public.admin_pro_count()              to service_role;
grant execute on function public.admin_requests_today()         to service_role;
grant execute on function public.admin_requests_week()          to service_role;
grant execute on function public.admin_daily_requests(integer)  to service_role;
grant execute on function public.admin_top_users(integer)       to service_role;
