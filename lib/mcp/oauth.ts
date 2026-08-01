import { randomBytes, createHash } from "node:crypto";
import type { McpProvider } from "@/lib/mcp/registry";

/**
 * Provider-agnostic OAuth 2.1 + PKCE.
 *
 * Generalizes lib/swiggy-oauth.ts, which hardcoded SWIGGY_BASE and the
 * /auth/* paths. Endpoints now come from the provider row.
 *
 * We drive PKCE ourselves rather than using the MCP SDK's OAuthClientProvider
 * because we own the user model and redirect lifecycle (Next routes +
 * Supabase). The SDK handles tool calls; OAuth is ours.
 */

export interface PkcePair {
  verifier: string;
  challenge: string;
  state: string;
}

/** Fresh PKCE verifier + S256 challenge + CSRF state. */
export function newPkcePair(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export class McpOAuthError extends Error {
  constructor(
    public code: string,
    message?: string
  ) {
    super(message || code);
  }
}

function requireBase(provider: McpProvider): string {
  if (!provider.authorizeBase) {
    throw new McpOAuthError(
      "provider_not_configured",
      `${provider.id} has no authorize_base configured`
    );
  }
  return provider.authorizeBase.replace(/\/$/, "");
}

export function buildAuthorizeUrl(
  provider: McpProvider,
  opts: { clientId: string; redirectUri: string; challenge: string; state: string }
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
    state: opts.state,
  });
  if (provider.scopes) params.set("scope", provider.scopes);
  return `${requireBase(provider)}${provider.authorizePath}?${params.toString()}`;
}

export interface McpTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCodeForToken(
  provider: McpProvider,
  opts: { code: string; verifier: string; clientId: string; redirectUri: string }
): Promise<McpTokenResponse> {
  const res = await fetch(`${requireBase(provider)}${provider.tokenPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: opts.code,
      code_verifier: opts.verifier,
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new McpOAuthError(`token_exchange_failed (${res.status})`, errText.slice(0, 200));
  }
  return (await res.json()) as McpTokenResponse;
}

/** Best-effort revoke. Errors are non-fatal — tokens expire on their own. */
export async function revokeToken(provider: McpProvider, accessToken: string): Promise<void> {
  if (!provider.revokePath || !provider.authorizeBase) return;
  try {
    await fetch(`${requireBase(provider)}${provider.revokePath}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Provider may not honour revoke; the token expires regardless.
  }
}

/** Our callback URL for a given provider, derived from the running request. */
export function callbackUrlFor(req: Request, providerId: string): string {
  const u = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${u.protocol}//${u.host}`;
  const base = origin.replace(/\/$/, "");
  // Swiggy keeps its historical path: its redirect_uri is registered with the
  // provider and changing it would break the existing (already whitelisted)
  // registration. New providers use the generic path.
  return providerId === "swiggy"
    ? `${base}/api/swiggy/auth/callback`
    : `${base}/api/mcp/${providerId}/callback`;
}
