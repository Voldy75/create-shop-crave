import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-guard";

export const maxDuration = 10;

/**
 * Clears the user's stored push subscription and flips web_push_enabled off.
 * Called when the user toggles web push off in Settings.
 */
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
        web_push_enabled: false,
        web_push_subscription: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("push/unsubscribe:", error.message);
    return Response.json({ error: "persist_failed", message: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
