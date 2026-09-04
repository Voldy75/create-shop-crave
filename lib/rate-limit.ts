import { createServiceClient } from "@/lib/supabase/server";
import { DAILY_LIMIT } from "@/lib/constants";
import { resolveLimits, type ResolvedLimits } from "@/lib/limits";

interface UsageResult {
  allowed: boolean;
  count: number;
  /** null = unlimited */
  remaining: number | null;
  /** the limit actually applied; null = unlimited */
  limit: number | null;
}

function remainingFor(limit: number | null, count: number): number | null {
  return limit === null ? null : Math.max(0, limit - count);
}

/**
 * Atomically checks and increments chat usage for a user.
 *
 * The limit is now resolved per user (plan, admin override, or config default)
 * instead of being the compiled-in DAILY_LIMIT. This is what fixes the bug
 * where a paying customer was still capped at 2 requests/day: isProUser was
 * only ever consulted by /api/subscribe/status, never by a metered route.
 *
 * Failure behaviour is UNCHANGED: fail open, so an infrastructure hiccup does
 * not block users. resolveLimits() has its own fallback to lib/constants.ts, so
 * a config outage degrades to the old hardcoded limit rather than to unlimited.
 *
 * @param limits pass a pre-resolved result to avoid resolving twice in one request
 */
export async function checkAndIncrementUsage(
  userId: string,
  limits?: ResolvedLimits
): Promise<UsageResult> {
  const resolved = limits ?? (await resolveLimits(userId));
  const limit = resolved.chat;

  // Restricted/banned users resolve to 0. Short-circuit rather than calling the
  // RPC: at limit 0 every request would still insert a usage row, inflating the
  // counter for someone who is not being served at all.
  if (limit === 0) {
    return { allowed: false, count: 0, remaining: 0, limit: 0 };
  }

  const supabase = await createServiceClient();
  const today = new Date().toISOString().split("T")[0]; // UTC date YYYY-MM-DD

  const { data, error } = await supabase.rpc("check_and_increment_usage", {
    p_user_id: userId,
    p_date: today,
    p_limit: limit, // null = unlimited; the SQL function branches on NULL
  });

  if (error) {
    console.error("Rate limit check error:", error.message);
    // Fail open — don't block users during infrastructure hiccups.
    return { allowed: true, count: 0, remaining: remainingFor(limit, 0), limit };
  }

  const count = data?.count ?? 0;
  const allowed = data?.allowed ?? false;

  return { allowed, count, remaining: remainingFor(limit, count), limit };
}

/**
 * Gets current usage without incrementing (for display in UI).
 */
export async function getUsage(
  userId: string
): Promise<{ count: number; remaining: number | null; limit: number | null; planId: string }> {
  const resolved = await resolveLimits(userId);
  const supabase = await createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("usage")
    .select("count")
    .eq("user_id", userId)
    .eq("usage_date", today)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found (first request today)
    console.error("Usage fetch error:", error.message);
  }

  const count = data?.count ?? 0;
  return {
    count,
    remaining: remainingFor(resolved.chat, count),
    limit: resolved.chat,
    planId: resolved.planId,
  };
}

export { DAILY_LIMIT };
