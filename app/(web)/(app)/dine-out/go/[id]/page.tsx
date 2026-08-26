"use client";

/**
 * /dine-out/go/[id] — getting there, built to artboard w9c.
 *
 * THIS IS THE MOST HEAVILY TRIMMED SCREEN IN THE REDESIGN, and deliberately so.
 * w9c draws a complete ride-hailing BOOKING flow: nine priced tiers across
 * three providers (Uber Go ₹212 / 28 min, Ola Auto ₹132 / 35 min, Rapido Bike
 * ₹86 / 24 min …), a "Confirm ride · ₹212" button, and a post-confirm state
 * with a named driver, his rating, a number plate, an OTP and "Arriving in
 * 3 min", plus "Bo told the restaurant you're 28 minutes out. Your 8:30 table
 * is held."
 *
 * NONE of that can be backed. This app calls no rides API, cannot book a ride,
 * has no driver feed, and cannot hold a table. Building it would be a button
 * that cannot buy and a promise that cannot be kept — the same defect class as
 * the Restore control that drew an App Store rejection, and as the ₹2,990
 * paywall price that shipped twice. The mobile 7h screen already made this call
 * for fares specifically.
 *
 * WHAT IS REAL, and is therefore what this screen is:
 *  - the route: pickup (the user's location) → drop (the restaurant),
 *  - straight-line distance and an approximate drive time, LABELLED approximate
 *    because it is haversine × 2.5 min/km, not a routing result,
 *  - real hand-off deeplinks to Uber, Ola and Google Maps directions, which are
 *    what actually gets someone there.
 *
 * Rapido is absent because no deeplink builder exists for it and there is no
 * public scheme to write one against — same call as the chat model picker's
 * dropped "Grok".
 */

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Car, MapPin, Navigation } from "lucide-react";
import { AppTopbar } from "@/components/web/AppTopbar";
import { MeshiMap, type MeshiMapPin } from "@/components/web/MeshiMap";
import { useUser } from "@/app/context/UserContext";
import { getActiveRestaurants } from "@/lib/mobile-handoff";
import {
  buildGoogleMapsDirectionsLink,
  buildOlaDeepLink,
  buildUberDeepLink,
} from "@/lib/deeplinks";
import { haversineKm, etaMinutes, formatDistance } from "@/lib/restaurants";
import type { Restaurant } from "@/lib/types";

export default function GoTherePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { location } = useUser();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // sessionStorage read after mount — cannot run during SSR. Same scoped
    // disable and same reason as /cart's hydration effect.
    /* eslint-disable react-hooks/set-state-in-effect */
    const data = getActiveRestaurants();
    const idx = Number(id);
    setRestaurant(data?.restaurants?.[idx] ?? null);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id]);

  // Memoized: a fresh object literal each render would change the identity of
  // every dependent memo below it.
  const drop = useMemo(
    () =>
      typeof restaurant?.lat === "number" && typeof restaurant?.lng === "number"
        ? { lat: restaurant.lat, lng: restaurant.lng }
        : null,
    [restaurant]
  );
  const km = location && drop ? haversineKm(location, drop) : null;

  const pins = useMemo<MeshiMapPin[]>(
    () => (drop && restaurant ? [{ id: 0, lat: drop.lat, lng: drop.lng, label: 1, title: restaurant.name, rating: restaurant.rating }] : []),
    [drop, restaurant]
  );

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const embedUrl = useMemo(() => {
    if (!apiKey || !restaurant) return null;
    const q = drop ? `${drop.lat},${drop.lng}` : restaurant.name;
    return `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${encodeURIComponent(q)}&zoom=14`;
  }, [apiKey, restaurant, drop]);

  if (!hydrated) return <main className="mbody" />;

  if (!restaurant) {
    return (
      <>
        <AppTopbar title="Getting there" onBack="/dine-out" />
        <main className="mbody">
          <div className="card vstack" style={{ margin: "40px auto", maxWidth: 520, padding: 34, gap: 13, alignItems: "center", textAlign: "center" }}>
            <MapPin width={28} height={28} style={{ color: "var(--m-forest)" }} aria-hidden />
            <span className="t-d2">We lost the place</span>
            <span className="t-body-soft">
              Dine-out matches are held for the current session only, so this link
              won&rsquo;t open in a new tab. Ask Bo again and pick the place from the list.
            </span>
            <Link href="/dine-out" className="pill-primary pill-sm" style={{ textDecoration: "none" }}>Back to matches</Link>
          </div>
        </main>
      </>
    );
  }

  const meta = [restaurant.area, restaurant.cuisine, restaurant.priceRange].filter(Boolean).join(" · ");

  return (
    <>
      <AppTopbar
        title={restaurant.name}
        caption={[meta, km !== null ? `${formatDistance(km)} from you` : null].filter(Boolean).join(" · ")}
        onBack="/dine-out"
      />

      <main className="mbody">
        <div className="go-grid">
          <div className="vstack" style={{ gap: 16 }}>
            {/* ── Route card ── */}
            <div className="card vstack" style={{ padding: 18, gap: 13 }}>
              <div className="hstack" style={{ gap: 11 }}>
                <span className="go-dot" aria-hidden />
                <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t-cap">Pickup</span>
                  <span className="t-body">{location ? "Your current location" : "Location not set"}</span>
                </div>
              </div>
              <i style={{ height: 1, background: "var(--m-ink-faint)", display: "block" }} aria-hidden />
              <div className="hstack" style={{ gap: 11 }}>
                <MapPin width={17} height={17} style={{ color: "var(--m-forest)", flex: "none" }} aria-hidden />
                <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t-cap">Drop</span>
                  <span className="t-body">{restaurant.name}</span>
                  {restaurant.area && <span className="t-cap">{restaurant.area}</span>}
                </div>
                {km !== null && (
                  <span className="chip pill-sm" style={{ flex: "none" }}>~{etaMinutes(km)}</span>
                )}
              </div>
            </div>

            {/* ── Hand-offs. No fares: see the header note. ── */}
            <div className="card vstack" style={{ padding: 18, gap: 13 }}>
              <div className="vstack" style={{ gap: 3 }}>
                <span className="t-d2" style={{ fontSize: 18 }}>Open a ride</span>
                <span className="t-body-soft">
                  Fares and pickup times are quoted by the app you choose — meshi
                  doesn&rsquo;t have a live price feed, so it won&rsquo;t guess.
                </span>
              </div>

              {location && drop ? (
                <div className="vstack" style={{ gap: 9 }}>
                  <a className="rideo" href={buildUberDeepLink(location, drop, restaurant.name)} target="_blank" rel="noopener noreferrer">
                    <span className="go-brand mp-uber" aria-hidden><Car width={17} height={17} /></span>
                    <span className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                      <span className="t-h2" style={{ fontSize: 15 }}>Uber</span>
                      <span className="t-cap">Pickup and drop pre-filled</span>
                    </span>
                    <Navigation width={15} height={15} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
                  </a>

                  <a className="rideo" href={buildOlaDeepLink(location, drop, restaurant.name)} target="_blank" rel="noopener noreferrer">
                    <span className="go-brand mp-ola" aria-hidden><Car width={17} height={17} /></span>
                    <span className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                      <span className="t-h2" style={{ fontSize: 15 }}>Ola</span>
                      <span className="t-cap">Pickup and drop pre-filled</span>
                    </span>
                    <Navigation width={15} height={15} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
                  </a>

                  <a className="rideo" href={buildGoogleMapsDirectionsLink(location, drop)} target="_blank" rel="noopener noreferrer">
                    <span className="go-brand mp-dir" aria-hidden><Navigation width={17} height={17} /></span>
                    <span className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                      <span className="t-h2" style={{ fontSize: 15 }}>Directions</span>
                      <span className="t-cap">Drive, walk or transit in Google Maps</span>
                    </span>
                    <Navigation width={15} height={15} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
                  </a>
                </div>
              ) : (
                <span className="t-cap">
                  {location
                    ? "This place has no map coordinates, so a route can't be built."
                    : "Set your location to build a route to this place."}
                </span>
              )}

              {km !== null && (
                <span className="t-cap">
                  ~{formatDistance(km)} in a straight line, about {etaMinutes(km)} driving. Real
                  routes are longer.
                </span>
              )}
            </div>
          </div>

          <div className="go-map">
            <MeshiMap
              pins={pins}
              center={drop ?? location ?? { lat: 19.076, lng: 72.877 }}
              selectedId={0}
              onSelect={() => {}}
              apiKey={apiKey}
              embedFallbackUrl={embedUrl}
            />
          </div>
        </div>
      </main>
    </>
  );
}
