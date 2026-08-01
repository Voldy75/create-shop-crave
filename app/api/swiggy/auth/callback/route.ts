import { createClient } from "@/lib/supabase/server";
import { getProvider, clientIdFor } from "@/lib/mcp/registry";
import { callbackUrlFor, exchangeCodeForToken, McpOAuthError } from "@/lib/mcp/oauth";
import { persistConnection } from "@/lib/mcp/connections";

export const maxDuration = 10;

/**
 * OAuth 2.1 PKCE callback for Swiggy MCP.
 *
 * Receives ?code=<auth-code>&state=<csrf-token> from the provider's authorize
 * endpoint. Verifies state, swaps code for access_token, persists into
 * mcp_connections (service role), and redirects to /settings/notifications
 * with a status flag for the UI.
 *
 * Errors redirect rather than returning JSON — the user got here from a
 * browser redirect, not a fetch.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  const error = u.searchParams.get("error");

  // The provider can bounce back with ?error=access_denied if the user cancels.
  if (error) {
    return redirectToSettings(`error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return redirectToSettings("error=missing_params");
  }

  // Look up the PKCE verifier + state we stashed in /auth/start.
  const cookies = parseCookies(req.headers.get("cookie") || "");
  const verifier = cookies["swiggy_pkce_verifier"];
  const expectedState = cookies["swiggy_pkce_state"];
  if (!verifier || !expectedState) {
    return redirectToSettings("error=missing_session");
  }
  if (state !== expectedState) {
    return redirectToSettings("error=state_mismatch");
  }

  const provider = await getProvider("swiggy");
  if (!provider) {
    return redirectToSettings("error=not_configured");
  }
  const clientId = clientIdFor(provider);
  if (!clientId) {
    return redirectToSettings("error=not_configured");
  }

  // Auth the user — we attribute the token to whoever's signed in right now.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return redirectToSettings("error=not_signed_in");
  }

  try {
    const token = await exchangeCodeForToken(provider, {
      code,
      verifier,
      clientId,
      redirectUri: callbackUrlFor(req, provider.id),
    });
    await persistConnection(user.id, provider.id, {
      accessToken: token.access_token,
      tokenType: token.token_type,
      scope: token.scope,
      expiresInSec: token.expires_in,
    });
  } catch (e) {
    const reason = e instanceof McpOAuthError ? e.code : "exchange_failed";
    console.error("swiggy callback:", reason, e instanceof Error ? e.message.slice(0, 200) : "");
    return redirectToSettings(`error=${encodeURIComponent(reason)}`);
  }

  return redirectToSettings("connected=1");
}

/**
 * Always clears the PKCE cookies. They are single-use by definition, and
 * leaving them behind on the error paths (as this previously did) means a
 * stale verifier/state pair lingers for the full 10-minute TTL.
 */
function redirectToSettings(query: string): Response {
  const target = `/settings/notifications?${query}`;
  const headers = new Headers({ Location: target });
  const clear = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
  headers.append("Set-Cookie", `swiggy_pkce_verifier=; ${clear}`);
  headers.append("Set-Cookie", `swiggy_pkce_state=; ${clear}`);
  return new Response(null, { status: 303, headers });
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(/;\s*/)) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}
