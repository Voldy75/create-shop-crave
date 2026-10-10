import { requireUser } from "@/lib/auth-guard";
import { getProvider, resolveClientId } from "@/lib/mcp/registry";
import { buildAuthorizeUrl, callbackUrlFor, newPkcePair, McpOAuthError } from "@/lib/mcp/oauth";

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
 *
 * Endpoints and the client-id env var name now come from the mcp_providers
 * row rather than hardcoded constants. This route stays Swiggy-specific
 * because its redirect_uri is registered with Swiggy and changing the path
 * would invalidate that registration.
 */
export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;

  const provider = await getProvider("swiggy");
  if (!provider || !provider.authorizeBase) {
    return Response.json(
      { error: "not_configured", message: "Swiggy MCP isn't configured — admin needs to set it up." },
      { status: 503 }
    );
  }

  // The redirect URI must be settled BEFORE the client id, because Dynamic
  // Client Registration registers this exact URI as part of getting the id.
  const redirectUri = callbackUrlFor(req, provider.id);

  let clientId: string | null;
  try {
    clientId = await resolveClientId(provider, redirectUri);
  } catch (e) {
    // Registration was attempted and refused. This is NOT the same as "no
    // client id configured" and must not render as it — the likeliest cause is
    // that redirectUri is not on the provider's exact-match allowlist yet.
    const reason = e instanceof McpOAuthError ? e.code : "registration_failed";
    console.error("swiggy start:", reason, e instanceof Error ? e.message.slice(0, 200) : "");
    return Response.json(
      {
        error: reason,
        message:
          "Couldn't register with Swiggy. This usually means our redirect URL isn't allowlisted on their side yet.",
      },
      { status: 502 }
    );
  }
  if (!clientId) {
    return Response.json(
      {
        error: "not_configured",
        message: `Swiggy MCP isn't wired up yet — admin needs to set ${provider.clientIdEnv ?? "the client id env var"} or enable dynamic registration.`,
      },
      { status: 503 }
    );
  }

  const { verifier, challenge, state } = newPkcePair();
  const authorizeUrl = buildAuthorizeUrl(provider, { clientId, redirectUri, challenge, state });

  const cookieAttrs = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600";
  const headers = new Headers({ "Content-Type": "application/json" });
  // Both cookies are required at /callback to complete the flow.
  headers.append("Set-Cookie", `swiggy_pkce_verifier=${verifier}; ${cookieAttrs}`);
  headers.append("Set-Cookie", `swiggy_pkce_state=${state}; ${cookieAttrs}`);
  return new Response(JSON.stringify({ authorizeUrl }), { status: 200, headers });
}
