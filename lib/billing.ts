import { nativePlatform } from "@/lib/native-bridge";

/**
 * Client-side checkout routing.
 *
 * The rule that drives all of this: **Apple requires In-App Purchase for
 * digital subscriptions** (App Store Guideline 3.1.1). Two consequences that
 * are easy to get wrong:
 *
 *   1. You may not sell through Razorpay/Stripe inside the iOS build.
 *   2. Anti-steering — you may not even *point at* an external way to pay.
 *      Copy like "finish on the web app" is itself grounds for rejection.
 *
 * So the iOS build must either transact through StoreKit or offer no purchase
 * at all. Until RevenueCat products exist, `canPurchase` comes back false and
 * the paywall shows only the free BYOK path — which is compliant and
 * shippable, rather than a button that cannot complete.
 */

export interface BillingPrice {
  plan_id: string;
  platform: string;
  provider: string;
  amount_minor: number;
  currency: string;
  interval: string;
  store_product_id: string | null;
}

export interface BillingOptions {
  platform: string;
  providers: string[];
  readyProviders: string[];
  canPurchase: boolean;
  prices: BillingPrice[];
}

export async function fetchBillingOptions(): Promise<BillingOptions> {
  const platform = nativePlatform();
  try {
    const res = await fetch(`/api/billing/options?platform=${platform}`);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as BillingOptions;
  } catch {
    // Fail closed: no purchase UI rather than a broken one.
    return { platform, providers: [], readyProviders: [], canPurchase: false, prices: [] };
  }
}

/** Format a minor-unit amount for display, e.g. 74900 INR -> "₹749". */
export function formatPrice(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: major % 1 === 0 ? 0 : 2,
    }).format(major);
  } catch {
    return `${currency} ${major}`;
  }
}

export type CheckoutResult =
  | { status: "redirect"; url: string }
  | { status: "ok" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

/**
 * Begin checkout with whichever provider this platform is configured for.
 *
 * iOS/Android route to the store. That path is deliberately a clear
 * "not configured yet" rather than a stub that pretends to work — wiring it
 * needs the RevenueCat SDK plus products created in App Store Connect / Play
 * Console, neither of which can be faked from here.
 */
export async function startCheckout(
  options: BillingOptions,
  planId: string
): Promise<CheckoutResult> {
  const provider = options.readyProviders[0];

  if (!provider) {
    return {
      status: "unavailable",
      message: "Purchases aren't available on this device yet.",
    };
  }

  if (provider === "apple" || provider === "google") {
    const price = options.prices.find(
      (p) => p.plan_id === planId && p.provider === provider && p.store_product_id
    );
    if (!price?.store_product_id) {
      return { status: "unavailable", message: "Purchases aren't available on this device yet." };
    }
    // TODO(revenuecat): purchaseStoreProduct(price.store_product_id).
    // Requires @revenuecat/purchases-capacitor plus configured products.
    return { status: "unavailable", message: "Purchases aren't available on this device yet." };
  }

  if (provider === "razorpay") {
    try {
      const res = await fetch("/api/subscribe/razorpay", { method: "POST" });
      if (res.status === 401) return { status: "error", message: "Sign in first to upgrade." };
      if (!res.ok) return { status: "error", message: "Couldn't start checkout right now." };
      return { status: "ok" };
    } catch {
      return { status: "error", message: "Network error — try again." };
    }
  }

  if (provider === "stripe") {
    try {
      const res = await fetch("/api/subscribe/stripe", { method: "POST" });
      if (res.status === 401) return { status: "error", message: "Sign in first to upgrade." };
      if (!res.ok) return { status: "error", message: "Couldn't start checkout right now." };
      const data = (await res.json()) as { url?: string };
      if (data.url) return { status: "redirect", url: data.url };
      return { status: "error", message: "Couldn't start checkout right now." };
    } catch {
      return { status: "error", message: "Network error — try again." };
    }
  }

  return { status: "unavailable", message: "Purchases aren't available on this device yet." };
}

/**
 * Restore Purchases — MANDATORY on iOS for any app selling a subscription.
 * Currently a clear no-op; it becomes RevenueCat's restore once wired.
 */
export async function restorePurchases(): Promise<CheckoutResult> {
  return { status: "unavailable", message: "Nothing to restore on this device yet." };
}

/* ────────────────────────────────────────────────────────────────────────────
   Paywall presentation helpers.

   These live here rather than in a screen because BOTH paywalls use them —
   `app/(mobile)/m/paywall` and `components/UpgradeDialog` (web, artboard w5a).
   Each one encodes a correctness fix that a paywall got wrong once already, so
   duplicating them is how the two surfaces start making different claims about
   the same charge.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The offers to actually show.
 *
 * `plan_prices` holds ONE ROW PER PROVIDER — today ₹749 one-time (razorpay)
 * and $9/month (stripe) for the same `pro` plan. Rendering every row put two
 * prices in two currencies for the same thing on screen, both flagged "Best
 * deal". Only the provider that will actually be charged is an offer; the
 * rest are other platforms' pricing.
 */
export function offersFor(options: BillingOptions | null): BillingPrice[] {
  if (!options?.canPurchase) return [];
  const provider = options.readyProviders[0];
  const mine = options.prices.filter((p) => p.provider === provider);
  const rank = (i: string) => (i === "year" ? 0 : i === "month" ? 1 : 2);
  return [...mine].sort((a, b) => rank(a.interval) - rank(b.interval));
}

export function intervalLabel(interval: string): string {
  if (interval === "year") return "Yearly";
  if (interval === "month") return "Monthly";
  return "One payment";
}

/**
 * What the user is actually agreeing to.
 *
 * Razorpay is a SINGLE CHARGE granting 31 days that does NOT renew — see
 * `app/api/subscribe/razorpay/verify`, which sets `periodEnd` to +31 days and
 * nothing reschedules it. Saying "auto-renews" or "cancel anytime" there is
 * plainly false, and on a payment screen a false claim of that kind is both a
 * store-review risk and a chargeback waiting to happen.
 */
export function renewalNote(interval: string): string {
  if (interval === "month") return "Cancel anytime. Auto-renews monthly.";
  if (interval === "year") return "Cancel anytime. Auto-renews yearly.";
  return "One payment for 31 days. Does not auto-renew.";
}

/** Per-month equivalent — only meaningful for a yearly plan. */
export function perMonth(p: BillingPrice): string | null {
  if (p.interval !== "year") return null;
  return `${formatPrice(Math.round(p.amount_minor / 12), p.currency)}/mo`;
}

/**
 * Plan benefits, shared so the two paywalls sell the same product.
 *
 * Every line must be a thing that is actually plan-gated and actually exists.
 * The w5a artboard's "All 4 models" is wrong (`lib/providers` has three) and
 * the mobile artboard's "Rare mascots (yes, golden pineapple)" is an open
 * product question (`.mascot-locked`), not a feature — neither is sold here.
 */
export const PLAN_FEATURES = [
  "Unlimited Bo chats & diet charts",
  "Photo logging with macro breakdowns",
  "Weekly meal planner & grocery bundles",
  "All 3 AI models + Model Arena",
] as const;
