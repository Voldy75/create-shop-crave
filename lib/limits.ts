import { createServiceClient } from "@/lib/supabase/server";
import { DAILY_LIMIT, FREE_PHOTO_LIMIT } from "@/lib/constants";

/**
 * Runtime-resolved quota limits.
 *
 * Replaces the compiled-in constants as the SOURCE of limits, while keeping
 * lib/constants.ts permanently as the last-resort floor. A config read failing
 * is not a reason to give the product away, so every failure path below lands
 * on the constants -- never on unlimited.
 *
 * `null` means unlimited. It must never be a large sentinel integer: with a
 * sentinel, a misconfigured 0 and an intended "unlimited" are indistinguishable
 * in the logs. The SQL functions understand NULL p_limit (see
 * scripts/sql/admin-console.sql).
 */

export type UserStatus = "active" | "restricted" | "banned";

export interface ResolvedLimits {
  /** null = unlimited, 0 = blocked */
  chat: number | null;
  photo: number | null;
  planId: string;
  status: UserStatus;
  /** where the numbers came from -- useful when debugging a quota complaint */
  source: "plan" | "config" | "fallback";
}

interface DefaultLimits {
  chat_daily: number;
  photo_daily: number;
}

interface PlanRow {
  id: string;
  chat_daily_limit: number | null;
  photo_daily_limit: number | null;
}

const CACHE_TTL_MS = 60_000;

// Module-scope caches. Config and plans are app-wide and change rarely, so a
// short TTL keeps the hot path to a single per-user query.
//
// User profiles are deliberately NOT cached: a ban must take effect on the next
// request, not up to a minute later.
let configCache: { value: DefaultLimits; at: number } | null = null;
let plansCache: { value: Map<string, PlanRow>; at: number } | null = null;

/** Compiled-in floor. Used whenever anything above it fails. */
function fallbackLimits(status: UserStatus = "active"): ResolvedLimits {
  return {
    chat: DAILY_LIMIT,
    photo: FREE_PHOTO_LIMIT,
    planId: "free",
    status,
    source: "fallback",
  };
}

/** Drop cached config/plans. Call after an admin edits either. */
export function invalidateLimitsCache(): void {
  configCache = null;
  plansCache = null;
}

async function loadDefaults(fresh = false): Promise<DefaultLimits> {
  if (!fresh && configCache && Date.now() - configCache.at < CACHE_TTL_MS) {
    return configCache.value;
  }
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "rate_limits.default")
    .maybeSingle();

  if (error || !data?.value) {
    if (error) console.error("resolveLimits: app_config read failed:", error.message);
    // Do not cache a failure -- retry on the next request.
    return { chat_daily: DAILY_LIMIT, photo_daily: FREE_PHOTO_LIMIT };
  }

  const value = data.value as Partial<DefaultLimits>;
  const resolved: DefaultLimits = {
    chat_daily: typeof value.chat_daily === "number" ? value.chat_daily : DAILY_LIMIT,
    photo_daily: typeof value.photo_daily === "number" ? value.photo_daily : FREE_PHOTO_LIMIT,
  };
  configCache = { value: resolved, at: Date.now() };
  return resolved;
}

async function loadPlans(fresh = false): Promise<Map<string, PlanRow>> {
  if (!fresh && plansCache && Date.now() - plansCache.at < CACHE_TTL_MS) {
    return plansCache.value;
  }
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("plans")
    .select("id, chat_daily_limit, photo_daily_limit")
    .eq("is_active", true);

  if (error || !data) {
    if (error) console.error("resolveLimits: plans read failed:", error.message);
    return new Map();
  }

  const map = new Map<string, PlanRow>(data.map((p) => [p.id, p as PlanRow]));
  plansCache = { value: map, at: Date.now() };
  return map;
}

/**
 * Resolve a user's effective limits.
 *
 * Precedence:
 *   1. app_config['rate_limits.default']
 *   2. effective plan: user_profiles.plan_id -> active pro subscription -> 'free'
 *   3. that plan's limits override the default (NULL column = unlimited)
 *   4. status 'restricted' or 'banned' forces { chat: 0, photo: 0 }
 *   5. any failure at all -> compiled-in constants, never unlimited
 *
 * @param opts.fresh bypass the config/plan cache -- used by the admin UI so an
 *   edit can be verified immediately rather than up to a minute later.
 */
export async function resolveLimits(
  userId: string,
  opts: { fresh?: boolean } = {}
): Promise<ResolvedLimits> {
  try {
    const supabase = await createServiceClient();

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("status, plan_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("resolveLimits: user_profiles read failed:", profileError.message);
      return fallbackLimits();
    }

    const status = (profile?.status ?? "active") as UserStatus;

    // Restricted keeps read access but spends no quota; banned is already
    // rejected by requireUser(), and is handled here too so a missed call site
    // fails safe rather than granting quota.
    if (status === "restricted" || status === "banned") {
      return { chat: 0, photo: 0, planId: profile?.plan_id ?? "free", status, source: "plan" };
    }

    // An explicit admin override wins; otherwise derive from a live paid
    // subscription. is_pro_user already encodes status='active' AND the
    // current_period_end check, so expiry is enforced for free.
    let planId = profile?.plan_id ?? null;
    if (!planId) {
      const { data: isPro, error: proError } = await supabase.rpc("is_pro_user", {
        p_user_id: userId,
      });
      if (proError) {
        console.error("resolveLimits: is_pro_user failed:", proError.message);
        return fallbackLimits(status);
      }
      planId = isPro === true ? "pro" : "free";
    }

    const [defaults, plans] = await Promise.all([
      loadDefaults(opts.fresh),
      loadPlans(opts.fresh),
    ]);

    const plan = plans.get(planId);
    if (!plan) {
      // Plan row missing or inactive -- fall back to the configured default
      // rather than assuming unlimited.
      return {
        chat: defaults.chat_daily,
        photo: defaults.photo_daily,
        planId,
        status,
        source: "config",
      };
    }

    // A NULL column here is meaningful: it means unlimited. Only the absence of
    // the whole row falls back to defaults (handled above).
    return {
      chat: plan.chat_daily_limit,
      photo: plan.photo_daily_limit,
      planId,
      status,
      source: "plan",
    };
  } catch (err) {
    console.error("resolveLimits: unexpected failure:", err);
    return fallbackLimits();
  }
}
