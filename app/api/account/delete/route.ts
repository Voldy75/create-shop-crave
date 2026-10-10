import { requireUser } from "@/lib/auth-guard";
import { deleteAccount, DeletionAborted, getPassStatus } from "@/lib/account";

export const maxDuration = 30;

/**
 * Permanently delete the signed-in user. See lib/account.ts for the order of
 * operations and why billing must be stopped first.
 *
 * Guards, all enforced HERE and not only in the UI:
 *   - JSON only. A cross-site <form> can POST text/plain with the user's
 *     cookie attached; requiring application/json forces a CORS preflight,
 *     which a foreign origin cannot pass. Cheap, and this is the one endpoint
 *     where a forged request is irreversible.
 *   - `confirm` must be exactly "DELETE".
 *   - A live paid entitlement must be acknowledged explicitly (409 otherwise),
 *     so a stale client can never skip the forfeiture / cancellation step.
 *
 * Not gated on `restricted` — deletion is a right, not a feature.
 */
export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }
  const guard = await requireUser();
  if (guard instanceof Response) return guard;
  const { user } = guard;

  let body: { confirm?: unknown; acknowledgePass?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (body.confirm !== "DELETE") {
    return Response.json({ error: "confirmation_required" }, { status: 400 });
  }

  const pass = await getPassStatus(user.id);
  if (pass && body.acknowledgePass !== true) {
    return Response.json(
      { error: "pass_active", pass: { provider: pass.provider, recurring: pass.recurring, daysLeft: pass.daysLeft } },
      { status: 409 }
    );
  }

  try {
    const steps = await deleteAccount(user.id, pass);
    const failed = steps.find((s) => !s.ok);
    if (failed) {
      console.error("account delete: step failed", user.id, failed);
      return Response.json({ error: "delete_failed", steps }, { status: 500 });
    }
    return Response.json({ ok: true, steps });
  } catch (e) {
    if (e instanceof DeletionAborted) {
      // Nothing was deleted. Say so plainly; the user is still being billed,
      // which is exactly why we stopped.
      console.error("account delete: aborted before deleting anything:", e.message);
      return Response.json({ error: "billing_not_stopped", steps: e.steps }, { status: 502 });
    }
    console.error("account delete: unexpected", e instanceof Error ? e.message : e);
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }
}
