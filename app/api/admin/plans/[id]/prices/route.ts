import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { auditLog } from "@/lib/audit";

const PLATFORMS = ["web", "ios", "android"] as const;
const PROVIDERS = ["razorpay", "stripe", "apple", "google"] as const;
const INTERVALS = ["one_time", "month", "year"] as const;

interface PlanPriceRow {
  plan_id: string;
  platform: string;
  provider: string;
  amount_minor: number;
  currency: string;
  interval: string;
  store_product_id: string | null;
  is_active: boolean;
  created_at: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const { id } = await params;
  if (!id) {
    return Response.json({ error: "Missing plan id" }, { status: 400 });
  }

  const svc = await createServiceClient();
  const { data, error } = await svc
    .from("plan_prices")
    .select("*")
    .eq("plan_id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ prices: data ?? [] });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;
  const { user: actor } = guard;

  const { id: planId } = await params;
  if (!planId) {
    return Response.json({ error: "Missing plan id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    platform,
    provider,
    amount_minor,
    currency,
    interval,
    store_product_id,
    is_active,
  } = body as Record<string, unknown>;

  if (typeof platform !== "string" || !PLATFORMS.includes(platform as (typeof PLATFORMS)[number])) {
    return Response.json({ error: "Invalid platform" }, { status: 400 });
  }
  if (typeof provider !== "string" || !PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
    return Response.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (typeof amount_minor !== "number" || !Number.isInteger(amount_minor) || amount_minor < 0) {
    return Response.json({ error: "amount_minor must be a non-negative integer" }, { status: 400 });
  }
  if (typeof currency !== "string" || !currency.trim()) {
    return Response.json({ error: "currency is required" }, { status: 400 });
  }
  if (typeof interval !== "string" || !INTERVALS.includes(interval as (typeof INTERVALS)[number])) {
    return Response.json({ error: "Invalid interval" }, { status: 400 });
  }
  if (store_product_id !== undefined && store_product_id !== null && typeof store_product_id !== "string") {
    return Response.json({ error: "store_product_id must be a string" }, { status: 400 });
  }
  if (is_active !== undefined && typeof is_active !== "boolean") {
    return Response.json({ error: "is_active must be a boolean" }, { status: 400 });
  }

  const svc = await createServiceClient();

  // Confirm the plan exists so a typo'd plan_id doesn't silently create an
  // orphaned price row (the FK would catch it anyway, but this gives a
  // clearer 404 instead of a raw constraint error).
  const { data: plan, error: planError } = await svc
    .from("plans")
    .select("id")
    .eq("id", planId)
    .maybeSingle();
  if (planError) {
    return Response.json({ error: planError.message }, { status: 500 });
  }
  if (!plan) {
    return Response.json({ error: "Plan not found" }, { status: 404 });
  }

  const { data: before } = await svc
    .from("plan_prices")
    .select("*")
    .eq("plan_id", planId)
    .eq("platform", platform)
    .eq("provider", provider)
    .maybeSingle<PlanPriceRow>();

  const row: Record<string, unknown> = {
    plan_id: planId,
    platform,
    provider,
    amount_minor,
    currency,
    interval,
    store_product_id: store_product_id ?? null,
    is_active: is_active ?? true,
  };

  const { data: after, error } = await svc
    .from("plan_prices")
    .upsert(row, { onConflict: "plan_id,platform,provider" })
    .select("*")
    .single<PlanPriceRow>();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await auditLog({
    actorUserId: actor.id,
    action: "plan_price.upsert",
    targetType: "plan_price",
    targetId: `${planId}:${platform}:${provider}`,
    before: before ?? null,
    after,
  });

  return Response.json({ price: after });
}
