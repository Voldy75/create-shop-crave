/**
 * Browser-side push helpers. Used by the Settings page to:
 *   - Register the /sw.js service worker on demand
 *   - Subscribe / unsubscribe via the PushManager
 *   - Tell the server about the subscription
 *
 * Detection: returns false from isPushSupported() in browsers without
 * PushManager (notably stock iOS Safari without the PWA installed).
 */

import type { PushSubscriptionJSON } from "@/lib/types";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Allocate with an explicit ArrayBuffer (not SharedArrayBuffer) so the result
  // satisfies BufferSource for PushManager.subscribe's applicationServerKey.
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Full subscribe flow: register SW → request permission → subscribe → POST to server. */
export async function enableWebPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC) return { ok: false, reason: "missing_vapid" };

  if (Notification.permission === "denied") {
    return { ok: false, reason: "permission_denied" };
  }
  if (Notification.permission !== "granted") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return { ok: false, reason: "permission_dismissed" };
  }

  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }

  const json = sub.toJSON() as unknown as PushSubscriptionJSON;
  const res = await fetch("/api/notifications/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: json }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, reason: data.error || "server_failed" };
  }
  return { ok: true };
}

/** Full unsubscribe flow: revoke at browser, then tell server. */
export async function disableWebPush(): Promise<{ ok: boolean }> {
  if (isPushSupported()) {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  }
  await fetch("/api/notifications/push/unsubscribe", { method: "POST" });
  return { ok: true };
}

export async function sendTestPush(): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch("/api/notifications/push/test", { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, reason: data.message || data.error || "send_failed" };
  }
  return { ok: true };
}
