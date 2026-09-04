"use client";

/**
 * /dine-out — matched places, in two view modes.
 *
 * ONE ROUTE, NOT THREE. w9d, w9e and w7c all print the SAME fake URL
 * (app.meshi.app/bo/dine-out), so they are three treatments of one screen, not
 * three screens: w9e's accordion is the list mode, w7c's full-bleed map is the
 * map mode, and w9d contributes its sort control. w9d's own card layout is not
 * built separately — it and w9e are alternative passes at the same list, and
 * w9e is the later one ("second pass — one place open at a time").
 *
 * WHAT THESE ARTBOARDS DRAW THAT IS NOT BUILT, and why (the honest-data rule):
 *  - MATCH SCORES ("92% match"). Nothing computes a similarity between a dish
 *    and a restaurant. Bo returns an ORDERED list, so rank is real and is what
 *    is shown; a percentage would be invented precision.
 *  - PER-RIDE FARES ("Uber ₹212 · Ola ₹205 · Rapido ₹86"). This app calls no
 *    rides API. The mobile 7h screen already made exactly this call — "per-ride
 *    fares and pickup ETAs are deliberately NOT built" — because inventing
 *    numbers on a screen someone is deciding from is the fabricated-data
 *    mistake the recipe carrot rating and the 4f stepper were both held back
 *    over. The ride buttons are real deeplinks with no price on them.
 *  - RAPIDO. There is no Rapido deeplink builder and no public scheme to write
 *    one against, so it is not rendered — same category as the chat model
 *    picker's dropped "Grok" and sign-in's dropped "Continue with Apple".
 *  - DISH NAMES AND PRICES PER RESTAURANT ("Green goddess salad · ₹420"). No
 *    platform gives us a menu. The dish CONTEXT (what the user asked Bo for) is
 *    real and is shown once, in the header.
 *  - Per-restaurant PHOTOS. RestaurantView's Unsplash IMAGE_POOL is decoration
 *    keyed by index, so it is reused here the same way and never presented as
 *    the venue's own photography.
 *
 * Distance and drive ETA ARE real — haversine from the user's location, at the
 * same ~2.5 min/km used elsewhere — and are labelled as approximate.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Car, List, MapIcon, Navigation, Sparkles, Utensils } from "lucide-react";
import { AppTopbar } from "@/components/web/AppTopbar";
import { MeshiMap, pinTone, type MeshiMapPin } from "@/components/web/MeshiMap";
import { useUser } from "@/app/context/UserContext";
import { getActiveRestaurants } from "@/lib/mobile-handoff";
import { MascotFor } from "@/components/mascots";
import {
  buildGoogleMapsDirectionsLink,
  buildOlaDeepLink,
  buildSwiggyOrderLink,
  buildUberDeepLink,
  buildZomatoOrderLink,
} from "@/lib/deeplinks";
import { restaurantImage, haversineKm, etaMinutes, formatDistance, ratingNumber } from "@/lib/restaurants";
import type { Restaurant, RestaurantSuggestion } from "@/lib/types";

type SortKey = "rank" | "distance" | "rating" | "price";
type Mode = "list" | "map";

const SORTS: Array<{ key: SortKey; label: string; needsLocation?: boolean }> = [
  { key: "rank", label: "Best match" },
  { key: "distance", label: "Nearest", needsLocation: true },
  { key: "rating", label: "Top rated" },
  { key: "price", label: "Price" },
];

export default function DineOutPage() {
  return (
    <Suspense fallback={null}>
      <DineOutInner />
    </Suspense>
  );
}

function DineOutInner() {
  const params = useSearchParams();
  const { location } = useUser();

  const [data, setData] = useState<RestaurantSuggestion | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sort, setSort] = useState<SortKey>("rank");
  const [mode, setMode] = useState<Mode>(params.get("view") === "map" ? "map" : "list");
  const [openId, setOpenId] = useState<number>(0);

  useEffect(() => {
    // sessionStorage read after mount — cannot run during SSR. Same scoped
    // disable and same reason as /cart's hydration effect.
    /* eslint-disable react-hooks/set-state-in-effect */
    setData(getActiveRestaurants());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const all = useMemo(
    () => (data?.restaurants ?? []).map((r, i) => ({ ...r, id: i })),
    [data]
  );

  const sorted = useMemo(() => {
    const list = [...all];
    if (sort === "rating") list.sort((a, b) => ratingNumber(b.rating) - ratingNumber(a.rating));
    if (sort === "price") list.sort((a, b) => (a.priceRange?.length ?? 9) - (b.priceRange?.length ?? 9));
    if (sort === "distance" && location) {
      list.sort((a, b) => {
        const da = a.lat && a.lng ? haversineKm(location, { lat: a.lat, lng: a.lng }) : Infinity;
        const db = b.lat && b.lng ? haversineKm(location, { lat: b.lat, lng: b.lng }) : Infinity;
        return da - db;
      });
    }
    return list;
  }, [all, sort, location]);

  const pins = useMemo<MeshiMapPin[]>(
    () =>
      sorted
        .filter((r) => typeof r.lat === "number" && typeof r.lng === "number")
        .map((r, i) => ({ id: r.id, lat: r.lat as number, lng: r.lng as number, label: i + 1, title: r.name, rating: r.rating })),
    [sorted]
  );

  const etaRange = useMemo(() => {
    if (!location) return null;
    const mins = sorted
      .filter((r) => r.lat && r.lng)
      .map((r) => Math.max(2, Math.round(haversineKm(location, { lat: r.lat as number, lng: r.lng as number }) * 2.5)));
    if (mins.length === 0) return null;
    const lo = Math.min(...mins), hi = Math.max(...mins);
    return lo === hi ? `${lo} min` : `${lo}–${hi} min`;
  }, [sorted, location]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const embedUrl = useMemo(() => {
    if (!apiKey || sorted.length === 0) return null;
    const first = sorted[0];
    const q = first.lat && first.lng ? `${first.lat},${first.lng}` : first.name;
    return `https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${encodeURIComponent(q)}&zoom=13`;
  }, [apiKey, sorted]);

  if (!hydrated) return <main className="mbody" />;

  if (sorted.length === 0) {
    return (
      <>
        <AppTopbar title="Dine out" caption="Places Bo matched for you" />
        <main className="mbody">
          <div className="card vstack" style={{ margin: "40px auto", maxWidth: 520, padding: 34, gap: 13, alignItems: "center", textAlign: "center" }}>
            <Utensils width={28} height={28} style={{ color: "var(--m-forest)" }} aria-hidden />
            <span className="t-d2">Nothing matched yet</span>
            <span className="t-body-soft">
              Ask Bo where to eat and the matches land here, with routes and rides.
            </span>
            <Link href="/chat" className="pill-primary" style={{ textDecoration: "none" }}>Ask Bo where to eat</Link>
          </div>
        </main>
      </>
    );
  }

  const dish = data?.dishName;

  return (
    <>
      <AppTopbar
        title="Eat it out instead"
        caption={
          [
            `${sorted.length} place${sorted.length === 1 ? "" : "s"} near you`,
            etaRange ? `${etaRange} by cab` : null,
          ].filter(Boolean).join(" · ")
        }
        onBack="/chat"
      >
        <div className="dseg" role="tablist" aria-label="View mode">
          <button role="tab" aria-selected={mode === "list"} className={mode === "list" ? "is-active" : ""} onClick={() => setMode("list")}>
            <List width={15} height={15} aria-hidden /> List
          </button>
          <button role="tab" aria-selected={mode === "map"} className={mode === "map" ? "is-active" : ""} onClick={() => setMode("map")}>
            <MapIcon width={15} height={15} aria-hidden /> Map
          </button>
        </div>
      </AppTopbar>

      {mode === "list" ? (
        <main className="mbody">
          <div className="vstack" style={{ gap: 20, padding: "22px 32px 40px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
            {dish && (
              <div className="card hstack" style={{ padding: 16, gap: 13, flexWrap: "wrap" }}>
                <Sparkles width={20} height={20} style={{ color: "var(--m-forest)", flex: "none" }} aria-hidden />
                <div className="vstack grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="t-h2">Instead of cooking · {dish}</span>
                  {data?.reason && <span className="t-cap">{data.reason}</span>}
                </div>
              </div>
            )}

            <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
              <div className="dseg" role="tablist" aria-label="Sort places">
                {SORTS.filter((s) => !s.needsLocation || location).map((s) => (
                  <button
                    key={s.key}
                    role="tab"
                    aria-selected={sort === s.key}
                    className={sort === s.key ? "is-active" : ""}
                    onClick={() => setSort(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="dineout-grid">
              <div className="vstack" style={{ gap: 13 }}>
                {sorted.map((r, i) => (
                  <PlaceCard
                    key={r.id}
                    r={r}
                    index={i}
                    dish={dish}
                    open={openId === r.id}
                    onOpen={() => setOpenId(r.id)}
                    location={location}
                  />
                ))}
              </div>

              <div className="dineout-map">
                <MeshiMap
                  pins={pins}
                  center={location ?? { lat: pins[0]?.lat ?? 19.076, lng: pins[0]?.lng ?? 72.877 }}
                  selectedId={openId}
                  onSelect={setOpenId}
                  apiKey={apiKey}
                  embedFallbackUrl={embedUrl}
                />
              </div>
            </div>
          </div>
        </main>
      ) : (
        <MapMode
          sorted={sorted}
          pins={pins}
          openId={openId}
          setOpenId={setOpenId}
          location={location}
          apiKey={apiKey}
          embedUrl={embedUrl}
          dish={dish}
          etaRange={etaRange}
        />
      )}
    </>
  );
}

/** w9e's accordion card — one place open at a time. */
function PlaceCard({
  r, index, dish, open, onOpen, location,
}: {
  r: Restaurant & { id: number };
  index: number;
  dish?: string;
  open: boolean;
  onOpen: () => void;
  location: { lat: number; lng: number } | null;
}) {
  const hasCoords = typeof r.lat === "number" && typeof r.lng === "number";
  const km = location && hasCoords ? haversineKm(location, { lat: r.lat as number, lng: r.lng as number }) : null;
  const img = restaurantImage(index);
  const meta = [r.area, r.cuisine, r.priceRange, km !== null ? formatDistance(km) : null].filter(Boolean).join(" · ");

  return (
    <div className={`dnc${open ? " is-open" : ""}`} onClick={open ? undefined : onOpen}>
      {/* Collapsed */}
      <div className="dnc-shut">
        <span style={{ width: 52, height: 52, borderRadius: 13, flex: "none", overflow: "hidden", position: "relative" }} aria-hidden>
          <span className="imgfill" style={{ position: "absolute", inset: 0, backgroundImage: `url('${img}')` }} />
        </span>
        <span className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="t-h2" style={{ fontSize: 14.5 }}>{r.name}</span>
          <span className="t-cap" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>
        </span>
        <span className="vstack" style={{ gap: 1, alignItems: "flex-end", flex: "none" }}>
          <span className="t-h2" style={{ fontSize: 13, color: "var(--m-forest)" }}>{r.rating}</span>
          {km !== null && <span className="t-cap" style={{ fontSize: 11 }}>{etaMinutes(km)}</span>}
        </span>
      </div>

      {/* Expanded */}
      <div className="dnc-open">
        <div style={{ position: "relative", height: 168, borderRadius: 16, overflow: "hidden", marginBottom: 13 }}>
          <span className="imgfill" style={{ position: "absolute", inset: 0, backgroundImage: `url('${img}')` }} aria-hidden />
          <span className="scrim-dine" aria-hidden />
          <span className="dine-rating">
            <MascotFor name={r.name} width={15} height={15} aria-hidden /> {r.rating}
          </span>
          <span className="dine-rank" style={{ background: pinTone(index) }}>#{index + 1}</span>
        </div>

        <div className="vstack" style={{ gap: 4, marginBottom: 12 }}>
          <span className="t-d2" style={{ fontSize: 20 }}>{r.name}</span>
          <span className="t-cap">{meta}</span>
        </div>

        <div className="hstack" style={{ gap: 7, flexWrap: "wrap" }}>
          <span className="t-micro" style={{ width: "100%" }}>Go there</span>
          {location && hasCoords ? (
            <>
              <a className="dchip mp-dir" href={buildGoogleMapsDirectionsLink(location, { lat: r.lat as number, lng: r.lng as number })} target="_blank" rel="noopener noreferrer">
                <Navigation width={14} height={14} aria-hidden /> Directions{km !== null ? ` · ${etaMinutes(km)}` : ""}
              </a>
              <a className="dchip mp-uber" href={buildUberDeepLink(location, { lat: r.lat as number, lng: r.lng as number }, r.name)} target="_blank" rel="noopener noreferrer">
                <Car width={14} height={14} aria-hidden /> Uber
              </a>
              <a className="dchip mp-ola" href={buildOlaDeepLink(location, { lat: r.lat as number, lng: r.lng as number }, r.name)} target="_blank" rel="noopener noreferrer">
                <Car width={14} height={14} aria-hidden /> Ola
              </a>
              <Link className="dchip" href={`/dine-out/go/${r.id}`} style={{ background: "var(--m-cream-2)", color: "var(--m-ink)", textDecoration: "none" }}>
                Compare rides
              </Link>
            </>
          ) : (
            /* No coordinates or no location means no route can be built. Say so
               rather than rendering buttons that cannot work. */
            <span className="t-cap">
              {location ? "No map location for this place." : "Set your location to get routes and rides."}
            </span>
          )}
        </div>

        <div className="hstack" style={{ gap: 7, flexWrap: "wrap", marginTop: 11 }}>
          <span className="t-micro" style={{ width: "100%" }}>Order in</span>
          <a className="dchip mp-swiggy" href={buildSwiggyOrderLink(dish ?? r.name, r.lat, r.lng)} target="_blank" rel="noopener noreferrer">Swiggy</a>
          <a className="dchip mp-zomato" href={buildZomatoOrderLink(dish ?? r.name, r.area)} target="_blank" rel="noopener noreferrer">Zomato</a>
        </div>
      </div>
    </div>
  );
}

/** w7c — full-bleed map, floating filter card, bottom card carousel. */
function MapMode({
  sorted, pins, openId, setOpenId, location, apiKey, embedUrl, dish, etaRange,
}: {
  sorted: Array<Restaurant & { id: number }>;
  pins: MeshiMapPin[];
  openId: number;
  setOpenId: (id: number) => void;
  location: { lat: number; lng: number } | null;
  apiKey: string;
  embedUrl: string | null;
  dish?: string;
  etaRange: string | null;
}) {
  // w7c draws its own +/- stack, so the map's built-in zoomControl is off and
  // these drive the real instance through MeshiMap's onMapReady handle.
  const mapRef = useRef<google.maps.Map | null>(null);
  const zoom = useCallback((dir: 1 | -1) => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom((map.getZoom() ?? 13) + dir);
  }, []);

  return (
    <div className="dineout-full">
      <MeshiMap
        pins={pins}
        center={location ?? { lat: pins[0]?.lat ?? 19.076, lng: pins[0]?.lng ?? 72.877 }}
        selectedId={openId}
        onSelect={setOpenId}
        apiKey={apiKey}
        embedFallbackUrl={embedUrl}
        variant="fullbleed"
        onMapReady={(m) => { mapRef.current = m; }}
      >
        {/* Floating summary card, top-left (w7c) */}
        <div className="card dineout-float-tl">
          <div className="hstack" style={{ gap: 10, marginBottom: 11 }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--m-tint-green)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }} aria-hidden>
              <Utensils width={19} height={19} style={{ color: "var(--m-forest)" }} />
            </span>
            <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
              <span className="t-h2" style={{ fontSize: 15 }}>
                {sorted.length} place{sorted.length === 1 ? "" : "s"}
              </span>
              <span className="t-cap">{[dish, etaRange ? `${etaRange} by cab` : null].filter(Boolean).join(" · ") || "Matched by Bo"}</span>
            </div>
          </div>
        </div>

        {/* Zoom stack, top-right (w7c) */}
        <div className="dineout-float-tr">
          <div className="dineout-zoom">
            <button onClick={() => zoom(1)} aria-label="Zoom in">+</button>
            <i aria-hidden />
            <button onClick={() => zoom(-1)} aria-label="Zoom out">−</button>
          </div>
        </div>

        {/* Card carousel, bottom (w7c) */}
        <div className="dineout-carousel">
          <div className="dineout-carousel-track">
            {sorted.map((r, i) => {
              const active = openId === r.id;
              const km = location && r.lat && r.lng ? haversineKm(location, { lat: r.lat, lng: r.lng }) : null;
              return (
                <button
                  key={r.id}
                  className={`card din-lift dineout-mini${active ? " is-active" : ""}`}
                  onClick={() => setOpenId(r.id)}
                  aria-pressed={active}
                >
                  <span style={{ width: 74, height: 74, borderRadius: 14, flex: "none", position: "relative", overflow: "hidden" }} aria-hidden>
                    <span className="imgfill" style={{ position: "absolute", inset: 0, backgroundImage: `url('${restaurantImage(i)}')` }} />
                  </span>
                  <span className="vstack grow" style={{ gap: 3, minWidth: 0, textAlign: "left" }}>
                    <span className="hstack" style={{ gap: 7 }}>
                      <span className="dine-rank" style={{ background: pinTone(i), position: "static" }}>{i + 1}</span>
                      <span className="t-h2" style={{ fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                    </span>
                    <span className="t-cap" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {[r.cuisine, r.priceRange, km !== null ? formatDistance(km) : null].filter(Boolean).join(" · ")}
                    </span>
                    <span className="hstack" style={{ gap: 6, marginTop: 3 }}>
                      <span className="dchip mp-swiggy" style={{ height: 28, fontSize: 11.5, padding: "0 11px" }}>Swiggy</span>
                      {location && r.lat && r.lng && (
                        <span className="dchip mp-dir" style={{ height: 28, fontSize: 11.5, padding: "0 11px" }}>
                          {km !== null ? etaMinutes(km) : "Route"}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </MeshiMap>
    </div>
  );
}
