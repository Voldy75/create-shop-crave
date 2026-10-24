/**
 * partners — which outside services the app offers, decided in ONE place.
 *
 * Launch decision (2026-10-24): Swiggy only. Food delivery is Swiggy, grocery
 * is Swiggy Instamart, dining out is Swiggy Dineout. Zomato, Blinkit and
 * Instacart are switched OFF, and so is the paywall (meshi+ pass).
 *
 * They are switched off with feature flags, not deleted, so any of them comes
 * back from Admin → Flags with no deploy:
 *
 *   partner_zomato     Zomato links (food delivery + dining out)
 *   partner_blinkit    Blinkit grocery links
 *   partner_instacart  Instacart grocery links (and its Connections row)
 *   partner_spotify    "Cook with a soundtrack" Spotify link (cooking views)
 *   pro_upgrade        the paywall: every upgrade / buy-a-pass surface
 *
 * Swiggy, Instamart, Dineout, Uber and Ola are NOT flag-gated here — they are
 * the launch set. (Connecting a Swiggy ACCOUNT for in-app ordering is a
 * separate flag, mcp_swiggy, owned by the Connections screens.)
 *
 * FAIL CLOSED: a flag that is missing or not yet loaded reads as false, so
 * the switchable partners are hidden until the flags say otherwise and the
 * launch set never flickers. Stored data is not rewritten — recipes saved
 * with Blinkit links keep them — the surfaces filter at render time.
 */

export const PARTNER_FLAGS = {
  zomato: "partner_zomato",
  blinkit: "partner_blinkit",
  instacart: "partner_instacart",
  spotify: "partner_spotify",
  paywall: "pro_upgrade",
} as const;

export interface Partners {
  zomato: boolean;
  blinkit: boolean;
  instacart: boolean;
  /** "Cook with a soundtrack" — a Spotify playlist link in the cooking views. */
  spotify: boolean;
  /** The meshi+ paywall: upgrade prompts, the /m/paywall screen, checkout. */
  paywall: boolean;
}

/** Resolve the partner switches from a flag map. Missing = off. */
export function partnersFrom(flags: Record<string, boolean>): Partners {
  return {
    zomato: flags[PARTNER_FLAGS.zomato] === true,
    blinkit: flags[PARTNER_FLAGS.blinkit] === true,
    instacart: flags[PARTNER_FLAGS.instacart] === true,
    spotify: flags[PARTNER_FLAGS.spotify] === true,
    paywall: flags[PARTNER_FLAGS.paywall] === true,
  };
}

/** Grocery platforms, as stored on ShoppingLink.platform. */
export type GroceryPlatform = "swiggy_instamart" | "blinkit" | "instacart";

/** Is this grocery platform offered right now? Instamart always is. */
export function groceryOffered(p: Partners, platform: string): boolean {
  if (platform === "swiggy_instamart") return true;
  if (platform === "blinkit") return p.blinkit;
  if (platform === "instacart") return p.instacart;
  return false;
}

/** Everything off — the server-side and pre-load default. */
export const LAUNCH_DEFAULTS: Partners = { zomato: false, blinkit: false, instacart: false, spotify: false, paywall: false };
