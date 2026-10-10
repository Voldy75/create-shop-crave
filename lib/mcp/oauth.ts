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
  /**
   * Optional. Swiggy's prose docs say refresh tokens are "not wired in v1.0",
   * but its live discovery document lists refresh_token in
   * grant_types_supported and /auth/register echoes it back as accepted. The
   * docs lag the server, so we read it when present and degrade to full
   * re-auth when it is absent.
   */
  refresh_token?: string;
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

export interface DcrResult {
  clientId: string;
  /** Unix seconds, when the provider reports it. */
  issuedAt: number | null;
}

/**
 * RFC 7591 Dynamic Client Registration.
 *
 * Swiggy issues no client id to apply for — the docs say so verbatim and the
 * discovery document advertises a registration_endpoint. Measured against the
 * live server: POST /auth/register returns 201 with client_id "swiggy-mcp",
 * token_endpoint_auth_method "none", and NO client_secret.
 *
 * Two deliberate choices:
 *  - We send token_endpoint_auth_method "none" because we are a public client
 *    proving ourselves with PKCE, and we never want to be issued a secret we
 *    would then have to store.
 *  - We do NOT hardcode the returned id even though it is currently a fixed
 *    shared value. It is the provider's to change, and a hardcoded copy would
 *    fail silently and confusingly the day it does.
 */
export async function registerClient(
  provider: McpProvider,
  redirectUri: string
): Promise<DcrResult> {
  if (!provider.registrationPath) {
    throw new McpOAuthError(
      "dcr_unsupported",
      `${provider.id} has no registration_path — its client id must come from an env var`
    );
  }
  const res = await fetch(`${requireBase(provider)}${provider.registrationPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Crave & Create",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "web",
      ...(provider.scopes ? { scope: provider.scopes } : {}),
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new McpOAuthError(`registration_failed (${res.status})`, errText.slice(0, 200));
  }
  const body = (await res.json()) as { client_id?: string; client_id_issued_at?: number };
  if (!body.client_id) {
    throw new McpOAuthError("registration_no_client_id", "register returned no client_id");
  }
  return { clientId: body.client_id, issuedAt: body.client_id_issued_at ?? null };
}

/**
 * Refresh an access token. Returns null when the provider rejects the refresh
 * token (revoked, expired, or never really supported) so callers can fall back
 * to a full re-auth instead of surfacing a hard error to the user.
 */
export async function refreshAccessToken(
  provider: McpProvider,
  opts: { refreshToken: string; clientId: string }
): Promise<McpTokenResponse | null> {
  const res = await fetch(`${requireBase(provider)}${provider.tokenPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: opts.refreshToken,
      client_id: opts.clientId,
    }),
  });
  if (!res.ok) return null;
  return (await res.json()) as McpTokenResponse;
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
