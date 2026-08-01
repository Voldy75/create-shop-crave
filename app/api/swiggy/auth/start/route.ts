import { requireUser } from "@/lib/auth-guard";
import { buildAuthorizeUrl, callbackUrlFor, newPkcePair } from "@/lib/swiggy-oauth";

export const maxDuration = 10;

/**
 * Initiates Swiggy OAuth. Steps:
 *   1. Generate PKCE verifier + S256 challenge + CSRF state.
 *   2. Save (verifier, state) in HttpOnly cookies (10-min TTL).
 *   3. Return the authorize URL — the client-side button does the redirect
 *      so we don't trigger a server-to-server bounce.
 *
 * Cookies (instead of a DB row) keep this stateless and avoid having to
 * clean up abandoned auth attempts.
 */
export async function POST(req: Request) {
  const clientId = process.env.SWIGGY_CLIENT_ID;
  if (!clientId) {
    return Response.json(
      { error: "not_configured", message: "Swiggy MCP isn't wired up yet — admin needs to set SWIGGY_CLIENT_ID." },
      { status: 503 },
    );
  }

  const guard = await requireUser();
  if (guard instanceof Response) return guard;

  const { verifier, challenge, state } = newPkcePair();
  const redirectUri = callbackUrlFor(req);
  const authorizeUrl = buildAuthorizeUrl({ clientId, redirectUri, challenge, state });

  const cookieAttrs = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600";
  const headers = new Headers({ "Content-Type": "application/json" });
  // Both cookies are required at /callback to complete the flow.
  headers.append("Set-Cookie", `swiggy_pkce_verifier=${verifier}; ${cookieAttrs}`);
  headers.append("Set-Cookie", `swiggy_pkce_state=${state}; ${cookieAttrs}`);
  return new Response(JSON.stringify({ authorizeUrl }), { status: 200, headers });
}
