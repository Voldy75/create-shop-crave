import { createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-guard";
import { sendPush } from "@/lib/web-push";
import type { PushSubscriptionJSON } from "@/lib/types";

export const maxDuration = 10;

/**
 * Sends a single test push to the calling user. Settings page hits this from
 * the "Send test" button so users can verify their browser is receiving pushes
 * before relying on the daily cron.
 */
export async function POST() {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  // Read from service role to avoid an extra RLS round-trip; user is auth-verified above.
  const service = await createServiceClient();
  const { data, error } = await service
    .from("notification_subscriptions")
    .select("web_push_subscription, web_push_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    return Response.json({ error: "lookup_failed", message: error.message }, { status: 500 });
  }
  if (!data?.web_push_enabled || !data.web_push_subscription) {
    return Response.json({ error: "not_subscribed", message: "Enable web push first." }, { status: 400 });
  }

  const result = await sendPush(data.web_push_subscription as PushSubscriptionJSON, {
    title: "Crave & Create",
    body: "Test push delivered. You're good to go.",
    url: "/settings/notifications",
    tag: "test-push",
  });

  if (result.gone) {
    // Subscription was revoked browser-side — clean it up.
    await service
      .from("notification_subscriptions")
      .update({ web_push_enabled: false, web_push_subscription: null, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    return Response.json(
      { error: "subscription_gone", message: "Browser revoked the subscription. Re-enable web push." },
      { status: 410 },
    );
  }

  if (!result.ok) {
    return Response.json({ error: "send_failed", status: result.status, message: result.error }, { status: 502 });
  }

  return Response.json({ ok: true });
}
