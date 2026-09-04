import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-guard";

export const maxDuration = 10;

interface Body {
  token: string;
  platform: "ios" | "android";
}

/**
 * Persists a native (APNs/FCM) push token for the current user. The Capacitor
 * shell calls this from lib/native-bridge registerNativePush() after the OS
 * grants permission and the 'registration' listener yields a token. Mirrors the
 * web-push subscribe route; the daily-nudge cron then targets native tokens too.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.token || (body.platform !== "ios" && body.platform !== "android")) {
    return Response.json({ error: "invalid_token" }, { status: 400 });
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
        native_push_enabled: true,
        native_push_token: body.token,
        native_push_platform: body.platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("native/register:", error.message);
    return Response.json({ error: "persist_failed", message: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
