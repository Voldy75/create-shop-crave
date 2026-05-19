/**
 * Server-side Twilio helper. Wraps the Twilio SDK with our Sandbox config.
 *
 * Free-tier reality check baked in: the Sandbox sender ("whatsapp:+14155238886")
 * is shared with every Twilio trial account and only delivers to numbers that
 * have explicitly texted "join <code>" to it. We treat any send failure as
 * "session expired or not joined" and surface a structured result so the
 * caller (Settings test button or the daily cron) can react without crashing.
 */

import twilio, { type Twilio } from "twilio";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const FROM = process.env.TWILIO_WHATSAPP_FROM ?? "";

let client: Twilio | null = null;
function getClient(): Twilio {
  if (client) return client;
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    throw new Error("Twilio credentials are not configured");
  }
  client = twilio(ACCOUNT_SID, AUTH_TOKEN);
  return client;
}

export const TWILIO_FROM = FROM;
export const TWILIO_JOIN_CODE = process.env.TWILIO_SANDBOX_JOIN_CODE ?? "";

export interface SendWhatsAppResult {
  ok: boolean;
  /** True when the channel is closed (24h window expired or never joined). */
  channelClosed?: boolean;
  /** Numeric Twilio error code if present (https://www.twilio.com/docs/api/errors). */
  code?: number;
  error?: string;
  sid?: string;
}

/** Send a plain-text WhatsApp message to a phone E.164. */
export async function sendWhatsApp(toE164: string, body: string): Promise<SendWhatsAppResult> {
  try {
    const msg = await getClient().messages.create({
      from: FROM,
      to: `whatsapp:${toE164}`,
      body,
    });
    return { ok: true, sid: msg.sid };
  } catch (e) {
    const err = e as { code?: number; message?: string; status?: number };
    // 63016 = Failed to send freeform message because you are outside the allowed 24-hour window.
    // 63007 = Channel could not find a To address (number not joined to sandbox).
    // 21610 = Recipient has opted out.
    const channelClosed = err.code === 63016 || err.code === 63007 || err.code === 21610;
    return {
      ok: false,
      channelClosed,
      code: err.code,
      error: (err.message ?? "Unknown error").slice(0, 200),
    };
  }
}

/**
 * Verify the X-Twilio-Signature on inbound webhook requests.
 * Returns true if valid OR if AUTH_TOKEN is unconfigured (we only skip for
 * local dev where the env var is missing; production always has it set).
 */
export function validateTwilioSignature(
  signature: string | null,
  webhookUrl: string,
  params: Record<string, string>,
): boolean {
  if (!AUTH_TOKEN) return true; // local dev fallback
  if (!signature) return false;
  return twilio.validateRequest(AUTH_TOKEN, signature, webhookUrl, params);
}
