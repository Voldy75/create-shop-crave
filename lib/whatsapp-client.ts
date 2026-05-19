/**
 * Browser-side helpers for the WhatsApp Sandbox opt-in flow.
 *
 * Settings page uses these to enroll a phone, render the JOIN instructions,
 * trigger a test send, and disable.
 */

export interface JoinInstructions {
  to: string;        // human-readable Twilio sandbox number (e.g. "+14155238886")
  text: string;      // "join <code>"
}

export interface EnrollResult {
  ok: boolean;
  phone?: string;
  joinInstructions?: JoinInstructions;
  reason?: string;
}

export async function enrollWhatsApp(phone: string): Promise<EnrollResult> {
  const res = await fetch("/api/notifications/whatsapp/enroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, reason: data.message || data.error || "Enrollment failed" };
  }
  return { ok: true, phone: data.phone, joinInstructions: data.joinInstructions };
}

export async function disableWhatsApp(): Promise<{ ok: boolean }> {
  await fetch("/api/notifications/whatsapp/disable", { method: "POST" });
  return { ok: true };
}

export async function sendWhatsAppTest(): Promise<{ ok: boolean; reason?: string; channelClosed?: boolean }> {
  const res = await fetch("/api/notifications/whatsapp/test", { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      reason: data.message || data.error || "Send failed",
      channelClosed: res.status === 410,
    };
  }
  return { ok: true };
}
