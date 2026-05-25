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
 * browsers). Fully implemented in M3.
 */
export async function registerNativePush(): Promise<string | null> {
  if (!isNative()) return null;
  // M3: import @capacitor/push-notifications, request permission, register,
  // capture the token via the 'registration' listener, POST to
  // /api/notifications/native/register.
  return null;
}
