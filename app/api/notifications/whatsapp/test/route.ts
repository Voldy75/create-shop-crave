import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendWhatsApp } from "@/lib/twilio";

export const maxDuration = 10;

/**
 * Fires a one-off WhatsApp test message to the calling user.
 * Requires whatsapp_status='active' (i.e. they completed the JOIN flow).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from("notification_subscriptions")
    .select("phone_e164, whatsapp_status, whatsapp_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    return Response.json({ error: "lookup_failed", message: error.message }, { status: 500 });
  }
  if (!data?.whatsapp_enabled || data.whatsapp_status !== "active" || !data.phone_e164) {
    return Response.json(
      {
        error: "not_active",
        message: "Complete the WhatsApp JOIN step first.",
      },
      { status: 400 },
    );
  }

  const result = await sendWhatsApp(
    data.phone_e164,
    "Crave & Create test ✓ — daily nudges will land here at 8pm IST. Reply STOP to opt out anytime.",
  );

  if (!result.ok) {
    if (result.channelClosed) {
      // 24h window expired or recipient un-joined. Flip to pending so they re-join.
      await service
        .from("notification_subscriptions")
        .update({ whatsapp_status: "pending", updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      return Response.json(
        {
          error: "channel_closed",
          message: "WhatsApp session closed — please re-send the JOIN code from your phone.",
        },
        { status: 410 },
      );
    }
    return Response.json(
      { error: "send_failed", code: result.code, message: result.error },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, sid: result.sid });
}
