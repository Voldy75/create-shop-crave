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
