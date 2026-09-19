import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-guard";
import { TWILIO_FROM, TWILIO_JOIN_CODE } from "@/lib/twilio";

export const maxDuration = 10;

interface Body {
  phone: string; // accepts any free-form; we normalize
}

function normalizeE164(input: string, defaultCountryCode = "91"): string | null {
  const digits = input.replace(/\D+/g, "");
  if (digits.length === 0) return null;
  if (digits.length >= 11) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  return null;
}

/**
 * Begin WhatsApp opt-in for the current user.
 * 1. Stores their phone (normalized to E.164)
 * 2. Flips whatsapp_status to 'pending' + whatsapp_enabled=true
 * 3. Returns the Twilio Sandbox JOIN instructions to display in the UI
 *
 * After this, the user must text "join <code>" to TWILIO_FROM from that phone.
 * The Twilio webhook (/api/notifications/whatsapp/webhook) flips status to
 * 'active' once we see any inbound from a matching phone.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const phone = normalizeE164(body.phone || "");
  if (!phone) {
    return Response.json(
      { error: "invalid_phone", message: "Enter a 10-digit number or include country code." },
      { status: 400 },
    );
  }

  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_subscriptions")
    .upsert(
      {
        user_id: user.id,
        whatsapp_enabled: true,
        whatsapp_status: "pending",
        phone_e164: phone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("whatsapp/enroll:", error.message);
    return Response.json({ error: "persist_failed", message: error.message }, { status: 500 });
  }

  // Strip the "whatsapp:" prefix for human display.
  const sandboxNumber = TWILIO_FROM.replace(/^whatsapp:/, "");
  return Response.json({
    ok: true,
    phone,
    joinInstructions: {
      to: sandboxNumber,                       // e.g. "+14155238886"
      text: `join ${TWILIO_JOIN_CODE}`,        // e.g. "join clothes-electric"
    },
  });
}
