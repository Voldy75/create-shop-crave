import { createServiceClient } from "@/lib/supabase/server";

/**
 * Provider registry — the DB-backed replacement for the hardcoded Swiggy
 * constants in lib/swiggy-oauth.ts (SWIGGY_BASE, SWIGGY_SCOPES) and
 * lib/swiggy-mcp.ts (SERVICE_URLS).
 *
 * Client SECRETS are never stored here. A provider row names the env var
 * holding its client id (`client_id_env`); the value is read from process.env
 * at use time, so the DB holds only public identifiers and endpoints.
 */

export interface McpProvider {
  id: string;
  name: string;
  enabled: boolean;
  authType: "oauth_pkce" | "api_key" | "none";
  authorizeBase: string | null;
  authorizePath: string;
  tokenPath: string;
  revokePath: string | null;
  scopes: string | null;
  clientIdEnv: string | null;
  icon: string | null;
  notes: string | null;
}

export interface McpServer {
  providerId: string;
  serviceKey: string;
  label: string | null;
  url: string;
  toolAllowlist: string[] | null;
  enabled: boolean;
}

const CACHE_TTL_MS = 60_000;

// App-wide config, not user-specific — safe to cache on a warm instance.
let providerCache: { value: McpProvider[]; at: number } | null = null;
let serverCache: { value: McpServer[]; at: number } | null = null;

export function invalidateMcpCache(): void {
  providerCache = null;
  serverCache = null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toProvider(r: any): McpProvider {
  return {
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    authType: r.auth_type,
    authorizeBase: r.authorize_base,
    authorizePath: r.authorize_path,
    tokenPath: r.token_path,
    revokePath: r.revoke_path,
    scopes: r.scopes,
    clientIdEnv: r.client_id_env,
    icon: r.icon,
    notes: r.notes,
  };
}

function toServer(r: any): McpServer {
  return {
    providerId: r.provider_id,
    serviceKey: r.service_key,
    label: r.label,
    url: r.url,
    toolAllowlist: r.tool_allowlist,
    enabled: r.enabled,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** All providers, including disabled ones (admin view). */
export async function listProviders(opts: { fresh?: boolean } = {}): Promise<McpProvider[]> {
  if (!opts.fresh && providerCache && Date.now() - providerCache.at < CACHE_TTL_MS) {
    return providerCache.value;
  }
  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("mcp_providers").select("*").order("sort");
  if (error || !data) {
    if (error) console.error("mcp registry: providers read failed:", error.message);
    return [];
  }
  const value = data.map(toProvider);
  providerCache = { value, at: Date.now() };
  return value;
}

/** All server endpoints, including those of disabled providers (admin view). */
export async function listServers(opts: { fresh?: boolean } = {}): Promise<McpServer[]> {
  if (!opts.fresh && serverCache && Date.now() - serverCache.at < CACHE_TTL_MS) {
    return serverCache.value;
  }
  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("mcp_provider_servers").select("*").order("sort");
  if (error || !data) {
    if (error) console.error("mcp registry: servers read failed:", error.message);
    return [];
  }
  const value = data.map(toServer);
  serverCache = { value, at: Date.now() };
  return value;
}

export async function getProvider(id: string): Promise<McpProvider | null> {
  return (await listProviders()).find((p) => p.id === id) ?? null;
}

/**
 * Providers that are switched on AND actually usable: they need at least one
 * enabled server endpoint, and (for OAuth providers) their client-id env var
 * must be set. A provider that is enabled but unconfigured would otherwise
 * produce confusing runtime failures instead of simply not appearing.
 */
export async function activeProviders(): Promise<McpProvider[]> {
  const [providers, servers] = await Promise.all([listProviders(), listServers()]);
  return providers.filter((p) => {
    if (!p.enabled) return false;
    const hasServer = servers.some((s) => s.providerId === p.id && s.enabled && s.url);
    if (!hasServer) return false;
    if (p.authType === "oauth_pkce") {
      if (!p.authorizeBase) return false;
      if (!p.clientIdEnv || !process.env[p.clientIdEnv]) return false;
    }
    return true;
  });
}

export async function serversFor(providerId: string): Promise<McpServer[]> {
  return (await listServers()).filter((s) => s.providerId === providerId && s.enabled);
}

/** Read a provider's client id from the env var its row names. */
export function clientIdFor(provider: McpProvider): string | null {
  if (!provider.clientIdEnv) return null;
  return process.env[provider.clientIdEnv] ?? null;
}
