/**
 * Swiggy MCP OAuth 2.1 + PKCE flow.
 *
 * Spec (verbatim from https://mcp.swiggy.com/builders/docs/start/authenticate/):
 *  - Base:   https://mcp.swiggy.com
 *  - Authorize: GET  /auth/authorize?response_type=code&client_id=...&redirect_uri=...
 *               &code_challenge=...&code_challenge_method=S256&state=...&scope=mcp:tools
 *  - Token:     POST /auth/token   (JSON body, exchange code for access_token)
 *  - Logout:    POST /auth/logout  (revoke)
 *  - JWT bearer, 5-day expiry, NO refresh tokens in v1.0.
 *
 * We do the PKCE dance ourselves rather than via @modelcontextprotocol/sdk's
 * OAuthClientProvider because we own the user model + redirect lifecycle
 * (Next.js routes + Supabase). The MCP SDK handles tool calls; OAuth is ours.
 */

import { randomBytes, createHash } from "node:crypto";

export const SWIGGY_BASE = "https://mcp.swiggy.com";

export const SWIGGY_SCOPES = ["mcp:tools", "mcp:resources", "mcp:prompts"].join(" ");

export interface PkcePair {
  verifier: string;
  challenge: string;
  state: string;
}

/** Generate a fresh PKCE verifier + S256 challenge + CSRF state. */
export function newPkcePair(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

/** Build the Swiggy authorize URL with PKCE + state. */
export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
  scope?: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
    state: opts.state,
    scope: opts.scope ?? SWIGGY_SCOPES,
  });
  return `${SWIGGY_BASE}/auth/authorize?${params.toString()}`;
}

export interface SwiggyTokenResponse {
  access_token: string;
  token_type: string; // "Bearer"
  expires_in: number; // seconds, ~432000 (5 days)
  scope: string;
}

/** Exchange an authorization code for an access token. */
export async function exchangeCodeForToken(opts: {
  code: string;
  verifier: string;
  clientId: string;
  redirectUri: string;
}): Promise<SwiggyTokenResponse> {
  const res = await fetch(`${SWIGGY_BASE}/auth/token`, {
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
    throw new SwiggyOAuthError(
      `token_exchange_failed (${res.status})`,
      errText.slice(0, 200),
    );
  }
  return (await res.json()) as SwiggyTokenResponse;
}

/** Revoke a token at Swiggy's /auth/logout (best-effort, errors are non-fatal). */
export async function revokeToken(accessToken: string): Promise<void> {
  try {
    await fetch(`${SWIGGY_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Swiggy may not respond well to revoke; the token expires in 5 days regardless.
  }
}

export class SwiggyOAuthError extends Error {
  constructor(public code: string, message?: string) {
    super(message || code);
  }
}

/** Derive our callback URL from the running request. */
export function callbackUrlFor(req: Request): string {
  const u = new URL(req.url);
  // Honor the canonical origin from env if set (handles preview vs prod).
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${u.protocol}//${u.host}`;
  return `${origin.replace(/\/$/, "")}/api/swiggy/auth/callback`;
}
