import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { auditLog } from "@/lib/audit";
import { invalidateLimitsCache } from "@/lib/limits";

// Reject any key not in this allowlist so this endpoint can never become a
// generic key/value store that later holds a secret.
const ALLOWED_KEYS = [
  "rate_limits.default",
  "limits.fail_mode",
  "payments.providers.web",
  "payments.providers.ios",
  "payments.providers.android",
] as const;

interface ConfigRow {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const svc = await createServiceClient();
  const { data, error } = await svc.from("app_config").select("*").order("key");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // CRITICAL: presence only, never the actual secret value.
  return Response.json({
    config: data ?? [],
    providers: {
      razorpay: {
        secretPresent: !!process.env.RAZORPAY_KEY_SECRET,
        keyIdPresent: !!process.env.RAZORPAY_KEY_ID,
      },
      stripe: {
        secretPresent: !!process.env.STRIPE_SECRET_KEY,
        webhookSecretPresent: !!process.env.STRIPE_WEBHOOK_SECRET,
        priceIdPresent: !!process.env.STRIPE_PRO_PRICE_ID,
      },
      gemini: {
        keyPresent: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      },
      maps: {
        keyPresent: !!process.env.GOOGLE_MAPS_API_KEY,
      },
      firebase: {
        serviceAccountPresent: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      },
      twilio: {
        authTokenPresent: !!process.env.TWILIO_AUTH_TOKEN,
      },
    },
  });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;
  const { user: actor } = guard;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { key, value } = body as Record<string, unknown>;

  if (typeof key !== "string" || !ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
    return Response.json({ error: "Unknown or disallowed config key" }, { status: 400 });
  }
  if (value === undefined) {
    return Response.json({ error: "value is required" }, { status: 400 });
  }

  const svc = await createServiceClient();

  const { data: before, error: beforeError } = await svc
    .from("app_config")
    .select("*")
    .eq("key", key)
    .maybeSingle<ConfigRow>();
  if (beforeError) {
    return Response.json({ error: beforeError.message }, { status: 500 });
  }

  const { data: after, error } = await svc
    .from("app_config")
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: actor.id,
      },
      { onConflict: "key" }
    )
    .select("*")
    .single<ConfigRow>();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await auditLog({
    actorUserId: actor.id,
    action: "config.set",
    targetType: "config",
    targetId: key,
    before: before ?? null,
    after,
  });

  if (key === "rate_limits.default") {
    invalidateLimitsCache();
  }

  return Response.json({ config: after });
}
