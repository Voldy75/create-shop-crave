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

/**
 * Uber universal link with the destination pre-filled.
 *
 * `pickup` is optional: without the user's location we send
 * `pickup=my_location`, which tells the Uber app to use the phone's GPS, so
 * the rider still lands on a booking screen with the restaurant as the drop
 * instead of a blank app. `dropoffAddress`, when known, is shown by Uber
 * under the nickname so the rider can confirm the right branch. `dropoff` is
 * null when we only know the place by name and address (Bo's ride card).
 */
export function buildUberDeepLink(
  pickup: Coordinates | null | undefined,
  dropoff: Coordinates | null,
  dropoffName: string,
  dropoffAddress?: string
): string {
  const params = new URLSearchParams({ action: "setPickup" });
  if (pickup) {
    params.set("pickup[latitude]", String(pickup.lat));
    params.set("pickup[longitude]", String(pickup.lng));
    params.set("pickup[nickname]", "My Location");
  } else {
    params.set("pickup", "my_location");
  }
  if (dropoff) {
    params.set("dropoff[latitude]", String(dropoff.lat));
    params.set("dropoff[longitude]", String(dropoff.lng));
  }
  params.set("dropoff[nickname]", dropoffName);
  // Some sources put a distance ("1.2 km") in the area field — never send
  // that to Uber as an address.
  if (dropoffAddress && !/^\s*[\d.]+\s*(km|m|mi)\b/i.test(dropoffAddress)) {
    params.set("dropoff[formatted_address]", dropoffAddress);
  }
  for (const [k, v] of Object.entries({ ...UTM, utm_content: "ride" })) params.set(k, v);
  if (AFFILIATE_IDS.uber) params.set("client_id", AFFILIATE_IDS.uber);
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

// --- Dining Out (Swiggy Dineout) ---

/**
 * Swiggy Dineout's table-booking listing. Checked by hand 2026-10-24: Dineout
 * has no search URL to pre-fill (typing a name on the page does not change the
 * URL), and a specific restaurant's page needs Swiggy's own restaurant id,
 * which only the Dineout MCP returns. So this opens the listing for the
 * user's area (Swiggy picks it from their location) and the UI says "find a
 * table", never "book <name>". Booking a specific table goes through Bo
 * (Dineout MCP: search → get_available_slots → book_table).
 */
export function buildDineoutLink(): string {
  const params = new URLSearchParams({ ...UTM, utm_content: "dineout" });
  return `https://www.swiggy.com/dineout?${params.toString()}`;
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

// --- Music while cooking (Spotify) ---

/**
 * A mood for the cooking playlist, guessed from the dish name. Deliberately a
 * short keyword list: it only picks the search words, and anything unmatched
 * falls back to a plain "cooking" search, which is always a sensible result.
 */
export function cookingMood(dishName: string): { query: string; label: string } {
  const n = dishName.toLowerCase();
  const has = (words: string[]) => words.some((w) => n.includes(w));
  if (has(["curry", "masala", "biryani", "paneer", "dal", "tikka", "pulao", "chole", "rajma", "korma", "makhani", "tandoori", "sambar", "dosa", "idli", "raita", "sabzi", "paratha", "khichdi", "butter chicken", "aloo", "gobi", "palak", "naan", "kofta", "vindaloo", "kadai", "bhaji", "upma", "poha", "halwa", "kheer"]))
    return { query: "bollywood cooking", label: "Bollywood" };
  if (has(["pasta", "risotto", "pizza", "lasagna", "gnocchi", "pesto", "carbonara", "bruschetta"]))
    return { query: "italian dinner", label: "Italian dinner" };
  if (has(["taco", "burrito", "enchilada", "quesadilla", "nachos", "salsa", "fajita"]))
    return { query: "latin cooking", label: "Latin" };
  if (has(["ramen", "sushi", "pho", "noodle", "dumpling", "stir fry", "stir-fry", "teriyaki", "kimchi", "fried rice"]))
    return { query: "lofi cooking", label: "Lo-fi" };
  return { query: "cooking", label: "Cooking" };
}

/**
 * Spotify playlist search for the dish's mood. A plain link — no Spotify
 * account connection, no API, no approval needed: open.spotify.com opens the
 * Spotify app when it is installed (universal / app links) and the web player
 * otherwise. Checked 2026-10-24: /search/<q>/playlists returns the player.
 * (Spotify's own MCP is an approved-clients pilot, and its Web API keeps new
 * apps to a few named test users — see handoff.md.)
 */
export function buildSpotifyCookingLink(dishName: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(cookingMood(dishName).query)}/playlists`;
}
