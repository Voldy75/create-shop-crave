import { createServiceClient } from "@/lib/supabase/server";
import { refreshAccessToken } from "@/lib/mcp/oauth";
import { resolveClientId, type McpProvider } from "@/lib/mcp/registry";

/**
 * Per-user MCP tokens — the provider-agnostic replacement for the
 * swiggy_tokens helpers in lib/swiggy-mcp.ts.
 *
 * swiggy_tokens is left in place and readable for one release, but is no longer
 * written to. Drop it after that.
 */

export interface McpConnection {
  providerId: string;
  accessToken: string;
  tokenType: string;
  scope: string | null;
  expiresAt: string; // ISO
  grantedAt: string; // ISO
  /** Present only when the provider issued one. NULL = re-auth on expiry. */
  refreshToken: string | null;
}

/** Read a user's stored token for one provider (service role — bypasses RLS). */
export async function getConnection(
  userId: string,
  providerId: string
): Promise<McpConnection | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("mcp_connections")
    .select("provider_id, access_token, token_type, scope, expires_at, granted_at, refresh_token")
    .eq("user_id", userId)
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) {
    if (error.code !== "PGRST116") console.error("getConnection:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    providerId: data.provider_id,
    accessToken: data.access_token,
    tokenType: data.token_type,
    scope: data.scope,
    expiresAt: data.expires_at,
    grantedAt: data.granted_at,
    refreshToken: data.refresh_token ?? null,
  };
}

/** All of a user's connections. Used by the agent to fan out across providers. */
export async function listConnections(userId: string): Promise<McpConnection[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("mcp_connections")
    .select("provider_id, access_token, token_type, scope, expires_at, granted_at, refresh_token")
    .eq("user_id", userId);

  if (error) {
    console.error("listConnections:", error.message);
    return [];
  }
  return (data ?? []).map((d) => ({
    providerId: d.provider_id,
    accessToken: d.access_token,
    tokenType: d.token_type,
    scope: d.scope,
    expiresAt: d.expires_at,
    grantedAt: d.granted_at,
    refreshToken: d.refresh_token ?? null,
  }));
}

/** Has this connection expired (or is it missing)? */
export function isExpired(conn: McpConnection | null): boolean {
  if (!conn) return true;
  return new Date(conn.expiresAt).getTime() < Date.now();
}

/** Persist a freshly-issued token. Called from an OAuth callback route. */
export async function persistConnection(
  userId: string,
  providerId: string,
  token: {
    accessToken: string;
    tokenType: string;
    scope: string;
    expiresInSec: number;
    refreshToken?: string | null;
  }
): Promise<void> {
  const supabase = await createServiceClient();
  const expiresAt = new Date(Date.now() + token.expiresInSec * 1000).toISOString();
  const { error } = await supabase.from("mcp_connections").upsert(
    {
      user_id: userId,
      provider_id: providerId,
      access_token: token.accessToken,
      token_type: token.tokenType,
      scope: token.scope,
      expires_at: expiresAt,
      granted_at: new Date().toISOString(),
      // Only overwrite when we actually got one. A refresh that returns no new
      // refresh_token (common — many servers rotate only sometimes) must not
      // blank the one we already hold, or the next expiry forces a full
      // re-auth for no reason.
      ...(token.refreshToken ? { refresh_token: token.refreshToken } : {}),
    },
    { onConflict: "user_id,provider_id" }
  );
  if (error) throw new Error(`persistConnection: ${error.message}`);
}

/** Remove a stored connection. */
export async function deleteConnection(userId: string, providerId: string): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("mcp_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider_id", providerId);
  if (error) console.error("deleteConnection:", error.message);
}

/**
 * A usable (non-expired) connection, refreshing it in place when possible.
 *
 * The three outcomes are kept DISTINCT on purpose. "never connected" and
 * "expired" produce different user-facing copy in the agent route, and
 * collapsing them (as an earlier draft of this did) tells a first-time user
 * their session expired.
 *
 * Refresh is best-effort by design: Swiggy's docs claim v1 issues no refresh
 * tokens while its live metadata advertises the grant, so this has to behave
 * correctly whether or not a refresh token is ever present. No refresh token,
 * and a refused refresh, both fall through to null.
 */
export type FreshConnection =
  /** Usable now — either it had not expired, or we refreshed it. */
  | { status: "ok"; connection: McpConnection }
  /** This user has never connected this provider. */
  | { status: "none" }
  /** Connected once, but the grant is dead and cannot be renewed silently. */
  | { status: "expired" };

export async function ensureFreshConnection(
  userId: string,
  provider: McpProvider,
  redirectUri: string
): Promise<FreshConnection> {
  const conn = await getConnection(userId, provider.id);
  if (!conn) return { status: "none" };
  if (!isExpired(conn)) return { status: "ok", connection: conn };
  if (!conn.refreshToken) return { status: "expired" };

  let clientId: string | null = null;
  try {
    clientId = await resolveClientId(provider, redirectUri);
  } catch {
    return { status: "expired" };
  }
  if (!clientId) return { status: "expired" };

  const token = await refreshAccessToken(provider, {
    refreshToken: conn.refreshToken,
    clientId,
  });
  if (!token) return { status: "expired" };

  await persistConnection(userId, provider.id, {
    accessToken: token.access_token,
    tokenType: token.token_type,
    scope: token.scope,
    expiresInSec: token.expires_in,
    refreshToken: token.refresh_token ?? null,
  });
  const renewed = await getConnection(userId, provider.id);
  return renewed ? { status: "ok", connection: renewed } : { status: "expired" };
}
