interface Coordinates {
  lat: number;
  lng: number;
}

// Affiliate IDs — set in env vars once approved, fall back to UTM-only tracking
const AFFILIATE_IDS = {
  instacart: process.env.NEXT_PUBLIC_AFFILIATE_INSTACART ?? "",
  swiggy: process.env.NEXT_PUBLIC_AFFILIATE_SWIGGY ?? "",
  zomato: process.env.NEXT_PUBLIC_AFFILIATE_ZOMATO ?? "",
  blinkit: process.env.NEXT_PUBLIC_AFFILIATE_BLINKIT ?? "",
  uber: process.env.NEXT_PUBLIC_AFFILIATE_UBER ?? "",
  ola: process.env.NEXT_PUBLIC_AFFILIATE_OLA ?? "",
};

// UTM params appended to every outbound link — works for analytics even before affiliate approval
const UTM = {
  utm_source: "crave_create",
  utm_medium: "referral",
  utm_campaign: "food_discovery",
};

// --- Ingredient Shopping Links ---

export function buildBlinkitLink(item: string): string {
  const params = new URLSearchParams({
    q: item,
    ...UTM,
    utm_content: "ingredient",
    ...(AFFILIATE_IDS.blinkit ? { ref: AFFILIATE_IDS.blinkit } : {}),
  });
  return `https://blinkit.com/s/?${params.toString()}`;
}

export function buildSwiggyInstamartLink(item: string): string {
  const params = new URLSearchParams({
    custom_back: "true",
    query: item,
    ...UTM,
    utm_content: "ingredient",
    ...(AFFILIATE_IDS.swiggy ? { affiliate_id: AFFILIATE_IDS.swiggy } : {}),
  });
  return `https://www.swiggy.com/instamart/search?${params.toString()}`;
}

export function buildInstacartLink(item: string): string {
  const params = new URLSearchParams({
    ...UTM,
    utm_content: "ingredient",
    ...(AFFILIATE_IDS.instacart ? { affiliate: AFFILIATE_IDS.instacart } : {}),
  });
  return `https://www.instacart.com/store/search/${encodeURIComponent(item)}?${params.toString()}`;
}

// --- Ride Booking Links ---

export function buildUberDeepLink(
  pickup: Coordinates,
  dropoff: Coordinates,
  dropoffName: string
): string {
  const params = new URLSearchParams({
    action: "setPickup",
    "pickup[latitude]": String(pickup.lat),
    "pickup[longitude]": String(pickup.lng),
    "pickup[nickname]": "My Location",
    "dropoff[latitude]": String(dropoff.lat),
    "dropoff[longitude]": String(dropoff.lng),
    "dropoff[nickname]": dropoffName,
    ...UTM,
    utm_content: "ride",
    ...(AFFILIATE_IDS.uber ? { client_id: AFFILIATE_IDS.uber } : {}),
  });
  return `https://m.uber.com/ul/?${params.toString()}`;
}

export function buildOlaDeepLink(
  pickup: Coordinates,
  dropoff: Coordinates,
  dropoffName: string
): string {
  const params = new URLSearchParams({
    pickup_lat: String(pickup.lat),
    pickup_lng: String(pickup.lng),
    drop_lat: String(dropoff.lat),
    drop_lng: String(dropoff.lng),
    drop_name: dropoffName,
    ...UTM,
    utm_content: "ride",
    ...(AFFILIATE_IDS.ola ? { ref: AFFILIATE_IDS.ola } : {}),
  });
  return `https://book.olacabs.com/?${params.toString()}`;
}

// --- Navigation Links ---

export function buildGoogleMapsDirectionsLink(
  origin: Coordinates,
  destination: Coordinates
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
}

// --- Food Delivery Links ---

export function buildSwiggyOrderLink(
  dish: string,
  lat?: number,
  lng?: number
): string {
  const params = new URLSearchParams({
    query: dish,
    ...UTM,
    utm_content: "delivery",
    ...(AFFILIATE_IDS.swiggy ? { affiliate_id: AFFILIATE_IDS.swiggy } : {}),
  });
  if (lat !== undefined && lng !== undefined) {
    params.set("lat", String(lat));
    params.set("lng", String(lng));
  }
  return `https://www.swiggy.com/search?${params.toString()}`;
}

export function buildZomatoOrderLink(dish: string, area?: string): string {
  const base = area
    ? `https://www.zomato.com/${encodeURIComponent(area)}/delivery`
    : "https://www.zomato.com/delivery";
  const params = new URLSearchParams({
    q: dish,
    ...UTM,
    utm_content: "delivery",
    ...(AFFILIATE_IDS.zomato ? { ref: AFFILIATE_IDS.zomato } : {}),
  });
  return `${base}?${params.toString()}`;
}
