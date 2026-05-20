/**
 * Swiggy MCP client factory.
 *
 * Mints a connected MCP client for one of the three Swiggy servers (food /
 * im / dineout) using a previously-stored user OAuth access token. The
 * agent route at /api/agent uses this to list and call tools on behalf of
 * the signed-in user.
 *
 * Spec (verbatim from Swiggy docs):
 *   POST mcp.swiggy.com/food       — 14 tools
 *   POST mcp.swiggy.com/im         — 13 tools (Instamart)
 *   POST mcp.swiggy.com/dineout    — 8 tools
 *
 * Transport: Streamable HTTP. We pass the bearer token via requestInit
 * headers; Swiggy's MCP server checks Authorization on each call.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServiceClient } from "@/lib/supabase/server";

export type SwiggyService = "food" | "im" | "dineout";

const SERVICE_URLS: Record<SwiggyService, string> = {
  food: "https://mcp.swiggy.com/food",
  im: "https://mcp.swiggy.com/im",
  dineout: "https://mcp.swiggy.com/dineout",
};

export interface StoredSwiggyToken {
  accessToken: string;
  tokenType: string;
  scope: string | null;
  expiresAt: string; // ISO
  grantedAt: string; // ISO
}

/** Read the user's stored Swiggy token via service role (bypasses RLS). */
export async function getStoredToken(userId: string): Promise<StoredSwiggyToken | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("swiggy_tokens")
    .select("access_token, token_type, scope, expires_at, granted_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (error.code !== "PGRST116") console.error("getStoredToken:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    scope: data.scope,
    expiresAt: data.expires_at,
    grantedAt: data.granted_at,
  };
}

/** Has the user's token expired (or is missing)? */
export function isExpired(token: StoredSwiggyToken | null): boolean {
  if (!token) return true;
  return new Date(token.expiresAt).getTime() < Date.now();
}

/** Connect to one of the three Swiggy MCP servers with the user's token. */
export async function connectSwiggy(
  service: SwiggyService,
  accessToken: string,
): Promise<Client> {
  const url = new URL(SERVICE_URLS[service]);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
  const client = new Client(
    { name: "crave-and-create", version: "0.1.0" },
    { capabilities: {} },
  );
  await client.connect(transport);
  return client;
}

/**
 * Helper for the agent: open clients for all three services (or a subset),
 * return a {service: Client} map. Caller must close them when done.
 */
export async function connectAll(
  accessToken: string,
  services: SwiggyService[] = ["food", "im", "dineout"],
): Promise<Partial<Record<SwiggyService, Client>>> {
  const out: Partial<Record<SwiggyService, Client>> = {};
  await Promise.all(
    services.map(async (s) => {
      try {
        out[s] = await connectSwiggy(s, accessToken);
      } catch (err) {
        console.error(`connectSwiggy(${s}) failed:`, err instanceof Error ? err.message.slice(0, 200) : err);
      }
    }),
  );
  return out;
}

/** Best-effort close of all open MCP clients. */
export async function closeAll(clients: Partial<Record<SwiggyService, Client>>): Promise<void> {
  await Promise.all(
    Object.values(clients).map(async (c) => {
      try {
        await c?.close();
      } catch {
        // ignore close errors
      }
    }),
  );
}

/** Persist a freshly-issued token. Called from the OAuth callback route. */
export async function persistToken(
  userId: string,
  token: { accessToken: string; tokenType: string; scope: string; expiresInSec: number },
): Promise<void> {
  const supabase = await createServiceClient();
  const expiresAt = new Date(Date.now() + token.expiresInSec * 1000).toISOString();
  const { error } = await supabase
    .from("swiggy_tokens")
    .upsert(
      {
        user_id: userId,
        access_token: token.accessToken,
        token_type: token.tokenType,
        scope: token.scope,
        expires_at: expiresAt,
        granted_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`persistToken: ${error.message}`);
}

/** Drop the user's token. */
export async function clearToken(userId: string): Promise<void> {
  const supabase = await createServiceClient();
  await supabase.from("swiggy_tokens").delete().eq("user_id", userId);
}
