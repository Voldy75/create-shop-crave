import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 5;

const PLATFORMS = new Set(["web", "ios", "android"]);

/**
 * What can this platform actually sell, and at what price?
 *
 * Exists because app/(mobile)/m/paywall hardcoded `fetch("/api/subscribe/razorpay")`
 * for every platform. Apple requires In-App Purchase for digital subscriptions
 * (Guideline 3.1.1) — offering Razorpay inside the iOS build is an automatic
 * rejection, and so is *mentioning* an external way to pay (anti-steering).
 *
 * Reads app_config['payments.providers.<platform>'] plus plan_prices. Returns
 * only public catalogue data: provider names, display prices, store product
 * ids. No secret is read or returned here.
 *
 * `ready` reports whether a provider is actually usable right now. iOS/Android
 * report ready:false until RevenueCat products exist, which lets the paywall
 * fall back to the free BYOK path instead of rendering a purchase button that
 * cannot complete.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const requested = url.searchParams.get("platform") ?? "web";
  const platform = PLATFORMS.has(requested) ? requested : "web";

  const supabase = await createServiceClient();

  const [{ data: configRow }, { data: priceRows }, { data: planRows }] = await Promise.all([
    supabase
      .from("app_config")
      .select("value")
      .eq("key", `payments.providers.${platform}`)
      .maybeSingle(),
    supabase
      .from("plan_prices")
      .select("plan_id, platform, provider, amount_minor, currency, interval, store_product_id")
      .eq("platform", platform)
      .eq("is_active", true),
    supabase
      .from("plans")
      .select("id, name, chat_daily_limit, photo_daily_limit, features, sort")
      .eq("is_active", true)
      .order("sort"),
  ]);

  const providers = Array.isArray(configRow?.value) ? (configRow.value as string[]) : [];

  // A store provider is only usable once a product id is mapped for it.
  const prices = priceRows ?? [];
  const ready = providers.filter((p) => {
    if (p === "apple" || p === "google") {
      return prices.some((r) => r.provider === p && r.store_product_id);
    }
    // Web providers are configured through env vars, checked server-side at
    // checkout time; presence of a price row is the signal here.
    return prices.some((r) => r.provider === p);
  });

  return Response.json({
    platform,
    providers,
    readyProviders: ready,
    // When nothing can transact, the client should offer only the free path.
    canPurchase: ready.length > 0,
    plans: planRows ?? [],
    prices,
  });
}
