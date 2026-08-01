"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useRef, useState } from "react";

/**
 * Live Google Maps tiles for the meshi Restaurants screen, dark-styled to match
 * the --cc-* surface. Renders numbered markers + a user-location dot. Degrades
 * gracefully: with no API key, a load error, or a Google auth failure it falls
 * back to the stylized gradient backdrop + static pins (the prior look) so the
 * screen never appears broken.
 */

export interface MapPin {
  lat: number;
  lng: number;
  label: number;
  title: string;
}

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 }; // New Delhi (sample data origin)

const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0b0d" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2d" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a1c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b2535" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a2d" }] },
];

function numberedMarkerIcon(label: number, active: boolean): google.maps.Icon {
  const fill = active ? "#ff6b35" : "#1d1d1f";
  const stroke = "#ff6b35";
  const text = active ? "#ffffff" : "#ff6b35";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48"><path d="M18 0C8.06 0 0 8.06 0 18c0 12.75 16.31 28.56 17 29.21.28.26.72.26 1 0C18.69 46.56 36 30.75 36 18 36 8.06 27.94 0 18 0z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><text x="18" y="23" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif" font-size="15" font-weight="700" fill="${text}">${label}</text></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(36, 48),
    anchor: new google.maps.Point(18, 48),
  };
}

const FALLBACK_PIN_POS = [
  { x: 28, y: 26 }, { x: 62, y: 40 }, { x: 45, y: 58 }, { x: 78, y: 62 }, { x: 22, y: 70 },
];

/** Stylized backdrop used when Maps can't load — keeps the screen intentional. */
function FallbackMap({ pins, hasLocation }: { pins: MapPin[]; hasLocation: boolean }) {
  return (
    <>
      <div className="mapbg" style={{ position: "absolute", inset: 0 }} />
      {pins.map((p, i) => (
        <div key={p.label} style={{ position: "absolute", left: `${FALLBACK_PIN_POS[i]?.x ?? 50}%`, top: `${FALLBACK_PIN_POS[i]?.y ?? 50}%`, transform: "translate(-50%,-100%)", zIndex: 2 }}>
          <div style={{ width: i === 0 ? 30 : 26, height: i === 0 ? 30 : 26, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: i === 0 ? "var(--m-forest)" : "var(--m-cream-2)", border: i === 0 ? "none" : "1px solid var(--m-ink-faint)", display: "grid", placeItems: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.35)" }}>
            <span style={{ transform: "rotate(45deg)", color: i === 0 ? "#fff" : "var(--m-ink)", fontSize: 12, fontWeight: 700 }}>{p.label}</span>
          </div>
        </div>
      ))}
      {hasLocation && (
        <div style={{ position: "absolute", left: "42%", top: "47%", zIndex: 2 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--m-forest)", border: "3px solid #fff", boxShadow: "0 0 0 8px rgba(41,151,255,0.18)" }} />
        </div>
      )}
    </>
  );
}

export default function RestaurantMap({ pins, center }: { pins: MapPin[]; center: { lat: number; lng: number } | null }) {
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
    return <FallbackMap pins={pins} hasLocation={!!center} />;
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
        options={{ styles: DARK_MAP_STYLE, disableDefaultUI: true, clickableIcons: false, backgroundColor: "#1d1d1f", gestureHandling: "greedy" }}
      >
        {center && (
          <Marker position={center} title="You" zIndex={1} icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#2997ff", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 }} />
        )}
        {pins.map((p) => (
          <Marker key={p.label} position={{ lat: p.lat, lng: p.lng }} icon={numberedMarkerIcon(p.label, p.label === 1)} zIndex={p.label === 1 ? 999 : 10 + p.label} title={p.title} />
        ))}
      </GoogleMap>
    </div>
  );
}
