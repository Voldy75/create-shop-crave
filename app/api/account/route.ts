import { requireUser } from "@/lib/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { getPassStatus } from "@/lib/account";
import { resolveLimits } from "@/lib/limits";

export const maxDuration = 10;

/**
 * What the Account screen and the delete confirmation need from the server.
 * Device-local counts (saved recipes, local meal logs) come from the client,
 * which is the only place they exist.
 *
 * Deliberately NOT gated on `restricted`: deleting your account and getting a
 * copy of your data are rights, not features.
 */
export async function GET() {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user, profile } = guard;

  const [pass, limits] = await Promise.all([getPassStatus(user.id), resolveLimits(user.id)]);
  const sb = await createServiceClient();
  const [{ count: storeConnections }, { count: serverMealLogs }] = await Promise.all([
    sb.from("mcp_connections").select("provider_id", { count: "exact", head: true }).eq("user_id", user.id),
    sb.from("meal_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  return Response.json({
    email: user.email ?? null,
    signInProvider: (user.app_metadata?.provider as string | undefined) ?? null,
    // subscriptionId stays server-side: the client has no use for it.
    pass: pass
      ? { provider: pass.provider, recurring: pass.recurring, endsAt: pass.endsAt, daysLeft: pass.daysLeft }
      : null,
    // The real daily cap from the plans table (null = unlimited) — never a
    // hardcoded "2", which is a DB value an admin can change without a deploy.
    chatDailyLimit: limits.chat,
    // Decided server-side, the same way requireAdmin decides it. Replaces a
    // client check against NEXT_PUBLIC_ADMIN_EMAIL, which only worked if that
    // variable was set — and setting it compiles the admin's email into the
    // public JS bundle.
    isAdmin: profile.role === "admin" || (!!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL),
    storeConnections: storeConnections ?? 0,
    serverMealLogs: serverMealLogs ?? 0,
  });
}
