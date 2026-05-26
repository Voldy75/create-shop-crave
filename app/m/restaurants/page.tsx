"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Search, Star, Navigation, Car, ExternalLink } from "lucide-react";
import { getActiveRestaurants } from "@/lib/mobile-handoff";
import { foodImage } from "@/lib/food-images";
import { useUser } from "@/app/context/UserContext";
import {
  buildGoogleMapsDirectionsLink,
  buildUberDeepLink,
  buildSwiggyOrderLink,
  buildZomatoOrderLink,
} from "@/lib/deeplinks";
import type { RestaurantSuggestion, Restaurant } from "@/lib/types";

/**
 * meshi Restaurants — map-first (v2-screens ScreenRestaurantsMap): stylized
 * map backdrop with numbered pins, a "Go there / Order in" toggle, and a peek
 * sheet of restaurant cards with real deeplinks (Directions, Uber, Swiggy,
 * Zomato). Reads the restaurant suggestion handed off from chat; falls back to
 * a sample for direct visits. (Real Google Maps tiles deferred — the meshi
 * design itself uses a stylized backdrop.)
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

const PIN_POS = [
  { x: 28, y: 26 }, { x: 62, y: 40 }, { x: 45, y: 58 }, { x: 78, y: 62 }, { x: 22, y: 70 },
];

export default function MobileRestaurants() {
  const router = useRouter();
  const { location } = useUser();
  const [sugg, setSugg] = useState<RestaurantSuggestion | null>(null);
  const [mode, setMode] = useState<"go" | "order">("go");

  useEffect(() => { setSugg(getActiveRestaurants() ?? SAMPLE); }, []);

  if (!sugg) return <div style={{ minHeight: "100dvh", background: "var(--cc-bg)" }} />;
  const list = (sugg.restaurants ?? []).slice(0, 5);

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)", position: "relative" }}>
      <div className="mapbg" style={{ position: "absolute", inset: 0 }} />

      {/* Pins */}
      {list.map((r, i) => (
        <div key={r.name} style={{ position: "absolute", left: `${PIN_POS[i]?.x ?? 50}%`, top: `${PIN_POS[i]?.y ?? 50}%`, transform: "translate(-50%,-100%)", zIndex: 2 }}>
          <Pin n={i + 1} hi={i === 0} />
        </div>
      ))}
      {location && (
        <div style={{ position: "absolute", left: "42%", top: "47%", zIndex: 2 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--cc-link)", border: "3px solid #fff", boxShadow: "0 0 0 8px rgba(41,151,255,0.18)" }} />
        </div>
      )}

      {/* Top controls */}
      <div className="row" style={{ position: "absolute", top: "calc(env(safe-area-inset-top,12px) + 6px)", left: 12, right: 12, gap: 8, zIndex: 3 }}>
        <button onClick={() => router.back()} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "var(--cc-surf-2)", color: "var(--cc-ink-1)", display: "grid", placeItems: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }} aria-label="Back"><ChevronLeft width={20} height={20} /></button>
        <div className="card row" style={{ flex: 1, padding: "0 14px", height: 38, gap: 8 }}>
          <Search width={16} height={16} style={{ color: "var(--cc-ink-3)" }} />
          <span style={{ fontSize: 13, color: "var(--cc-ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sugg.dishName ?? sugg.query} near you</span>
        </div>
      </div>

      {/* Go there / Order in toggle */}
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top,12px) + 54px)", left: "50%", transform: "translateX(-50%)", background: "var(--cc-surf-2)", borderRadius: "var(--cc-r-pill)", padding: 4, display: "flex", gap: 2, boxShadow: "0 4px 14px rgba(0,0,0,0.25)", border: "1px solid var(--cc-line)", zIndex: 3 }}>
        {(["go", "order"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{ background: mode === m ? "var(--cc-acc)" : "transparent", color: mode === m ? "#fff" : "var(--cc-ink-2)", border: "none", borderRadius: "var(--cc-r-pill)", padding: "6px 14px", fontSize: 12, fontWeight: 600 }}>
            {m === "go" ? "Go there" : "Order in"}
          </button>
        ))}
      </div>

      {/* Peek sheet */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxWidth: 520, margin: "0 auto", background: "var(--cc-bg)", borderRadius: "20px 20px 0 0", borderTop: "1px solid var(--cc-line)", padding: "8px 0 calc(14px + env(safe-area-inset-bottom,0px))", boxShadow: "0 -12px 30px rgba(0,0,0,0.4)", zIndex: 3 }}>
        <div style={{ width: 38, height: 4, background: "var(--cc-line-2)", borderRadius: 2, margin: "0 auto 8px" }} />
        <div className="row" style={{ padding: "4px 16px 10px", justifyContent: "space-between" }}>
          <span className="t-cap">{list.length} SPOTS NEAR YOU</span>
        </div>
        <div className="hscroll row" style={{ gap: 10, padding: "0 12px" }}>
          {list.map((r, i) => (
            <RestaurantCard key={r.name} r={r} n={i + 1} hi={i === 0} mode={mode} dish={sugg.dishName ?? sugg.query} loc={location} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Pin({ n, hi }: { n: number; hi?: boolean }) {
  return (
    <div style={{ width: hi ? 30 : 26, height: hi ? 30 : 26, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: hi ? "var(--cc-acc)" : "var(--cc-surf-2)", border: hi ? "none" : "1px solid var(--cc-line-2)", display: "grid", placeItems: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.35)" }}>
      <span style={{ transform: "rotate(45deg)", color: hi ? "#fff" : "var(--cc-ink-1)", fontSize: 12, fontWeight: 700 }}>{n}</span>
    </div>
  );
}

function RestaurantCard({ r, n, hi, mode, dish, loc }: { r: Restaurant; n: number; hi: boolean; mode: "go" | "order"; dish: string; loc: { lat: number; lng: number } | null }) {
  const hasCoords = typeof r.lat === "number" && typeof r.lng === "number";
  const dirHref = hasCoords && loc ? buildGoogleMapsDirectionsLink(loc, { lat: r.lat!, lng: r.lng! }) : `https://www.google.com/maps/search/${encodeURIComponent(r.name)}`;
  const uberHref = hasCoords && loc ? buildUberDeepLink(loc, { lat: r.lat!, lng: r.lng! }, r.name) : "https://m.uber.com/";
  const swiggyHref = r.swiggyUrl || buildSwiggyOrderLink(dish, loc?.lat, loc?.lng);
  const zomatoHref = r.zomatoUrl || buildZomatoOrderLink(dish, r.area);

  return (
    <div className="card" style={{ minWidth: 250, padding: 12, border: hi ? "1.5px solid var(--cc-acc)" : "1px solid var(--cc-line)" }}>
      <div className="row" style={{ gap: 10 }}>
        <div className="ph ph-saffron" style={{ width: 48, height: 48, borderRadius: "var(--cc-r-md)", flexShrink: 0, position: "relative", backgroundImage: (foodImage(dish) || foodImage(r.cuisine)) ? `url(${foodImage(dish) || foodImage(r.cuisine)})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", left: -6, top: -6 }}><Pin n={n} hi={hi} /></div>
        </div>
        <div className="col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
          <span className="t-small">{[r.area, r.cuisine].filter(Boolean).join(" · ")}</span>
          <div className="row" style={{ gap: 4, marginTop: 2 }}>
            <Star width={11} height={11} style={{ color: "var(--cc-acc)" }} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{r.rating}</span>
            <span style={{ fontSize: 11, color: "var(--cc-ink-3)" }}>· {r.priceRange}</span>
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        {mode === "go" ? (
          <>
            <a className="pill-tonal" style={{ flex: 1, padding: "8px 10px", fontSize: 12, textDecoration: "none" }} href={dirHref} target="_blank" rel="noopener noreferrer"><Navigation width={14} height={14} />Directions</a>
            <a className="pill-primary" style={{ flex: 1, padding: "8px 10px", fontSize: 12, textDecoration: "none" }} href={uberHref} target="_blank" rel="noopener noreferrer"><Car width={14} height={14} />Uber</a>
          </>
        ) : (
          <>
            <a className="pill-tonal" style={{ flex: 1, padding: "8px 10px", fontSize: 12, textDecoration: "none" }} href={zomatoHref} target="_blank" rel="noopener noreferrer">Zomato <ExternalLink width={12} height={12} /></a>
            <a className="pill-primary" style={{ flex: 1, padding: "8px 10px", fontSize: 12, textDecoration: "none" }} href={swiggyHref} target="_blank" rel="noopener noreferrer">Swiggy <ExternalLink width={12} height={12} /></a>
          </>
        )}
      </div>
    </div>
  );
}
