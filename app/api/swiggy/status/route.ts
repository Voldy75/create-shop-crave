import { requireUser } from "@/lib/auth-guard";
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
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

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
