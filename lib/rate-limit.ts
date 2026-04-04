import { createServiceClient } from "@/lib/supabase/server";
import { DAILY_LIMIT } from "@/lib/constants";

interface UsageResult {
  allowed: boolean;
  count: number;
  remaining: number;
}

/**
 * Atomically checks and increments usage for a user.
 * Only increments if the user is under the daily limit.
 * Rejected requests do NOT increment the counter.
 *
 * Uses a conditional upsert:
 *   - First request today: inserts row with count=1
 *   - Subsequent requests under limit: increments count
 *   - Requests at/over limit: no-op update, returns current count
 */
export async function checkAndIncrementUsage(userId: string): Promise<UsageResult> {
  const supabase = await createServiceClient();
  const today = new Date().toISOString().split("T")[0]; // UTC date YYYY-MM-DD

  const { data, error } = await supabase.rpc("check_and_increment_usage", {
    p_user_id: userId,
    p_date: today,
    p_limit: DAILY_LIMIT,
  });

  if (error) {
    console.error("Rate limit check error:", error.message);
    // Fail open — don't block users during infrastructure hiccups
    return { allowed: true, count: 0, remaining: DAILY_LIMIT };
  }

  const count = data?.count ?? 0;
  const allowed = data?.allowed ?? false;

  return {
    allowed,
    count,
    remaining: Math.max(0, DAILY_LIMIT - count),
  };
}

/**
 * Gets current usage without incrementing (for display in UI).
 */
export async function getUsage(userId: string): Promise<{ count: number; remaining: number }> {
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
  return { count, remaining: Math.max(0, DAILY_LIMIT - count) };
}

export { DAILY_LIMIT } from "@/lib/constants";
