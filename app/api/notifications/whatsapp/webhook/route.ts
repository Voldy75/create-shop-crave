import { createServiceClient } from "@/lib/supabase/server";
import { validateTwilioSignature } from "@/lib/twilio";

export const maxDuration = 10;

/**
 * Twilio inbound webhook for the WhatsApp Sandbox.
 *
 * Twilio sends application/x-www-form-urlencoded with fields like:
 *   From: "whatsapp:+919876543210"
 *   To:   "whatsapp:+14155238886"
 *   Body: "join silly-rabbit"  (or any subsequent user message)
 *
 * What we do:
 *   - Match `From` (minus prefix) against notification_subscriptions.phone_e164
 *   - If found:
 *       - status 'pending' → flip to 'active' (the user just joined)
 *       - any inbound → bump last_inbound_at (refreshes 24h send window)
 *       - "STOP" / "STOPALL" / "UNSUBSCRIBE" → flip to 'revoked' + disable
 *   - If not found: log + ignore (can't match the user, they need to enroll via Settings)
 *
 * Always returns 200 with empty TwiML so Twilio doesn't retry. We respond with
 * an empty <Response/> to suppress the default auto-reply.
 */

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "quit"]);
const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const TWIML_HEADERS = { "Content-Type": "text/xml" };

export async function POST(req: Request) {
  // Twilio sends form-encoded data; parse and validate signature.
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") params[k] = v;
  }

  const signature = req.headers.get("x-twilio-signature");
  // The signed URL must match what's configured in the Twilio Console.
  // In Vercel, req.url is the deployed URL — same as what we'd configure.
  const valid = validateTwilioSignature(signature, req.url, params);
  if (!valid) {
    console.warn("webhook: invalid signature, dropping");
    return new Response(TWIML_EMPTY, { headers: TWIML_HEADERS });
  }

  const from = (params.From || "").replace(/^whatsapp:/, "").trim();
  const bodyText = (params.Body || "").trim();
  const bodyLower = bodyText.toLowerCase();
  if (!from) {
    return new Response(TWIML_EMPTY, { headers: TWIML_HEADERS });
  }

  const supabase = await createServiceClient();

  const { data: sub, error } = await supabase
    .from("notification_subscriptions")
    .select("user_id, whatsapp_status, whatsapp_enabled")
    .eq("phone_e164", from)
    .maybeSingle();
  if (error) {
    console.error("webhook lookup:", error.message);
    return new Response(TWIML_EMPTY, { headers: TWIML_HEADERS });
  }
  if (!sub) {
    // Phone hasn't been registered in Settings yet — nothing to do.
    return new Response(TWIML_EMPTY, { headers: TWIML_HEADERS });
  }

  // Compute the next state
  const now = new Date().toISOString();
  let patch: Record<string, unknown> = { last_inbound_at: now, updated_at: now };

  if (STOP_WORDS.has(bodyLower)) {
    patch = { ...patch, whatsapp_status: "revoked", whatsapp_enabled: false };
  } else if (sub.whatsapp_status === "pending") {
    // First inbound from a pending user — they joined.
    patch = { ...patch, whatsapp_status: "active" };
  } else if (sub.whatsapp_status === "revoked" && bodyLower === "start") {
    // Allow re-opt-in via "START" if previously revoked.
    patch = { ...patch, whatsapp_status: "active", whatsapp_enabled: true };
  }

  const { error: updateError } = await supabase
    .from("notification_subscriptions")
    .update(patch)
    .eq("user_id", sub.user_id);
  if (updateError) {
    console.error("webhook update:", updateError.message);
  }

  return new Response(TWIML_EMPTY, { headers: TWIML_HEADERS });
}
