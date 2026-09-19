import { createServiceClient } from "@/lib/supabase/server";
import { FREE_PHOTO_LIMIT } from "@/lib/constants";
import { resolveLimits, type ResolvedLimits } from "@/lib/limits";

interface PhotoUsageResult {
  allowed: boolean;
  count: number;
  /** null = unlimited */
  remaining: number | null;
  limit: number | null;
}

/**
 * Atomic check-and-increment for photo analysis quota.
 * Separate bucket from the chat rate-limit so heavy chat users still get photo
 * capacity.
 *
 * The limit is now resolved per user rather than compiled in, but the FAILURE
 * SEMANTICS ARE UNCHANGED AND DELIBERATELY ASYMMETRIC versus the chat bucket:
 *
 *   - PGRST202 (function missing) -> fail CLOSED, so a missing migration cannot
 *     silently grant unlimited free photo analyses.
 *   - any other error            -> fail OPEN, matching checkAndIncrementUsage.
 *
 * Harmonizing these two behaviours is a real question, but doing it in the same
 * change as the DB-driven limits would make any resulting regression
 * unbisectable. It is deferred behind app_config['limits.fail_mode'].
 *
 * @param limits pass a pre-resolved result to avoid resolving twice in one request
 */
export async function checkAndIncrementPhotoUsage(
  userId: string,
  limits?: ResolvedLimits
): Promise<PhotoUsageResult> {
  const resolved = limits ?? (await resolveLimits(userId));
  const limit = resolved.photo;

  // Restricted/banned users resolve to 0 — short-circuit before touching the
  // counter (same reasoning as the chat bucket).
  if (limit === 0) {
    return { allowed: false, count: 0, remaining: 0, limit: 0 };
  }

  const supabase = await createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase.rpc("check_and_increment_photo_usage", {
    p_user_id: userId,
    p_date: today,
    p_limit: limit, // null = unlimited; the SQL function branches on NULL
  });

  if (error) {
    // PGRST202 = function not found. If the migration hasn't been run, fail
    // closed so we don't grant unlimited free photo analyses until someone
    // notices.
    if (error.code === "PGRST202") {
      console.error("Photo quota RPC missing — run scripts/sql/photo-usage.sql:", error.message);
      return { allowed: false, count: 0, remaining: 0, limit };
    }
    // Transient infrastructure errors — fail open to avoid blocking users.
    console.error("Photo quota check error:", error.message);
    return {
      allowed: true,
      count: 0,
      remaining: limit === null ? null : limit,
      limit,
    };
  }

  const count = data?.count ?? 0;
  const allowed = data?.allowed ?? false;
  return {
    allowed,
    count,
    remaining: limit === null ? null : Math.max(0, limit - count),
    limit,
  };
}

export { FREE_PHOTO_LIMIT };
