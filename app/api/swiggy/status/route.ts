import { requireUser } from "@/lib/auth-guard";
import { getProvider, clientIdFor } from "@/lib/mcp/registry";
import { getConnection, isExpired } from "@/lib/mcp/connections";

export const maxDuration = 5;

/**
 * Reports the current user's Swiggy connection state for the Settings UI.
 *   { connected: false }
 *   { connected: true, expiresAt, expiringWithin24h, expired }
 *
 * Doesn't leak the access token to the browser — just the metadata. (The
 * mcp_connections column grants enforce that at the DB level too, so even a
 * direct PostgREST read cannot return access_token.)
 */
export async function GET() {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  const provider = await getProvider("swiggy");
  const configured = Boolean(provider && clientIdFor(provider));

  const token = await getConnection(user.id, "swiggy");
  if (!token) {
    return Response.json({ connected: false, configured });
  }

  const expired = isExpired(token);
  const ms = new Date(token.expiresAt).getTime() - Date.now();
  return Response.json({
    connected: !expired,
    expiresAt: token.expiresAt,
    expiringWithin24h: !expired && ms < 24 * 60 * 60 * 1000,
    expired,
    configured,
  });
}
