"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useRef, useState } from "react";

/**
 * Live Google Maps tiles for the meshi Restaurants screen.
 *
 * DESIGN NOTE: the Flow 2 artboard draws an ILLUSTRATED map — hand-drawn roads
 * and block rectangles. That is the artboard's stand-in for a live map (you
 * cannot render Google Maps in a static design file), the same category as the
 * `.win*` fake browser chrome. Replacing real tiles with an illustration would
 * lose actual restaurant positions, so we keep the map and take the genuinely
 * designed parts: the palette, and numbered teardrop pins with an active state.
 *
 * The style below reproduces the artboard's map colours — pale green land,
 * cream roads, sage blocks, muted blue water.
 *
 * Degrades gracefully: with no API key, a load error, or a Google auth failure
 * it falls back to a tinted backdrop with static pins, so the screen never
 * looks broken. (Production currently hits that path: the Maps key is
 * HTTP-referrer-restricted to the web domain. That is a Google Cloud Console
 * fix, not a code one.)
 */

export interface MapPin {
  lat: number;
  lng: number;
  label: number;
  title: string;
}

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 }; // New Delhi (sample data origin)

// hex-ok-start: Google Maps style JSON has no CSS custom-property support —
// DESIGN.md's allowlist. Values are the artboard's own map palette, copied
// from design/meshi-b.css's --m-* tokens where one exists.
/** Colours lifted from the artboard's illustrated map. */
const LAND = "#E8EDDA";
const ROAD = "#FDFBF2";
const BLOCK = "#DCE5C4";
const WATER = "#D3DEF0";
const FOREST = "#1E5A34";
const BURNT = "#C05F16";
const ON_DEEP = "#FDF8E7";

const MESHI_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: LAND }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A6B47" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: ROAD }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: ROAD }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#EFE8D2" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#FFFDF4" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: BLOCK }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#D6E4BC" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: WATER }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#D8D2BC" }] },
];
// hex-ok-end

/**
 * The artboard's teardrop, verbatim: a rounded head tapering to a point, with
 * the rank number centred in it. Active pins are burnt orange and larger so the
 * selected spot reads at a glance against a field of forest-green ones.
 */
function numberedMarkerIcon(label: number, active: boolean): google.maps.Icon {
  const w = active ? 56 : 44;
  const h = active ? 66 : 52;
  const fill = active ? BURNT : FOREST;
  const fontSize = active ? 21 : 17;
  const textY = active ? 15.5 : 15;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 32 32">` +
    `<path d="M16 30 C8 21 5.5 15.5 5.5 11.5 a10.5 10.5 0 0 1 21 0 c0 4 -2.5 9.5 -10.5 18.5 Z" fill="${fill}"/>` +
    `<text x="16" y="${textY}" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="Montserrat,system-ui,sans-serif" font-size="${(fontSize / w) * 32}" font-weight="800" fill="${ON_DEEP}">${label}</text>` +
    `</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(w / 2, h),
  };
}

const FALLBACK_PIN_POS = [
  { x: 28, y: 26 }, { x: 62, y: 40 }, { x: 45, y: 58 }, { x: 78, y: 62 }, { x: 22, y: 70 },
];

/** Tinted backdrop used when Maps can't load — keeps the screen intentional. */
function FallbackMap({
  pins,
  hasLocation,
  activeLabel,
  onSelect,
}: {
  pins: MapPin[];
  hasLocation: boolean;
  activeLabel: number;
  onSelect?: (label: number) => void;
}) {
  return (
    <>
      <div className="mapbg" style={{ position: "absolute", inset: 0 }} />
      {pins.map((p, i) => {
        const active = p.label === activeLabel;
        return (
          <button
            key={p.label}
            onClick={() => onSelect?.(p.label)}
            aria-label={p.title}
            style={{
              position: "absolute",
              left: `${FALLBACK_PIN_POS[i]?.x ?? 50}%`,
              top: `${FALLBACK_PIN_POS[i]?.y ?? 50}%`,
              transform: "translate(-50%,-100%)",
              zIndex: active ? 3 : 2,
              background: "none",
              border: "none",
              padding: 0,
            }}
          >
            <svg viewBox="0 0 32 32" width={active ? 44 : 34} height={active ? 52 : 40}>
              <path
                d="M16 30 C8 21 5.5 15.5 5.5 11.5 a10.5 10.5 0 0 1 21 0 c0 4 -2.5 9.5 -10.5 18.5 Z"
                fill={active ? "var(--m-burnt)" : "var(--m-forest)"}
              />
              <text x="16" y="14" textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="800" fill={ON_DEEP}>
                {p.label}
              </text>
            </svg>
          </button>
        );
      })}
      {hasLocation && (
        <div style={{ position: "absolute", left: "42%", top: "47%", zIndex: 2 }}>
          <div
            style={{
              width: 16, height: 16, borderRadius: "50%",
              background: "var(--m-forest)", border: `3px solid ${ON_DEEP}`,
              boxShadow: "0 0 0 8px color-mix(in srgb, var(--m-forest) 16%, transparent)",
            }}
          />
        </div>
      )}
    </>
  );
}

export default function RestaurantMap({
  pins,
  center,
  activeLabel = 1,
  onSelect,
}: {
  pins: MapPin[];
  center: { lat: number; lng: number } | null;
  activeLabel?: number;
  onSelect?: (label: number) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({ id: "meshi-maps", googleMapsApiKey: apiKey });
  const mapRef = useRef<google.maps.Map | null>(null);
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as typeof window & { gm_authFailure?: () => void };
    const prev = w.gm_authFailure;
    w.gm_authFailure = () => setAuthFailed(true);
    return () => { w.gm_authFailure = prev; };
  }, []);

  const mapCenter = center ?? (pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : DEFAULT_CENTER);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || pins.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    pins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    bounds.extend(mapCenter);
    mapRef.current.fitBounds(bounds, 72);
  }, [isLoaded, pins, mapCenter]);

  if (!apiKey || loadError || authFailed) {
    return <FallbackMap pins={pins} hasLocation={!!center} activeLabel={activeLabel} onSelect={onSelect} />;
  }

  if (!isLoaded) {
    return <div className="mapbg" style={{ position: "absolute", inset: 0 }} aria-label="Loading map" />;
  }

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={mapCenter}
        zoom={13}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          styles: MESHI_MAP_STYLE,
          disableDefaultUI: true,
          clickableIcons: false,
          backgroundColor: LAND,
          gestureHandling: "greedy",
        }}
      >
        {center && (
          <Marker
            position={center}
            title="You"
            zIndex={1}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: FOREST,
              fillOpacity: 1,
              strokeColor: ON_DEEP,
              strokeWeight: 3,
            }}
          />
        )}
        {pins.map((p) => (
          <Marker
            key={p.label}
            position={{ lat: p.lat, lng: p.lng }}
            icon={numberedMarkerIcon(p.label, p.label === activeLabel)}
            zIndex={p.label === activeLabel ? 999 : 10 + p.label}
            title={p.title}
            onClick={() => onSelect?.(p.label)}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
