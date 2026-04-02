interface Coordinates {
  lat: number;
  lng: number;
}

// --- Ingredient Shopping Links ---

export function buildBlinkitLink(item: string): string {
  return `https://blinkit.com/s/?q=${encodeURIComponent(item)}`;
}

export function buildSwiggyInstamartLink(item: string): string {
  return `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(item)}`;
}

export function buildInstacartLink(item: string): string {
  return `https://www.instacart.com/store/search/${encodeURIComponent(item)}`;
}

// --- Ride Booking Links ---

export function buildUberDeepLink(
  pickup: Coordinates,
  dropoff: Coordinates,
  dropoffName: string
): string {
  const params = new URLSearchParams({
    "action": "setPickup",
    "pickup[latitude]": String(pickup.lat),
    "pickup[longitude]": String(pickup.lng),
    "pickup[nickname]": "My Location",
    "dropoff[latitude]": String(dropoff.lat),
    "dropoff[longitude]": String(dropoff.lng),
    "dropoff[nickname]": dropoffName,
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
  const params = new URLSearchParams({ query: dish });
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
  return `${base}?q=${encodeURIComponent(dish)}`;
}
