import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";

export interface FeatureFlag {
  id: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

/**
 * Admin flag list — includes description and updated_at, which the public
 * GET /api/flags deliberately omits. lib/feature-flags.ts now reads that public
 * route, so guarding this one no longer breaks flag reads for normal users.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from("feature_flags")
    .select("id, enabled, description, updated_at")
    .order("id");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ flags: data ?? [] });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const body = await req.json().catch(() => null);
  if (!body?.id || typeof body.enabled !== "boolean") {
    return Response.json({ error: "id (string) and enabled (boolean) required" }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from("feature_flags")
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .select("id, enabled, description, updated_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ flag: data });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const body = await req.json().catch(() => null);
  if (!body?.id || typeof body.id !== "string") {
    return Response.json({ error: "id (string) required" }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from("feature_flags")
    .insert({
      id: body.id,
      enabled: body.enabled ?? false,
      description: body.description ?? null,
    })
    .select("id, enabled, description, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "Flag already exists" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ flag: data }, { status: 201 });
}
