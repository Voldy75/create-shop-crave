import { requireBoUser, readJsonObject } from "@/lib/bo/guard";
import {
  ConsentRequiredError,
  ProfileInputError,
  getFoodProfile,
  parseProfileInput,
  updateFoodProfile,
} from "@/lib/bo/food-profile";

/**
 * Bo's food profile.
 *   GET  → { consent, profile }   profile is null until the user opts in
 *   PUT  → { profile }            409 consent_required without a current consent
 *
 * Consent itself is granted and withdrawn at /api/bo/consent.
 */

export async function GET() {
  const guard = await requireBoUser();
  if (guard instanceof Response) return guard;
  try {
    return Response.json(await getFoodProfile(guard.user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("GET /api/bo/profile:", e instanceof Error ? e.message : e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const guard = await requireBoUser();
  if (guard instanceof Response) return guard;
  const body = await readJsonObject(req);
  if (!body) return Response.json({ error: "invalid_body" }, { status: 400 });
  try {
    const fields = parseProfileInput(body);
    const profile = await updateFoodProfile(guard.user.id, fields);
    return Response.json({ profile });
  } catch (e) {
    if (e instanceof ProfileInputError) return Response.json({ error: "invalid_input", message: e.message }, { status: 400 });
    if (e instanceof ConsentRequiredError) return Response.json({ error: "consent_required" }, { status: 409 });
    console.error("PUT /api/bo/profile:", e instanceof Error ? e.message : e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
