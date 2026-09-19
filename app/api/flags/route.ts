import { createClient } from "@/lib/supabase/server";

export const maxDuration = 5;

/**
 * Public feature-flag read.
 *
 * Split out of GET /api/admin/flags, which was unauthenticated AND used the
 * service client -- the combination (world-readable RLS policy + service-role
 * read + unguarded route) is the exact pattern that would have leaked
 * app_config once that table existed.
 *
 * This route uses the ANON client instead, so the feature_flags RLS policy
 * (`for select using (true)` -- flags are app-wide config, not secrets) is what
 * actually governs access, rather than being bypassed. /api/admin/flags is now
 * admin-only for every verb.
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("id, enabled")
    .order("id");

  if (error) {
    console.error("flags read failed:", error.message);
    // Fail soft: an empty list means every flag reads as false, which is the
    // safe default for gating unreleased functionality.
    return Response.json({ flags: [] }, { status: 200 });
  }

  return Response.json({ flags: data ?? [] });
}
