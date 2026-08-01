import { requireUser } from "@/lib/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 5;

const PLATFORMS = new Set(["web", "ios", "android"]);

/**
 * Records which platform a session is running on.
 *
 * Nothing in the schema recorded platform before this, so "manage users across
 * web and mobile" was literally unanswerable — there is one auth.users and no
 * platform column. The only pre-existing signal was
 * notification_subscriptions.native_push_platform, and only for users who had
 * enabled push.
 *
 * Called once per hydrate from app/context/UserContext.tsx. Fire-and-forget on
 * the client: a failure here must never affect sign-in.
 *
 * Uses the service client because it writes columns the user is not granted
 * (see the column-level grants on user_profiles). The user id comes from the
 * guard, never from the request body.
 */
export async function POST(req: Request) {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  let platform = "web";
  try {
    const body = (await req.json()) as { platform?: string };
    if (body?.platform && PLATFORMS.has(body.platform)) {
      platform = body.platform;
    }
  } catch {
    // Body is optional; default to web.
  }

  const supabase = await createServiceClient();

  // first_seen_platform is written once and never overwritten — coalesce keeps
  // the original attribution even as the user moves between surfaces.
  const { error } = await supabase
    .from("user_profiles")
    .update({
      last_seen_platform: platform,
      last_seen_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("session ping failed:", error.message);
    return Response.json({ ok: false }, { status: 200 });
  }

  // Separate guarded write so we never clobber an existing value.
  await supabase
    .from("user_profiles")
    .update({ first_seen_platform: platform })
    .eq("user_id", user.id)
    .is("first_seen_platform", null);

  return Response.json({ ok: true });
}
