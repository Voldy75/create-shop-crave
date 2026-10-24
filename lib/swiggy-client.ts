/**
 * Browser-side helpers for the Swiggy MCP connection flow. Used by the
 * Settings page to start OAuth, query status, and disconnect.
 */

export interface SwiggyStatus {
  connected: boolean;
  configured?: boolean;
  expiresAt?: string;
  expiringWithin24h?: boolean;
  expired?: boolean;
}

export async function getSwiggyStatus(): Promise<SwiggyStatus | null> {
  const res = await fetch("/api/swiggy/status");
  if (!res.ok) return null;
  return (await res.json()) as SwiggyStatus;
}

/** `surface` decides where the OAuth callback lands afterwards: the web
 *  settings screen, or the mobile Connections screen. */
export async function startSwiggyAuth(surface: "web" | "mobile" = "web"): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch("/api/swiggy/auth/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surface }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.authorizeUrl) {
    return { ok: false, reason: data.message || data.error || "auth_start_failed" };
  }
  // Hand the user off to Swiggy. The callback lands at /api/swiggy/auth/callback
  // → 303 redirect back to /settings/notifications (web) or
  // /m/settings/connections (mobile) with ?connected=1 or ?error=...
  window.location.href = data.authorizeUrl;
  return { ok: true };
}

export async function disconnectSwiggy(): Promise<{ ok: boolean }> {
  await fetch("/api/swiggy/auth/disconnect", { method: "POST" });
  return { ok: true };
}
