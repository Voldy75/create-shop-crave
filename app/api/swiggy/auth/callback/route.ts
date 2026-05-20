import { createClient } from "@/lib/supabase/server";
import { callbackUrlFor, exchangeCodeForToken, SwiggyOAuthError } from "@/lib/swiggy-oauth";
import { persistToken } from "@/lib/swiggy-mcp";

export const maxDuration = 10;

/**
 * OAuth 2.1 PKCE callback for Swiggy MCP.
 *
 * Receives ?code=<auth-code>&state=<csrf-token> from mcp.swiggy.com/auth/authorize.
 * Verifies state, swaps code for access_token via /auth/token, persists the
 * token in swiggy_tokens (service role), and redirects to /settings/notifications
 * with a status flag for the UI.
 *
 * Errors render an HTML page rather than JSON so the user-agent shows something
 * useful — they got here from a browser redirect, not a JS fetch.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  const error = u.searchParams.get("error");

  // Swiggy can bounce back with ?error=access_denied if the user cancels.
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

  const clientId = process.env.SWIGGY_CLIENT_ID;
  if (!clientId) {
    return redirectToSettings("error=not_configured");
  }

  // Auth the user — we attribute the token to whoever's signed in right now.
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return redirectToSettings("error=not_signed_in");
  }

  try {
    const token = await exchangeCodeForToken({
      code,
      verifier,
      clientId,
      redirectUri: callbackUrlFor(req),
    });
    await persistToken(user.id, {
      accessToken: token.access_token,
      tokenType: token.token_type,
      scope: token.scope,
      expiresInSec: token.expires_in,
    });
  } catch (e) {
    const reason = e instanceof SwiggyOAuthError ? e.code : "exchange_failed";
    console.error("swiggy callback:", reason, e instanceof Error ? e.message.slice(0, 200) : "");
    return redirectToSettings(`error=${encodeURIComponent(reason)}`);
  }

  return redirectToSettings("connected=1", true);
}

function redirectToSettings(query: string, clearCookies = false): Response {
  const target = `/settings/notifications?${query}`;
  const headers = new Headers({ Location: target });
  if (clearCookies) {
    headers.append("Set-Cookie", `swiggy_pkce_verifier=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    headers.append("Set-Cookie", `swiggy_pkce_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  }
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
