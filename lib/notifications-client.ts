/**
 * Client-side helpers for reading + updating the current user's notification
 * preferences via the Supabase browser client. RLS enforces the per-user scope.
 *
 * The Settings page is the only consumer today; PR B and PR C will wire push
 * subscription JSON and WhatsApp opt-in onto the same row.
 */

import { createClient } from "@/lib/supabase/client";
import type { NotificationSubscription, WhatsAppStatus, PushSubscriptionJSON } from "@/lib/types";

interface Row {
  user_id: string;
  web_push_enabled: boolean;
  web_push_subscription: PushSubscriptionJSON | null;
  whatsapp_enabled: boolean;
  phone_e164: string | null;
  whatsapp_status: WhatsAppStatus;
  last_inbound_at: string | null;
  updated_at: string;
}

function rowToSub(r: Row): NotificationSubscription {
  return {
    userId: r.user_id,
    webPushEnabled: r.web_push_enabled,
    webPushSubscription: r.web_push_subscription,
    whatsappEnabled: r.whatsapp_enabled,
    phoneE164: r.phone_e164,
    whatsappStatus: r.whatsapp_status,
    lastInboundAt: r.last_inbound_at,
    updatedAt: r.updated_at,
  };
}

/** Fetch the current user's subscription row, or null if not yet created. */
export async function getMySubscription(): Promise<NotificationSubscription | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("notification_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    console.error("getMySubscription:", error.message);
    return null;
  }
  if (!data) return null;
  return rowToSub(data as Row);
}

/** Upsert the current user's row. Touches updated_at via the DB default semantics. */
export async function upsertMySubscription(
  patch: Partial<Omit<NotificationSubscription, "userId" | "updatedAt">>,
): Promise<NotificationSubscription | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbPatch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  if ("webPushEnabled" in patch) dbPatch.web_push_enabled = patch.webPushEnabled;
  if ("webPushSubscription" in patch) dbPatch.web_push_subscription = patch.webPushSubscription;
  if ("whatsappEnabled" in patch) dbPatch.whatsapp_enabled = patch.whatsappEnabled;
  if ("phoneE164" in patch) dbPatch.phone_e164 = patch.phoneE164;
  if ("whatsappStatus" in patch) dbPatch.whatsapp_status = patch.whatsappStatus;

  const { data, error } = await supabase
    .from("notification_subscriptions")
    .upsert(dbPatch, { onConflict: "user_id" })
    .select()
    .single();
  if (error) {
    console.error("upsertMySubscription:", error.message);
    return null;
  }
  return rowToSub(data as Row);
}

/** Normalize a phone string to E.164 (e.g. "+919876543210"). Returns null if invalid. */
export function normalizeE164(input: string, defaultCountryCode = "91"): string | null {
  const digits = input.replace(/\D+/g, "");
  if (digits.length === 0) return null;
  // Already includes country code (10+ digits with leading country prefix)
  if (digits.length >= 11) return `+${digits}`;
  // Bare 10-digit Indian number — prepend default country code
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  return null;
}
