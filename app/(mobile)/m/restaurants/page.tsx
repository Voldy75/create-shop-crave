"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Search, MapPin as PinIcon, Navigation, Car, Footprints, ExternalLink } from "lucide-react";
import { getActiveRestaurants } from "@/lib/mobile-handoff";
import { foodImage } from "@/lib/food-images";
import RestaurantMap, { type MapPin } from "@/components/mobile/RestaurantMap";
import { CarrotRating } from "@/components/mobile/CarrotRating";
import { Carrot } from "@/components/mascots";
import { useUser } from "@/app/context/UserContext";
import {
  buildGoogleMapsDirectionsLink,
  buildUberDeepLink,
  buildOlaDeepLink,
  buildSwiggyOrderLink,
  buildZomatoOrderLink,
} from "@/lib/deeplinks";
import type { RestaurantSuggestion } from "@/lib/types";

/**
 * meshi Restaurants — built to the Flow 2 "Restaurants" artboard.
 *
 * Map-first: search + filter chips floating over the map, numbered teardrop
 * pins, and ONE detail card pinned to the bottom for the selected spot —
 * replacing the horizontal carousel of cards the previous version used.
 * Tapping a pin swaps the card.
 *
 * The artboard's illustrated map is its stand-in for live tiles; we keep the
 * real map, restyled to the meshi palette. See components/mobile/RestaurantMap.
 *
 * Deeplinks: Directions, Uber, Ola, Swiggy, Zomato. The "Go there" mode is
 * artboard 7h (dine-in) folded into this card rather than given its own
 * route — 7h's header, rating row and distance badge are all already here,
 * and a second screen would have duplicated the selection state.
 */

const SAMPLE: RestaurantSuggestion = {
  query: "butter chicken",
  reason: "Top butter chicken near you",
  dishName: "Butter Chicken",
  restaurants: [
    { name: "Bukhara", rating: "4.7", priceRange: "₹₹₹", area: "1.2 km", cuisine: "North Indian", lat: 28.6, lng: 77.2, zomatoUrl: "", swiggyUrl: "" },
    { name: "Punjab Grill", rating: "4.5", priceRange: "₹₹", area: "2.0 km", cuisine: "North Indian", lat: 28.61, lng: 77.21, zomatoUrl: "", swiggyUrl: "" },
    { name: "Made in Punjab", rating: "4.4", priceRange: "₹₹", area: "2.4 km", cuisine: "North Indian", lat: 28.62, lng: 77.19, zomatoUrl: "", swiggyUrl: "" },
  ],
};

const FILTERS = ["Open now", "Under ₹₹", "4+"] as const;

/** "4.6" → 5 carrots-worth of fill, rounded to the nearest whole carrot. */
function carrotsFor(rating: string | undefined): number {
  const n = Number(rating);
  return Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : 4;
}

/** Great-circle km between two points. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Rough drive/walk minutes from straight-line distance.
 *
 * Artboard 7h shows "12 min drive / 28 min walk" next to per-ride FARES and
 * pickup ETAs. The fares and pickup times are NOT built and should not be:
 * they need a rides API we do not call, and inventing them on the screen a
 * user is deciding from is exactly the fabricated-data trap the recipe
 * carrot rating and the 4f stepper were both held back over.
 *
 * These two numbers are different — they are derived from the real distance
 * between the user and the restaurant, and are labelled "approx" because a
 * straight line is not a road. 25 km/h is a conservative urban driving
 * average; 4.8 km/h is a normal walking pace.
 */
function travelEstimate(km: number): { drive: number; walk: number } {
  return {
    drive: Math.max(1, Math.round((km / 25) * 60)),
    walk: Math.max(1, Math.round((km / 4.8) * 60)),
  };
}

export default function MobileRestaurants() {
  const router = useRouter();
  const { location } = useUser();
  const [sugg, setSugg] = useState<RestaurantSuggestion | null>(null);
  const [active, setActive] = useState(1);
  const [filters, setFilters] = useState<string[]>(["Open now"]);
  const [mode, setMode] = useState<"go" | "order">("go");

  useEffect(() => {
    setSugg(getActiveRestaurants() ?? SAMPLE);
  }, []);

  if (!sugg) return <div style={{ minHeight: "100dvh", background: "var(--m-cream)" }} />;

  const list = (sugg.restaurants ?? []).slice(0, 5);
  const pins: MapPin[] = list
    .map((r, i) =>
      typeof r.lat === "number" && typeof r.lng === "number"
        ? { lat: r.lat, lng: r.lng, label: i + 1, title: r.name }
        : null,
    )
    .filter((p): p is MapPin => p !== null);

  const dish = sugg.dishName ?? sugg.query;
  const selected = list[active - 1] ?? list[0];

  const hasCoords = typeof selected?.lat === "number" && typeof selected?.lng === "number";
  const dirHref =
    hasCoords && location
      ? buildGoogleMapsDirectionsLink(location, { lat: selected.lat!, lng: selected.lng! })
      : `https://www.google.com/maps/search/${encodeURIComponent(selected?.name ?? "")}`;
  const uberHref =
    hasCoords && location
      ? buildUberDeepLink(location, { lat: selected.lat!, lng: selected.lng! }, selected.name)
      : "https://m.uber.com/";
  const olaHref =
    hasCoords && location
      ? buildOlaDeepLink(location, { lat: selected.lat!, lng: selected.lng! }, selected.name)
      : "https://book.olacabs.com/";
  // Needs BOTH ends to be real — without the user's location there is no
  // distance to derive, and a guess here would be worse than no chip.
  const travel =
    hasCoords && location
      ? travelEstimate(distanceKm(location, { lat: selected.lat!, lng: selected.lng! }))
      : null;
  const swiggyHref = selected?.swiggyUrl || buildSwiggyOrderLink(dish, location?.lat, location?.lng);
  const zomatoHref = selected?.zomatoUrl || buildZomatoOrderLink(dish, selected?.area);

  const toggleFilter = (f: string) =>
    setFilters((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  return (
    <div style={{ minHeight: "100dvh", background: "var(--m-cream)", position: "relative", overflow: "hidden" }}>
      <RestaurantMap pins={pins} center={location} activeLabel={active} onSelect={setActive} />

      {/* Search + filters, floating over the map */}
      <div
        className="vstack"
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 12px) + 8px)",
          left: 16, right: 16, zIndex: 3, gap: 10,
        }}
      >
        <div className="hstack">
          <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft width={20} height={20} />
          </button>
          <div className="input grow" style={{ height: 44, boxShadow: "var(--m-shadow)", marginLeft: 10 }}>
            <Search width={18} height={18} style={{ color: "var(--m-ink-soft)" }} />
            <span
              className="grow"
              style={{ color: "var(--m-ink)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {dish} near me
            </span>
          </div>
        </div>

        <div className="hstack" style={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`chip ${filters.includes(f) ? "chip-active" : ""}`}
              onClick={() => toggleFilter(f)}
              aria-pressed={filters.includes(f)}
            >
              {f}
              {f === "4+" && <Carrot width={15} height={15} />}
            </button>
          ))}
        </div>
      </div>

      {/* Selected spot — one card, per the artboard */}
      {selected && (
        <div className="card" style={{ position: "absolute", bottom: 24, left: 16, right: 16, zIndex: 3 }}>
          <div className="vstack" style={{ padding: 14, gap: 10 }}>
            <div className="hstack" style={{ gap: 12 }}>
              <div
                className="imgfill"
                style={{
                  width: 56, height: 56, borderRadius: 14, position: "relative", flex: "none",
                  backgroundImage: `url('${foodImage(dish) || foodImage(selected.cuisine) || ""}')`,
                }}
              >
                <span
                  style={{
                    position: "absolute", top: -7, left: -7, width: 24, height: 24,
                    borderRadius: "50%", background: "var(--m-burnt)", color: "var(--m-on-deep)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    font: "800 13px var(--m-font-display)", boxShadow: "0 0 0 2.5px var(--m-card)",
                  }}
                >
                  {active}
                </span>
              </div>

              <div className="vstack grow" style={{ gap: 3, minWidth: 0 }}>
                <span className="t-h2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selected.name}
                </span>
                <div className="hstack" style={{ gap: 6 }}>
                  <CarrotRating value={carrotsFor(selected.rating)} size={15} />
                  <span className="t-cap" style={{ color: "var(--m-ink)" }}>{selected.rating}</span>
                </div>
              </div>

              <a
                className="pill-primary pill-sm"
                style={{ flex: "none" }}
                href={mode === "go" ? uberHref : swiggyHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {mode === "go" ? "Ride" : "Order"}
              </a>
            </div>

            <div className="hstack" style={{ gap: 6, flexWrap: "wrap" }}>
              <span className="chip chip-tag" style={{ background: "var(--m-tint-peach)", color: "var(--m-burnt)", height: 26 }}>
                {selected.priceRange}
              </span>
              <span className="chip chip-tag" style={{ background: "var(--m-tint-green)", color: "var(--m-forest)", height: 26, gap: 4 }}>
                <PinIcon width={12} height={12} />
                {selected.area}
              </span>
              {selected.cuisine && (
                <span className="chip chip-tag" style={{ height: 26, background: "var(--m-cream-2)", color: "var(--m-ink-soft)" }}>
                  {selected.cuisine}
                </span>
              )}
            </div>

            {/* 7h's drive/walk readout. "approx" is load-bearing — this is a
                straight-line estimate, not a routed one. */}
            {mode === "go" && travel && (
              <div className="hstack" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="chip chip-tag" style={{ height: 26, gap: 4, background: "var(--m-card)", color: "var(--m-ink)" }}>
                  <Car width={12} height={12} />
                  ~{travel.drive} min drive
                </span>
                <span className="chip chip-tag" style={{ height: 26, gap: 4, background: "var(--m-card)", color: "var(--m-ink-soft)" }}>
                  <Footprints width={12} height={12} />
                  ~{travel.walk} min walk
                </span>
                <span className="t-micro" style={{ alignSelf: "center" }}>approx</span>
              </div>
            )}

            {/* Go there / Order in — decides what the primary action and the
                secondary links below do. */}
            <div className="hstack" style={{ gap: 6 }}>
              {mode === "go" ? (
                <>
                  <a className="pill-secondary pill-sm" style={{ flex: 1 }} href={dirHref} target="_blank" rel="noopener noreferrer">
                    <Navigation width={14} height={14} />
                    Directions
                  </a>
                  {/* Ola sits beside Uber because 7h offers a CHOICE of ride.
                      buildOlaDeepLink already existed and only the web tree
                      consumed it — this screen shipped Uber-only by omission,
                      not by decision. */}
                  <a className="pill-tonal pill-sm" style={{ flex: 1 }} href={olaHref} target="_blank" rel="noopener noreferrer">
                    <Car width={14} height={14} />
                    Ola
                  </a>
                  <button className="pill-tonal pill-sm" style={{ flex: 1 }} onClick={() => setMode("order")}>
                    Order in
                  </button>
                </>
              ) : (
                <>
                  <a className="pill-secondary pill-sm" style={{ flex: 1 }} href={zomatoHref} target="_blank" rel="noopener noreferrer">
                    Zomato
                    <ExternalLink width={12} height={12} />
                  </a>
                  <button className="pill-tonal pill-sm" style={{ flex: 1 }} onClick={() => setMode("go")}>
                    <Navigation width={14} height={14} />
                    Go there
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
