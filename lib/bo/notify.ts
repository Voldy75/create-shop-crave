/**
 * A Bo task update pushed to the user — "Your Swiggy order is placed" — on
 * the push channels they turned on (Settings → Notifications): web push and
 * the native app. Transactional, about their own order, so it is not gated
 * on the nudge consent.
 *
 * Not WhatsApp: outside the 24-hour window it needs an approved template.
 * Not notification_log either: the daily-nudge cron dedupes on that table per
 * day and channel, so an order update there would cancel that day's nudge.
 * The send is recorded on the task's own timeline instead.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/web-push";
import { sendNativePush } from "@/lib/native-push";
import { addTaskEvent, logId } from "@/lib/bo/tasks";
import type { PushSubscriptionJSON } from "@/lib/types";

interface SubRow {
  web_push_enabled: boolean;
  web_push_subscription: PushSubscriptionJSON | null;
  native_push_enabled: boolean;
  native_push_token: string | null;
}

export async function notifyUser(userId: string, taskId: string, msg: { title: string; body: string }): Promise<void> {
  try {
    const sb = await createServiceClient();
    const { data } = await sb
      .from("notification_subscriptions")
      .select("web_push_enabled, web_push_subscription, native_push_enabled, native_push_token")
      .eq("user_id", userId)
      .maybeSingle();
    const sub = data as SubRow | null;
    const sent: string[] = [];
    if (sub?.web_push_enabled && sub.web_push_subscription) {
      const r = await sendPush(sub.web_push_subscription, { ...msg, url: "/chat", tag: `bo-${taskId}` });
      if (r.ok) sent.push("web_push");
    }
    if (sub?.native_push_enabled && sub.native_push_token) {
      const r = await sendNativePush(sub.native_push_token, { ...msg, url: "/m/chat" });
      if (r.ok) sent.push("native_push");
    }
    await addTaskEvent(userId, taskId, "message", { summary: sent.length ? `notified:${sent.join(",")}` : "notified:none" });
  } catch (err) {
    console.error(`bo[${logId(userId)}] notify failed:`, err instanceof Error ? err.message.slice(0, 200) : err);
  }
}
