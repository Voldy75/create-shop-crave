import { createClient } from "@/lib/supabase/server";
import type { PushSubscriptionJSON } from "@/lib/types";

export const maxDuration = 10;

interface Body {
  subscription: PushSubscriptionJSON;
}

/**
 * Persists a browser PushSubscription for the current user.
 * The Settings UI calls this after navigator.serviceWorker.pushManager.subscribe().
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.subscription?.endpoint || !body.subscription?.keys?.p256dh || !body.subscription?.keys?.auth) {
    return Response.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("notification_subscriptions")
    .upsert(
      {
        user_id: user.id,
        web_push_enabled: true,
        web_push_subscription: body.subscription,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("push/subscribe:", error.message);
    return Response.json({ error: "persist_failed", message: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
