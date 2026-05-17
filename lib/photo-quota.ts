import { createServiceClient } from "@/lib/supabase/server";
import { FREE_PHOTO_LIMIT } from "@/lib/constants";

interface PhotoUsageResult {
  allowed: boolean;
  count: number;
  remaining: number;
}

/**
 * Atomic check-and-increment for photo analysis quota.
 * Separate bucket from the chat rate-limit so heavy chat users still get photo capacity.
 * Fails open on infrastructure errors (matches `checkAndIncrementUsage` behavior).
 */
export async function checkAndIncrementPhotoUsage(userId: string): Promise<PhotoUsageResult> {
  const supabase = await createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase.rpc("check_and_increment_photo_usage", {
    p_user_id: userId,
    p_date: today,
    p_limit: FREE_PHOTO_LIMIT,
  });

  if (error) {
    // PGRST202 = function not found. If the migration hasn't been run, fail closed
    // so we don't grant unlimited free photo analyses until someone notices.
    if (error.code === "PGRST202") {
      console.error("Photo quota RPC missing — run scripts/sql/photo-usage.sql:", error.message);
      return { allowed: false, count: 0, remaining: 0 };
    }
    // Transient infrastructure errors — fail open to avoid blocking users.
    console.error("Photo quota check error:", error.message);
    return { allowed: true, count: 0, remaining: FREE_PHOTO_LIMIT };
  }

  const count = data?.count ?? 0;
  const allowed = data?.allowed ?? false;
  return {
    allowed,
    count,
    remaining: Math.max(0, FREE_PHOTO_LIMIT - count),
  };
}
