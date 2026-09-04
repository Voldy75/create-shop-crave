"use client";

/**
 * MeshiMap — the one Google Map for the web tree, restyled to w7c.
 *
 * ITEM 1'S CONSTRAINT: "we are consuming google maps api. the redesign doesn't
 * break the api." So every load-bearing piece of the original
 * RestaurantView map is preserved verbatim — useJsApiLoader with the SAME
 * `id: "crave-create-maps"` (a second id would load the script twice),
 * fitBounds on first paint, panTo on selection, the window.gm_authFailure hook
 * (auth can fail AFTER isLoaded, so loadError alone is not enough), and both
 * fallbacks. Only presentation changed.
 *
 * WHY PINS ARE OverlayViewF AND NOT Marker ICONS.
 * w7c's pin is a teardrop with a MASCOT inside it, plus a bobbing animation and
 * a floating rating tooltip on the active one. A Marker icon is an SVG
 * data-URI, so a mascot there would mean copying path data out of
 * components/mascots/* — which is exactly the drift the handoff records for
 * gen-resources.mjs (icon and in-app mascot disagreeing). OverlayViewF renders
 * real React at a LatLng, so the pins use the SAME mascot components as the
 * rest of the app and cannot drift. It also lets .dpin/.dpin-td/.dpin-bob from
 * design/meshi-app.css style them directly.
 *
 * The map still renders Google's own place labels. w7c draws hand-placed
 * neighbourhood names (.mlabel); those are not reproduced, because the mockup's
 * map is a drawing and ours is real geography — a second, invented label set
 * over a live map would be fabricated data.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { GoogleMap, MarkerF, OverlayViewF, useJsApiLoader } from "@react-google-maps/api";
import { AlertCircle } from "lucide-react";
import { MascotFor } from "@/components/mascots";

export type Coords = { lat: number; lng: number };

export interface MeshiMapPin {
  id: number;
  lat: number;
  lng: number;
  /** Display number, post-sort. */
  label: number;
  title: string;
  /** Shown in the active pin's floating tooltip when present. */
  rating?: string;
}

interface Props {
  pins: MeshiMapPin[];
  center: Coords;
  selectedId: number | null;
  onSelect: (id: number) => void;
  apiKey: string;
  embedFallbackUrl: string | null;
  /** "panel" rounds the corners; "fullbleed" fills its container (w7c). */
  variant?: "panel" | "fullbleed";
  /** Floating cards/controls rendered above the map (w7c's overlays). */
  children?: ReactNode;
  /**
   * Handed the live map instance once loaded, so an overlay can drive it —
   * w7c's floating +/- stack needs setZoom. Called with null on unmount.
   */
  onMapReady?: (map: google.maps.Map | null) => void;
}

/** w7c cycles pin tone by rank. Forest first — it is the recommended one. */
const PIN_TONES = ["var(--m-forest)", "var(--m-burnt)", "var(--m-plum)"];
export function pinTone(index: number): string {
  return PIN_TONES[index % PIN_TONES.length];
}

// hex-ok-start: Google Maps style JSON has no CSS custom-property support —
// DESIGN.md's allowlist. Values are copied from design/meshi-b.css's --m-*
// tokens. Extended toward w7c's cartographic look: sage water, cream roads
// with a warm casing, and a paler administrative wash.
const MESHI_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#EFE8D2" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A6B47" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FBF6E3" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FBF6E3" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#F0E8CD" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#FFFDF4" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#C4D9D2" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#E7EDD3" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#DCE8C4" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#F0E8CD" }] },
];
const MAP_BACKGROUND = "#EFE8D2";
// hex-ok-end

export function MeshiMap({
  pins, center, selectedId, onSelect, apiKey, embedFallbackUrl,
  variant = "panel", children, onMapReady,
}: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    // Same id as the original loader — changing it would load the Maps script
    // a second time on any page that renders both surfaces.
    id: "crave-create-maps",
    googleMapsApiKey: apiKey,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [authFailed, setAuthFailed] = useState(false);

  // Maps calls window.gm_authFailure() when the key is invalid, referer-blocked
  // or the JS API is not enabled. It fires AFTER isLoaded, so loadError alone
  // does not catch it. (Blocker 5: the key is referrer-restricted, so this is
  // the path localhost actually takes.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as typeof window & { gm_authFailure?: () => void };
    const prev = w.gm_authFailure;
    w.gm_authFailure = () => setAuthFailed(true);
    return () => { w.gm_authFailure = prev; };
  }, []);

  // BLANK-MAP GUARD. gm_authFailure is the documented hook for a rejected key,
  // and it works (verified by invoking it: the Embed iframe takes over). But
  // Google does NOT always call it — a referrer-restricted key on localhost
  // logs RefererNotAllowedMapError to the console and simply renders NOTHING
  // into the container, leaving a silent blank rectangle where the map should
  // be. That is the state this project's own key is in off its web domain
  // (blocker 5), so it is the state most developers and any misconfigured
  // deployment will actually see. If the container is still empty a beat after
  // load, treat it as a failure and show the fallback.
  useEffect(() => {
    if (!isLoaded || authFailed) return;
    const t = setTimeout(() => {
      const div = mapRef.current?.getDiv();
      if (div && div.childElementCount === 0) setAuthFailed(true);
    }, 2500);
    return () => clearTimeout(t);
  }, [isLoaded, authFailed]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || pins.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    pins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    bounds.extend(center);
    mapRef.current.fitBounds(bounds, 64);
  }, [isLoaded, pins, center]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || selectedId === null) return;
    const p = pins.find((x) => x.id === selectedId);
    if (p) mapRef.current.panTo({ lat: p.lat, lng: p.lng });
  }, [isLoaded, selectedId, pins]);

  const radius = variant === "fullbleed" ? "0" : "18px";

  // No key at all: never mount the loader. useJsApiLoader with an empty key
  // does not error — it settles into a state that renders NOTHING, so the map
  // area came out blank with no explanation. The pre-refactor RestaurantView
  // guarded on `apiKey` before mounting for exactly this reason; keep it.
  // With no key there is also no Embed URL, so this lands on the
  // "set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" message, which is the useful one.
  if (!apiKey) {
    return <MapShell radius={radius}><IframeMapFallback embedUrl={embedFallbackUrl} />{children}</MapShell>;
  }

  if (loadError || authFailed) {
    return <MapShell radius={radius}><IframeMapFallback embedUrl={embedFallbackUrl} />{children}</MapShell>;
  }

  if (!isLoaded) {
    return (
      <MapShell radius={radius}>
        <div className="w-full h-full animate-pulse" style={{ background: "var(--m-cream-2)" }} aria-label="Loading map" />
      </MapShell>
    );
  }

  return (
    <MapShell radius={radius}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={13}
        onLoad={(map) => { mapRef.current = map; onMapReady?.(map); }}
        onUnmount={() => { mapRef.current = null; onMapReady?.(null); }}
        options={{
          styles: MESHI_MAP_STYLE,
          disableDefaultUI: true,
          // w7c draws its own +/− stack as a floating overlay, so the built-in
          // control would be a second, differently-styled pair.
          zoomControl: false,
          clickableIcons: false,
          backgroundColor: MAP_BACKGROUND,
          gestureHandling: "greedy",
        }}
      >
        <MarkerF
          position={center}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            // hex-ok-start: Maps marker config is a plain JS object rendered on
            // canvas — no CSS var support. Blue is the universal "you are here"
            // convention, not a brand colour.
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "#FDF8E7",
            strokeWeight: 2,
            // hex-ok-end
          }}
          title="You"
          zIndex={1}
        />

        {pins.map((p, i) => {
          const active = selectedId === p.id;
          return (
            <OverlayViewF
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              mapPaneName="floatPane"
              /* OverlayView positions by top-left, so offset to put the pin's
                 POINT on the coordinate. .dpin's own translate handles the rest. */
              getPixelPositionOffset={() => ({ x: 0, y: 0 })}
            >
              <div className="dpin" style={{ position: "relative", zIndex: active ? 999 : 10 + p.label }}>
                <div className={`dpin-in${active ? " dpin-bob" : ""}`}>
                  {active && p.rating && (
                    <div className="dpin-tip">
                      <span className="t-cap" style={{ color: "var(--m-ink)" }}>{p.rating} · {p.title}</span>
                    </div>
                  )}
                  <button
                    className="dpin-td dnt is-active"
                    style={{ background: pinTone(i), border: "none", cursor: "pointer", padding: 0 }}
                    onClick={() => onSelect(p.id)}
                    aria-label={`Show ${p.title}`}
                    title={p.title}
                  >
                    <MascotFor name={p.title} width={active ? 28 : 24} height={active ? 28 : 24} />
                  </button>
                </div>
              </div>
            </OverlayViewF>
          );
        })}
      </GoogleMap>
      {children}
    </MapShell>
  );
}

function MapShell({ radius, children }: { radius: string; children: ReactNode }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: radius, overflow: "hidden", background: "var(--m-cream-2)" }}>
      {children}
    </div>
  );
}

function MapErrorFallback({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-2" style={{ color: "var(--m-ink-soft)" }}>
      <AlertCircle className="w-6 h-6" />
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  );
}

function IframeMapFallback({ embedUrl }: { embedUrl: string | null }) {
  if (!embedUrl) {
    return <MapErrorFallback message="Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable." />;
  }
  return (
    <iframe
      src={embedUrl}
      title="Restaurant map"
      width="100%"
      height="100%"
      style={{ border: 0, display: "block" }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}
