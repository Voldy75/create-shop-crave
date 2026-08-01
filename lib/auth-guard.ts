import type { User } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { UserStatus } from "@/lib/limits";

/**
 * The single authentication/authorization chokepoint for app/api/**.
 *
 * Before this existed, every route re-implemented `supabase.auth.getUser()` and
 * the admin gate was a copy-pasted `user.email !== ADMIN_EMAIL`. Adding a ban
 * check to ~20 routes by hand guarantees missing one, and one missed route
 * means "banned" means nothing.
 *
 * Three routes deliberately do NOT use these guards, because they are
 * authenticated by signature rather than by session and must stay that way:
 *   app/api/subscribe/stripe/webhook   -- Stripe signature
 *   app/api/notifications/whatsapp/webhook -- Twilio X-Twilio-Signature
 *   app/api/cron/daily-nudge           -- CRON_SECRET
 *
 * Usage:
 *   const guard = await requireUser();
 *   if (guard instanceof Response) return guard;
 *   const { user } = guard;
 */

export interface GuardProfile {
  status: UserStatus;
  role: "user" | "support" | "admin";
  planId: string | null;
}

export interface GuardResult {
  user: User;
  profile: GuardProfile;
}

const DEFAULT_PROFILE: GuardProfile = { status: "active", role: "user", planId: null };

/**
 * Ban enforcement reads user_profiles.status rather than Supabase's
 * auth.users.banned_until.
 *
 * Two reasons. First, we need to distinguish "banned by us, with a reason and
 * an audit row" from "banned by GoTrue". Second, an already-issued access token
 * stays valid until it expires (1h by default), so a token-level ban would
 * leave up to an hour of access -- checking the DB on each request makes the
 * effective latency one request. Calling auth.admin.updateUserById to stop
 * refresh is belt-and-braces on top, not the enforcement point.
 */
async function loadProfile(userId: string): Promise<GuardProfile> {
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("status, role, plan_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("auth-guard: user_profiles read failed:", error.message);
      // Fail OPEN on status, deliberately: a transient DB error should not log
      // the whole userbase out. It fails CLOSED on role (see requireAdmin),
      // so a hiccup can never grant admin.
      return DEFAULT_PROFILE;
    }
    if (!data) return DEFAULT_PROFILE;

    return {
      status: (data.status ?? "active") as UserStatus,
      role: (data.role ?? "user") as GuardProfile["role"],
      planId: data.plan_id ?? null,
    };
  } catch (err) {
    console.error("auth-guard: unexpected profile failure:", err);
    return DEFAULT_PROFILE;
  }
}

/** 401 without a session; 403 when the account is banned. */
export async function requireUser(): Promise<GuardResult | Response> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await loadProfile(user.id);

  if (profile.status === "banned") {
    return Response.json(
      { error: "Account suspended", code: "account_banned" },
      { status: 403 }
    );
  }

  // 'restricted' keeps read access; resolveLimits() zeroes their quota instead.
  return { user, profile };
}

/**
 * Blocks a `restricted` account from generative endpoints, returning null when
 * the request may proceed.
 *
 * Why this exists separately from resolveLimits(): `restricted` is enforced by
 * zeroing quota, but every AI route SKIPS quota resolution entirely when the
 * caller supplies their own `apiKey` + `provider` (BYOK). Without this check a
 * restricted user simply pastes a free-tier Gemini key and carries on
 * generating -- including placing real orders through /api/agent, the highest
 * blast-radius surface in the app. Restriction has to bite on behaviour, not
 * just on subsidized spend.
 *
 * Read access is untouched: this is only called from generative routes.
 */
export function denyIfRestricted(profile: GuardProfile): Response | null {
  if (profile.status !== "restricted") return null;
  return Response.json(
    {
      error: "account_restricted",
      message: "This account is restricted. Contact support if you think this is a mistake.",
    },
    { status: 403 }
  );
}

/**
 * Admin-only. Accepts EITHER user_profiles.role = 'admin' OR a match against
 * the ADMIN_EMAIL env var.
 *
 * The dual accept is a deliberate migration step, not redundancy: switching
 * straight to role-only and getting the seed wrong locks you out of the very
 * tool you would use to fix it. Order of operations is
 *   (1) ship this dual check,
 *   (2) seed your own user_profiles.role = 'admin',
 *   (3) verify,
 *   (4) then delete the env branch.
 *
 * Note: as of this writing neither Vercel project actually sets ADMIN_EMAIL, so
 * in production today the env branch never matches and the role column is the
 * only thing that will work.
 */
/**
 * Server-component variant of the admin check.
 *
 * requireAdmin() returns a Response, which is the right shape for a route
 * handler but useless in a layout — there you want redirect()/notFound().
 * Use this to gate admin pages on the server so the shell never renders for a
 * non-admin. The old gate was a client-side `user?.email ===
 * NEXT_PUBLIC_ADMIN_EMAIL`, which is cosmetic: it hides UI but protects
 * nothing. The API guards remain the real enforcement either way.
 */
export async function isAdminUser(): Promise<boolean> {
  const guard = await requireAdmin();
  return !(guard instanceof Response);
}

export async function requireAdmin(): Promise<GuardResult | Response> {
  const guard = await requireUser();
  if (guard instanceof Response) return guard;

  const { user, profile } = guard;
  const adminEmail = process.env.ADMIN_EMAIL;
  const isAdmin =
    profile.role === "admin" || (!!adminEmail && user.email === adminEmail);

  if (!isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return guard;
}
