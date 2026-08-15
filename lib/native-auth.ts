import type { SupabaseClient } from "@supabase/supabase-js";
import { isNative } from "@/lib/native-bridge";

/**
 * OAuth sign-in that works inside the native shell.
 *
 * THE PROBLEM THIS SOLVES — the single highest-risk unverified path in the
 * mobile app:
 *
 * Google refuses to render its consent screen inside an embedded WebView. It
 * returns `disallowed_useragent` and the user sees a dead end. This has been
 * Google's policy since 2021 and there is NO client-side workaround: you cannot
 * spoof your way out of it, and you should not try.
 *
 * The supported approach is to hand the OAuth hop to the SYSTEM browser —
 * SFSafariViewController on iOS, Custom Tabs on Android — which is what
 * @capacitor/browser opens. The provider redirects back to our custom scheme
 * (com.cravecreate.app://), the OS routes that to the app, Capacitor's
 * `appUrlOpen` fires, and we exchange the code for a session.
 *
 * On web this is a plain signInWithOAuth — nothing changes.
 *
 * ── REQUIRED DASHBOARD SETUP (this code cannot do it for you) ──────────────
 *   Supabase → Authentication → URL Configuration → Redirect URLs:
 *     add   com.cravecreate.app://auth/callback
 *   Without that entry Supabase rejects the redirect and sign-in fails on
 *   native with a confusing error. Verify this BEFORE blaming the code.
 */

export const NATIVE_REDIRECT_URL = "com.cravecreate.app://auth/callback";

export type OAuthProvider = "google" | "github";

/**
 * Start an OAuth sign-in appropriate to the runtime.
 *
 * Web:    normal redirect flow through /api/auth/callback.
 * Native: mint the authorize URL without navigating (skipBrowserRedirect),
 *         then open it in the system browser.
 *
 * `next` picks where /api/auth/callback lands the user after the exchange
 * (it defaults to /chat there). Mobile onboarding passes "/m?welcome=1" —
 * without it, finishing onboarding via the WEB flow (not the native app)
 * dropped the user into the web tree instead of back into /m. Native ignores
 * this entirely; initDeepLinks already routes native OAuth returns to /m.
 */
export async function signInWithProvider(
  supabase: SupabaseClient,
  provider: OAuthProvider,
  next?: string
): Promise<{ error?: string }> {
  if (!isNative()) {
    const callback = new URL("/api/auth/callback", window.location.origin);
    if (next) callback.searchParams.set("next", next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    });
    return error ? { error: error.message } : {};
  }

  // Native: ask Supabase for the URL but do NOT let the WebView navigate to it.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: NATIVE_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  });

  if (error) return { error: error.message };
  if (!data?.url) return { error: "no_authorize_url" };

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url, presentationStyle: "popover" });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "browser_open_failed" };
  }
}

/**
 * Complete a native OAuth return.
 *
 * Called from the appUrlOpen handler with the full custom-scheme URL. Supabase
 * PKCE puts `?code=...` on the redirect; some flows use the `#access_token=...`
 * fragment instead, so both are handled.
 *
 * Returns true when a session was established, so the caller knows whether to
 * navigate onward.
 */
export async function completeNativeAuth(
  supabase: SupabaseClient,
  url: string
): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Close the system browser sheet if it is still showing.
  const dismiss = async () => {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.close();
    } catch {
      /* already closed, or not native */
    }
  };

  const code = parsed.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    await dismiss();
    if (error) {
      console.error("native auth: code exchange failed:", error.message);
      return false;
    }
    return true;
  }

  // Implicit/fragment variant: #access_token=...&refresh_token=...
  const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
  if (hash) {
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      await dismiss();
      if (error) {
        console.error("native auth: setSession failed:", error.message);
        return false;
      }
      return true;
    }
  }

  return false;
}

/** Does this deep-link URL look like an OAuth return rather than a route? */
export function isAuthCallbackUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.pathname.includes("/auth/callback")) return true;
    if (u.searchParams.has("code")) return true;
    return u.hash.includes("access_token");
  } catch {
    return false;
  }
}
