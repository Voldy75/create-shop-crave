import { requireBoUser, readJsonObject, platformFrom } from "@/lib/bo/guard";
import {
  BO_NOTICE_VERSION,
  ConsentRequiredError,
  ProfileInputError,
  getFoodProfile,
  grantProfileConsent,
  parseProfileInput,
  setNudgesConsent,
  withdrawProfileConsent,
} from "@/lib/bo/food-profile";

/**
 * Grant or withdraw a Bo consent purpose (DPDP).
 *
 * POST { purpose: "bo_profile", grant: true, ageConfirmed: true, noticeVersion, platform?, seed? }
 *   Opt in. noticeVersion must be the notice the user was actually shown —
 *   a stale screen gets 409 notice_changed and must re-show the notice.
 *   seed: this device's existing preferences, so opting in does not start
 *   from an empty profile (same fields and limits as PUT /api/bo/profile).
 * POST { purpose: "bo_profile", grant: false }
 *   Withdraw: deletes the profile and every Bo task, in this request.
 * POST { purpose: "bo_nudges", grant: boolean }
 *   Optional proactive nudges; needs the profile consent first.
 *
 * Returns the resulting { consent, profile }.
 */

export async function POST(req: Request) {
  const guard = await requireBoUser();
  if (guard instanceof Response) return guard;
  const uid = guard.user.id;
  const body = await readJsonObject(req);
  if (!body || typeof body.grant !== "boolean") return Response.json({ error: "invalid_body" }, { status: 400 });
  const platform = platformFrom(body.platform);

  try {
    if (body.purpose === "bo_profile") {
      if (body.grant) {
        if (body.noticeVersion !== BO_NOTICE_VERSION) {
          return Response.json({ error: "notice_changed", noticeVersion: BO_NOTICE_VERSION }, { status: 409 });
        }
        if (body.ageConfirmed !== true) return Response.json({ error: "age_confirmation_required" }, { status: 400 });
        const seedBody = body.seed && typeof body.seed === "object" && !Array.isArray(body.seed) ? (body.seed as Record<string, unknown>) : {};
        await grantProfileConsent(uid, { ageConfirmed: true, platform, seed: parseProfileInput(seedBody) });
      } else {
        await withdrawProfileConsent(uid, platform);
      }
    } else if (body.purpose === "bo_nudges") {
      await setNudgesConsent(uid, body.grant, platform);
    } else {
      return Response.json({ error: "invalid_purpose" }, { status: 400 });
    }
    return Response.json(await getFoodProfile(uid), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ProfileInputError) return Response.json({ error: "invalid_input", message: e.message }, { status: 400 });
    if (e instanceof ConsentRequiredError) return Response.json({ error: "consent_required" }, { status: 409 });
    console.error("POST /api/bo/consent:", e instanceof Error ? e.message : e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
