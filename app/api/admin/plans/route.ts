import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { auditLog } from "@/lib/audit";
import { invalidateLimitsCache } from "@/lib/limits";

const ID_PATTERN = /^[a-z][a-z0-9_]*$/;

interface PlanRow {
  id: string;
  name: string;
  is_active: boolean;
  sort: number;
  chat_daily_limit: number | null;
  photo_daily_limit: number | null;
  features: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const svc = await createServiceClient();

  const [plansRes, pricesRes] = await Promise.all([
    svc.from("plans").select("*").order("sort", { ascending: true }),
    svc.from("plan_prices").select("*"),
  ]);

  if (plansRes.error) {
    return Response.json({ error: plansRes.error.message }, { status: 500 });
  }
  if (pricesRes.error) {
    return Response.json({ error: pricesRes.error.message }, { status: 500 });
  }

  const pricesByPlan = new Map<string, unknown[]>();
  for (const price of pricesRes.data ?? []) {
    const list = pricesByPlan.get(price.plan_id) ?? [];
    list.push(price);
    pricesByPlan.set(price.plan_id, list);
  }

  const plans = (plansRes.data ?? []).map((plan) => ({
    ...plan,
    plan_prices: pricesByPlan.get(plan.id) ?? [],
  }));

  return Response.json({ plans });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;
  const { user: actor } = guard;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, name, chat_daily_limit, photo_daily_limit, features, sort } = body as Record<
    string,
    unknown
  >;

  if (typeof id !== "string" || !ID_PATTERN.test(id)) {
    return Response.json(
      { error: "id must be lowercase snake_case" },
      { status: 400 }
    );
  }
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (
    chat_daily_limit !== undefined &&
    chat_daily_limit !== null &&
    typeof chat_daily_limit !== "number"
  ) {
    return Response.json({ error: "chat_daily_limit must be a number or null" }, { status: 400 });
  }
  if (
    photo_daily_limit !== undefined &&
    photo_daily_limit !== null &&
    typeof photo_daily_limit !== "number"
  ) {
    return Response.json({ error: "photo_daily_limit must be a number or null" }, { status: 400 });
  }
  if (features !== undefined && (typeof features !== "object" || features === null || Array.isArray(features))) {
    return Response.json({ error: "features must be an object" }, { status: 400 });
  }
  if (sort !== undefined && typeof sort !== "number") {
    return Response.json({ error: "sort must be a number" }, { status: 400 });
  }

  const svc = await createServiceClient();

  const insertRow: Record<string, unknown> = {
    id,
    name,
    chat_daily_limit: chat_daily_limit ?? null,
    photo_daily_limit: photo_daily_limit ?? null,
  };
  if (features !== undefined) insertRow.features = features;
  if (sort !== undefined) insertRow.sort = sort;

  const { data, error } = await svc
    .from("plans")
    .insert(insertRow)
    .select("*")
    .single<PlanRow>();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "Plan already exists" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  await auditLog({
    actorUserId: actor.id,
    action: "plan.create",
    targetType: "plan",
    targetId: data.id,
    before: null,
    after: data,
  });
  invalidateLimitsCache();

  return Response.json({ plan: data }, { status: 201 });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;
  const { user: actor } = guard;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof (body as Record<string, unknown>).id !== "string") {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const { id: rawId, ...rest } = body as Record<string, unknown>;
  const id = rawId as string;

  const updates: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(rest, "name")) {
    if (typeof rest.name !== "string" || !rest.name.trim()) {
      return Response.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    updates.name = rest.name;
  }
  if (Object.prototype.hasOwnProperty.call(rest, "is_active")) {
    if (typeof rest.is_active !== "boolean") {
      return Response.json({ error: "is_active must be a boolean" }, { status: 400 });
    }
    updates.is_active = rest.is_active;
  }
  if (Object.prototype.hasOwnProperty.call(rest, "sort")) {
    if (typeof rest.sort !== "number") {
      return Response.json({ error: "sort must be a number" }, { status: 400 });
    }
    updates.sort = rest.sort;
  }
  // chat_daily_limit / photo_daily_limit must accept an explicit null to mean
  // UNLIMITED -- distinguish "field absent" from "field present and null".
  if (Object.prototype.hasOwnProperty.call(rest, "chat_daily_limit")) {
    if (rest.chat_daily_limit !== null && typeof rest.chat_daily_limit !== "number") {
      return Response.json(
        { error: "chat_daily_limit must be a number or null" },
        { status: 400 }
      );
    }
    updates.chat_daily_limit = rest.chat_daily_limit;
  }
  if (Object.prototype.hasOwnProperty.call(rest, "photo_daily_limit")) {
    if (rest.photo_daily_limit !== null && typeof rest.photo_daily_limit !== "number") {
      return Response.json(
        { error: "photo_daily_limit must be a number or null" },
        { status: 400 }
      );
    }
    updates.photo_daily_limit = rest.photo_daily_limit;
  }
  if (Object.prototype.hasOwnProperty.call(rest, "features")) {
    if (typeof rest.features !== "object" || rest.features === null || Array.isArray(rest.features)) {
      return Response.json({ error: "features must be an object" }, { status: 400 });
    }
    updates.features = rest.features;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const svc = await createServiceClient();

  const { data: before, error: beforeError } = await svc
    .from("plans")
    .select("*")
    .eq("id", id)
    .maybeSingle<PlanRow>();
  if (beforeError) {
    return Response.json({ error: beforeError.message }, { status: 500 });
  }
  if (!before) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  const { data: after, error: updateError } = await svc
    .from("plans")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single<PlanRow>();

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  await auditLog({
    actorUserId: actor.id,
    action: "plan.update",
    targetType: "plan",
    targetId: id,
    before,
    after,
  });
  invalidateLimitsCache();

  return Response.json({ plan: after });
}
