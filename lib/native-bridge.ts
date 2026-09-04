/**
 * Native bridge — single seam between the web frontend and Capacitor native
 * plugins. Every call feature-detects the runtime: native plugin when running
 * inside the Capacitor shell, web fallback otherwise. This lets the SAME
 * Next.js codebase serve both the browser PWA and the wrapped mobile app.
 *
 * Fully wired in M3. This M1 skeleton establishes the detection seam + the
 * API surface the screens will call, with web fallbacks so nothing breaks
 * while running as plain web.
 */

export function isNative(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor injects `window.Capacitor` in the native WebView.
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function nativePlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}

/**
 * Capture a meal photo. Native → @capacitor/camera; web → returns null so the
 * caller falls back to the existing <input type="file" capture> flow.
 * Returns a base64 data URL matching the /api/meals/analyze contract.
 *
 * M3 wires the real plugin import (dynamic, to keep it out of the web bundle).
 */
export async function captureMealPhoto(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 70,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      width: 1024,
    });
    return photo.dataUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Native share sheet. Native → @capacitor/share; web → Web Share API fallback.
 */
export async function shareContent(opts: { title?: string; text?: string; url?: string }): Promise<void> {
  if (isNative()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share(opts);
      return;
    } catch {
      /* fall through to web */
    }
  }
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share(opts);
    } catch {
      /* user cancelled */
    }
  }
}

/**
 * Register for native push (APNs/FCM) and hand the token to the server so the
 * daily-nudge cron can target it. Web returns null (web-push path handles
 * browsers). Resolves with the device token once the OS grants permission and
 * the 'registration' listener fires, or null if denied/unavailable.
 */
export async function registerNativePush(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const perm = await PushNotifications.checkPermissions();
    let receive = perm.receive;
    if (receive === "prompt" || receive === "prompt-with-rationale") {
      receive = (await PushNotifications.requestPermissions()).receive;
    }
    if (receive !== "granted") return null;

    // Wait for the registration event (token) — or registrationError.
    const token = await new Promise<string | null>((resolve) => {
      let settled = false;
      // addListener resolves to a handle; collect them so both are torn down
      // once we settle. Without this, every call (retry / prompt re-mount)
      // leaks two Capacitor listeners for the life of the native session.
      const handles: Promise<{ remove: () => unknown }>[] = [];
      const done = (v: string | null) => {
        if (settled) return;
        settled = true;
        for (const h of handles) h.then((handle) => handle.remove()).catch(() => {});
        resolve(v);
      };
      handles.push(PushNotifications.addListener("registration", (t) => done(t.value)));
      handles.push(PushNotifications.addListener("registrationError", () => done(null)));
      PushNotifications.register().catch(() => done(null));
      // Safety timeout so a silent failure doesn't hang the caller.
      setTimeout(() => done(null), 15000);
    });
    if (!token) return null;

    await fetch("/api/notifications/native/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: nativePlatform() }),
    });
    return token;
  } catch {
    return null;
  }
}

/**
 * Wire deep-link returns (OAuth callbacks, shared links) into client-side
 * navigation. Capacitor fires `appUrlOpen` when the app is opened via its
 * custom scheme (com.cravecreate.app://) or a universal link. We strip the
 * scheme/host and push the in-app path so Supabase/Swiggy OAuth bounces land
 * back inside the WebView instead of a dead external tab.
 *
 * `navigate` is the app's client navigator (e.g. Next's router.replace). Returns
 * a cleanup function. No-op on web.
 */
export async function initDeepLinks(navigate: (path: string) => void): Promise<() => void> {
  if (!isNative()) return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const handle = await App.addListener("appUrlOpen", ({ url }) => {
      // url looks like: com.cravecreate.app://auth/callback?code=... or https://host/path
      void (async () => {
        // OAuth returns must be EXCHANGED, not navigated to. Treating
        // ...://auth/callback?code=X as a route would push the user at a
        // non-existent page and silently drop the authorization code.
        const { isAuthCallbackUrl, completeNativeAuth } = await import("@/lib/native-auth");
        if (isAuthCallbackUrl(url)) {
          const { createClient } = await import("@/lib/supabase/client");
          const ok = await completeNativeAuth(createClient(), url);
          navigate(ok ? "/m" : "/m?error=auth_failed");
          return;
        }

        try {
          const u = new URL(url);
          const path = `${u.pathname}${u.search}${u.hash}` || "/m";
          navigate(path.startsWith("/") ? path : `/${path}`);
        } catch {
          /* unparseable url — ignore */
        }
      })();
    });
    return () => {
      handle.remove();
    };
  } catch {
    return () => {};
  }
}
