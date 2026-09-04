import { createServiceClient } from "@/lib/supabase/server";

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
}

/** Read a user's stored token for one provider (service role — bypasses RLS). */
export async function getConnection(
  userId: string,
  providerId: string
): Promise<McpConnection | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("mcp_connections")
    .select("provider_id, access_token, token_type, scope, expires_at, granted_at")
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
  };
}

/** All of a user's connections. Used by the agent to fan out across providers. */
export async function listConnections(userId: string): Promise<McpConnection[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("mcp_connections")
    .select("provider_id, access_token, token_type, scope, expires_at, granted_at")
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
  token: { accessToken: string; tokenType: string; scope: string; expiresInSec: number }
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
