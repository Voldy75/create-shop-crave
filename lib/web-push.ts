/**
 * Server-side web push helper. Wraps the web-push package with our VAPID
 * config and a single sendPush(subscription, payload) entry point.
 *
 * Read by /api/notifications/push/* routes and /api/cron/daily-nudge.
 */

import webpush, { type PushSubscription as VapidSubscription, type WebPushError } from "web-push";
import type { PushSubscriptionJSON } from "@/lib/types";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    throw new Error("Web push VAPID keys are not configured");
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface SendPushResult {
  ok: boolean;
  /** True if the subscription is gone (404/410) and should be deleted from DB. */
  gone?: boolean;
  status?: number;
  error?: string;
}

export async function sendPush(
  subscription: PushSubscriptionJSON,
  payload: PushPayload,
): Promise<SendPushResult> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      subscription as VapidSubscription,
      JSON.stringify(payload),
      { TTL: 24 * 60 * 60 }, // drop the notification if not delivered within 24h
    );
    return { ok: true };
  } catch (e) {
    const err = e as WebPushError;
    const status = err.statusCode;
    // 404/410 mean the browser revoked the subscription — caller should delete.
    if (status === 404 || status === 410) {
      return { ok: false, gone: true, status };
    }
    return { ok: false, status, error: err.body || err.message };
  }
}
