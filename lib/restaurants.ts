/**
 * restaurants — geometry, ETA and image helpers shared by every surface that
 * renders a restaurant list.
 *
 * These all lived privately inside components/RestaurantView.tsx. /dine-out
 * needs the same maths, and two copies of a distance function is how the same
 * restaurant ends up "11.2 km" on one screen and "11.4 km" on another — the
 * divergence lib/pantry.ts and lib/billing's paywall helpers were both
 * extracted to prevent.
 */

export type Coords = { lat: number; lng: number };

export function haversineKm(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Rough urban driving estimate, ~2.5 min/km, floored at 2 min. This is a
 * STRAIGHT-LINE distance turned into a time, so it is genuinely approximate —
 * always label it as such in the UI. It is not a routing API result.
 */
export function etaMinutes(km: number): string {
  return `${Math.max(2, Math.round(km * 2.5))} min`;
}

/** Parse "4.3" / "4.3 ★" / "Rated 4.3" to a number; 0 when absent. */
export function ratingNumber(rating: string | undefined): number {
  if (!rating) return 0;
  const m = rating.match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

/**
 * DECORATIVE food photography, keyed by list position so a given card keeps the
 * same picture across re-renders and sorts.
 *
 * This is NOT the venue's own photography and must never be presented as such —
 * no platform gives us restaurant imagery. Same pool RestaurantView has used
 * since Phase 10c.
 */
const IMAGE_POOL = [
  "1517248135467-4c7edcad34c4",
  "1552566626-52f8b828add9",
  "1555396273-367ea4eb4db5",
  "1414235077428-338989a2e8c0",
  "1600891964092-4316c288032e",
];

export function restaurantImage(index: number): string {
  const id = IMAGE_POOL[index % IMAGE_POOL.length];
  return `https://images.unsplash.com/photo-${id}?w=400&h=300&fit=crop&auto=format`;
}
