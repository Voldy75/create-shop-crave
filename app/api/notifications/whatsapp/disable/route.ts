import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-guard";

export const maxDuration = 10;

/** Turn off WhatsApp delivery without losing the phone (cheap re-enable). */
export async function POST() {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_subscriptions")
    .upsert(
      {
        user_id: user.id,
        whatsapp_enabled: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("whatsapp/disable:", error.message);
    return Response.json({ error: "persist_failed", message: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
