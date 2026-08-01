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
