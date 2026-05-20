import { createClient } from "@/lib/supabase/server";
import { getStoredToken, isExpired } from "@/lib/swiggy-mcp";

export const maxDuration = 5;

/**
 * Reports the current user's Swiggy connection state for the Settings UI.
 *   { connected: false }
 *   { connected: true, expiresAt, expiringWithin24h, expired }
 *
 * Doesn't leak the access token to the browser — just the metadata.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getStoredToken(user.id);
  if (!token) {
    return Response.json({
      connected: false,
      configured: Boolean(process.env.SWIGGY_CLIENT_ID),
    });
  }

  const expired = isExpired(token);
  const ms = new Date(token.expiresAt).getTime() - Date.now();
  return Response.json({
    connected: !expired,
    expiresAt: token.expiresAt,
    expiringWithin24h: !expired && ms < 24 * 60 * 60 * 1000,
    expired,
    configured: true,
  });
}
