"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Card } from "@/components/ui/card";
import { Star, Utensils, ExternalLink, Navigation, AlertCircle } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import {
    buildUberDeepLink,
    buildOlaDeepLink,
    buildGoogleMapsDirectionsLink,
    buildSwiggyOrderLink,
    buildZomatoOrderLink,
} from "@/lib/deeplinks";
import { ShareButton } from "@/components/ShareButton";
import type { Restaurant, RestaurantSuggestion } from "@/lib/types";

interface RestaurantViewProps {
    data: RestaurantSuggestion;
}

type Coords = { lat: number; lng: number };

// ---------- Distance + ETA helpers ----------

function haversineKm(a: Coords, b: Coords): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
        Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDistance(km: number): string {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
}

function etaMinutes(km: number): string {
    // rough urban driving estimate: ~2.5 min per km, floor at 2 min
    return `${Math.max(2, Math.round(km * 2.5))} min`;
}

// ---------- Local helper components ----------

const IMAGE_POOL = [
    "1517248135467-4c7edcad34c4",
    "1552566626-52f8b828add9",
    "1555396273-367ea4eb4db5",
    "1414235077428-338989a2e8c0",
    "1600891964092-4316c288032e",
];
const FALLBACK_IMG =
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop&auto=format";

// ---------- Skeleton card for loading state ----------

function RestaurantCardSkeleton() {
    const shimmer: React.CSSProperties = {
        background: "var(--cc-surface-2)",
        borderRadius: "8px",
    };
    return (
        <div
            style={{
                background: "var(--cc-surface)",
                border: "1px solid var(--cc-border)",
                borderRadius: "14px",
                overflow: "hidden",
            }}
        >
            {/* Photo placeholder */}
            <div
                className="aspect-[4/3] animate-pulse"
                style={{ background: "var(--cc-surface-2)" }}
            />
            {/* Body */}
            <div style={{ padding: "14px 16px 16px" }}>
                <div className="animate-pulse" style={{ ...shimmer, width: "60%", height: "18px" }} />
                <div
                    className="animate-pulse"
                    style={{ ...shimmer, width: "40%", height: "13px", marginTop: "6px" }}
                />
                <div
                    className="animate-pulse"
                    style={{ ...shimmer, width: "75%", height: "12px", marginTop: "10px" }}
                />
                <div className="flex gap-2" style={{ marginTop: "16px" }}>
                    <div className="animate-pulse" style={{ ...shimmer, width: "80px", height: "28px", borderRadius: "980px" }} />
                    <div className="animate-pulse" style={{ ...shimmer, width: "60px", height: "28px", borderRadius: "980px" }} />
                    <div className="animate-pulse" style={{ ...shimmer, width: "60px", height: "28px", borderRadius: "980px" }} />
                </div>
            </div>
        </div>
    );
}

// ---------- Empty state ----------

function RestaurantEmptyState() {
    return (
        <div
            className="flex flex-col items-center justify-center text-center py-12 px-6"
            style={{ color: "var(--cc-text-tertiary)" }}
        >
            <Utensils className="w-10 h-10 mb-3" style={{ opacity: 0.4 }} />
            <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--cc-text-secondary)", marginBottom: "4px" }}>
                No restaurants found
            </p>
            <p style={{ fontSize: "13px", lineHeight: 1.5, maxWidth: "260px" }}>
                Try asking for a different dish or a broader area. The map might still have results nearby.
            </p>
        </div>
    );
}

// Shared pill styles. Keep CTAs consistent across groups.
const pillStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    padding: "6px 12px",
    borderRadius: "980px",
    whiteSpace: "nowrap",
};

const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--cc-text-tertiary)",
    marginBottom: "6px",
};

function RestaurantCard({
    restaurant,
    stableId,
    displayNumber,
    userLocation,
    dishName,
    selected,
    onSelect,
    cardRef,
}: {
    restaurant: Restaurant;
    stableId: number;
    displayNumber: number;
    userLocation: Coords | null;
    dishName?: string;
    selected: boolean;
    onSelect: (stableId: number) => void;
    cardRef?: (el: HTMLElement | null) => void;
}) {
    const photoId = IMAGE_POOL[stableId % IMAGE_POOL.length];
    const hasCoords = typeof restaurant.lat === "number" && typeof restaurant.lng === "number";
    const dropoff: Coords | null = hasCoords
        ? { lat: restaurant.lat as number, lng: restaurant.lng as number }
        : null;
    const distanceKm =
        userLocation && dropoff ? haversineKm(userLocation, dropoff) : null;

    // Build action URLs
    const directionsUrl = userLocation && dropoff ? buildGoogleMapsDirectionsLink(userLocation, dropoff) : null;
    const uberUrl = userLocation && dropoff ? buildUberDeepLink(userLocation, dropoff, restaurant.name) : null;
    const olaUrl = userLocation && dropoff ? buildOlaDeepLink(userLocation, dropoff, restaurant.name) : null;
    const swiggySearchUrl = dishName
        ? buildSwiggyOrderLink(dishName, userLocation?.lat, userLocation?.lng)
        : restaurant.swiggyUrl || null;
    const zomatoSearchUrl = dishName
        ? buildZomatoOrderLink(dishName)
        : restaurant.zomatoUrl || null;

    const hasGoThere = Boolean(directionsUrl || uberUrl || olaUrl);
    const hasOrderIn = Boolean(swiggySearchUrl || zomatoSearchUrl);

    return (
        <article
            ref={cardRef}
            className="group"
            onMouseEnter={() => onSelect(stableId)}
            onClick={() => onSelect(stableId)}
            style={{
                background: "var(--cc-surface)",
                border: selected
                    ? "2px solid var(--cc-accent)"
                    : "1px solid var(--cc-border)",
                borderRadius: "14px",
                overflow: "hidden",
                transition: "border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease",
                boxShadow: selected ? "0 8px 24px rgba(255,107,53,0.18)" : "none",
                cursor: "pointer",
                scrollMarginTop: "12px",
            }}
        >
            {/* Thumbnail — 4:3 aspect gives photo ~60% card dominance (Sweetgreen-style) */}
            <div
                className="aspect-[4/3] relative overflow-hidden"
                style={{ background: "var(--cc-surface-2)" }}
            >
                <img
                    src={`https://images.unsplash.com/photo-${photoId}?w=600&h=450&fit=crop&auto=format`}
                    alt={restaurant.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_IMG;
                    }}
                />

                {/* Numbered pin badge (display order, matches the map pin number) */}
                <div
                    className="absolute top-3 left-3 flex items-center justify-center"
                    style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: "var(--cc-accent)",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontWeight: 700,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                    }}
                    aria-label={`Marker ${displayNumber}`}
                >
                    {displayNumber}
                </div>

                {/* Rating pill — cleaner, flatter, Sweetgreen-style */}
                <div
                    className="absolute top-3 right-3 flex items-center gap-1"
                    style={{
                        background: "rgba(0,0,0,0.85)",
                        padding: "4px 9px",
                        borderRadius: "980px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#ffffff",
                    }}
                >
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {restaurant.rating}
                </div>
            </div>

            {/* Body */}
            <div style={{ padding: "14px 16px 16px" }}>
                {/* Title */}
                <h3
                    style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        lineHeight: 1.2,
                        letterSpacing: "-0.022em",
                        color: "var(--cc-text-primary)",
                    }}
                >
                    {restaurant.name}
                </h3>
                <p
                    style={{
                        fontSize: "13px",
                        marginTop: "2px",
                        color: "var(--cc-text-secondary)",
                    }}
                >
                    {restaurant.area}
                </p>

                {/* Meta row: cuisine · price · distance · ETA */}
                <div
                    className="flex items-center flex-wrap gap-x-1.5"
                    style={{
                        fontSize: "12px",
                        color: "var(--cc-text-tertiary)",
                        marginTop: "8px",
                        fontWeight: 500,
                    }}
                >
                    {restaurant.cuisine && <span>{restaurant.cuisine}</span>}
                    {restaurant.cuisine && <span aria-hidden>·</span>}
                    <span>{restaurant.priceRange}</span>
                    {distanceKm !== null && (
                        <>
                            <span aria-hidden>·</span>
                            <span>{formatDistance(distanceKm)}</span>
                            <span aria-hidden>·</span>
                            <span>{etaMinutes(distanceKm)}</span>
                        </>
                    )}
                </div>

                {/* Action groups */}
                {hasGoThere && (
                    <div style={{ marginTop: "14px" }}>
                        <div style={labelStyle}>Go there</div>
                        <div className="flex flex-wrap gap-2">
                            {directionsUrl && (
                                <a
                                    href={directionsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                    style={pillStyle}
                                >
                                    <Navigation className="w-3 h-3" /> Directions
                                </a>
                            )}
                            {uberUrl && (
                                <a
                                    href={uberUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-white bg-black hover:bg-neutral-800 transition-colors"
                                    style={pillStyle}
                                >
                                    Uber
                                </a>
                            )}
                            {olaUrl && (
                                <a
                                    href={olaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-white bg-green-600 hover:bg-green-700 transition-colors"
                                    style={pillStyle}
                                >
                                    Ola
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {hasOrderIn && (
                    <div style={{ marginTop: "12px" }}>
                        <div style={labelStyle}>Order in</div>
                        <div className="flex flex-wrap gap-2">
                            {swiggySearchUrl && (
                                <a
                                    href={swiggySearchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-white bg-orange-500 hover:bg-orange-600 transition-colors"
                                    style={pillStyle}
                                >
                                    Swiggy <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                            {zomatoSearchUrl && (
                                <a
                                    href={zomatoSearchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-white bg-red-500 hover:bg-red-600 transition-colors"
                                    style={pillStyle}
                                >
                                    Zomato <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
}

// Apple-dark map style to match the app's aesthetic.
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

// Build a data-URI SVG for a numbered pin marker.
function numberedMarkerIcon(label: number, active: boolean): google.maps.Icon {
    const fill = active ? "#ff6b35" : "#1d1d1f";
    const stroke = active ? "#ffffff" : "#ff6b35";
    const text = active ? "#ffffff" : "#ff6b35";
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
  <path d="M18 0C8.06 0 0 8.06 0 18c0 12.75 16.31 28.56 17 29.21.28.26.72.26 1 0C18.69 46.56 36 30.75 36 18 36 8.06 27.94 0 18 0z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <circle cx="18" cy="18" r="11" fill="${active ? "#ffffff" : "transparent"}" stroke="${active ? "#ff6b35" : "transparent"}" stroke-width="0"/>
  <text x="18" y="23" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif" font-size="15" font-weight="700" fill="${text}">${label}</text>
</svg>`.trim();
    return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(36, 48),
        anchor: new google.maps.Point(18, 48),
    };
}

type MapRestaurant = Restaurant & { lat: number; lng: number };

type MapPin = {
    lat: number;
    lng: number;
    label: number; // display number (post-sort)
    stableId: number; // original index in data.restaurants
    title: string;
};

function InteractiveRestaurantMap({
    pins,
    center,
    selectedStableId,
    onSelect,
    apiKey,
    embedFallbackUrl,
}: {
    pins: MapPin[];
    center: Coords;
    selectedStableId: number | null;
    onSelect: (stableId: number) => void;
    apiKey: string;
    embedFallbackUrl: string | null;
}) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: "crave-create-maps",
        googleMapsApiKey: apiKey,
    });

    const mapRef = useRef<google.maps.Map | null>(null);
    const [authFailed, setAuthFailed] = useState(false);

    // Google Maps calls window.gm_authFailure() when the JS API key is invalid,
    // has referer restrictions that block this origin, or Maps JavaScript API is
    // not enabled on the project. This fires AFTER isLoaded=true, so useJsApiLoader's
    // loadError alone isn't enough. Hook into the global and flip to fallback.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const w = window as typeof window & { gm_authFailure?: () => void };
        const prev = w.gm_authFailure;
        w.gm_authFailure = () => {
            setAuthFailed(true);
        };
        return () => {
            w.gm_authFailure = prev;
        };
    }, []);

    // Fit bounds once after load so all markers are visible.
    useEffect(() => {
        if (!isLoaded || !mapRef.current) return;
        if (pins.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        pins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        bounds.extend(center);
        mapRef.current.fitBounds(bounds, 64);
    }, [isLoaded, pins, center]);

    // Pan to selected marker on change.
    useEffect(() => {
        if (!isLoaded || !mapRef.current || selectedStableId === null) return;
        const p = pins.find((x) => x.stableId === selectedStableId);
        if (!p) return;
        mapRef.current.panTo({ lat: p.lat, lng: p.lng });
    }, [isLoaded, selectedStableId, pins]);

    if (loadError || authFailed) {
        // The JS API script failed OR auth was rejected post-load (invalid key,
        // referer restrictions, Maps JavaScript API not enabled). Fall back to
        // the iframe Embed API, which is a separate service and may still work.
        // If that's also unavailable, show a helpful error message instead.
        return <IframeMapFallback embedUrl={embedFallbackUrl} />;
    }

    if (!isLoaded) {
        return (
            <div
                className="w-full h-full animate-pulse"
                style={{
                    background: "var(--cc-surface-2)",
                    borderRadius: "12px",
                }}
                aria-label="Loading map"
            />
        );
    }

    return (
        <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%", borderRadius: "12px" }}
            center={center}
            zoom={13}
            onLoad={(map) => {
                mapRef.current = map;
            }}
            options={{
                styles: DARK_MAP_STYLE,
                disableDefaultUI: true,
                zoomControl: true,
                clickableIcons: false,
                backgroundColor: "#1d1d1f",
                gestureHandling: "greedy",
            }}
        >
            {/* User location marker */}
            <Marker
                position={center}
                icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: "#2997ff",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 2,
                }}
                title="You"
                zIndex={1}
            />

            {/* Numbered restaurant markers */}
            {pins.map((p) => {
                const active = selectedStableId === p.stableId;
                return (
                    <Marker
                        key={p.stableId}
                        position={{ lat: p.lat, lng: p.lng }}
                        icon={numberedMarkerIcon(p.label, active)}
                        onClick={() => onSelect(p.stableId)}
                        zIndex={active ? 999 : 10 + p.label}
                        title={p.title}
                    />
                );
            })}
        </GoogleMap>
    );
}

function MapErrorFallback({ message }: { message: string }) {
    return (
        <div
            className="flex flex-col items-center justify-center h-full p-6 text-center gap-2"
            style={{ color: "var(--cc-text-tertiary)" }}
        >
            <AlertCircle className="w-6 h-6" />
            <p style={{ fontSize: "14px" }}>{message}</p>
        </div>
    );
}

function IframeMapFallback({ embedUrl }: { embedUrl: string | null }) {
    if (!embedUrl) {
        return (
            <MapErrorFallback
                message="Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable."
            />
        );
    }
    return (
        <iframe
            src={embedUrl}
            title="Restaurant map"
            width="100%"
            height="100%"
            style={{ border: 0, display: "block", borderRadius: "12px" }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
        />
    );
}

// ---------- Filter chips ----------

type SortKey = "default" | "rating" | "distance" | "price";

const SORT_OPTIONS: Array<{ key: SortKey; label: string; requiresLocation?: boolean }> = [
    { key: "default", label: "Recommended" },
    { key: "rating", label: "Top rated" },
    { key: "distance", label: "Nearest", requiresLocation: true },
    { key: "price", label: "Price" },
];

function FilterChips({
    value,
    onChange,
    hasLocation,
}: {
    value: SortKey;
    onChange: (key: SortKey) => void;
    hasLocation: boolean;
}) {
    return (
        <div
            role="group"
            aria-label="Sort restaurants"
            className="flex flex-wrap gap-2"
            style={{ marginBottom: "16px" }}
        >
            {SORT_OPTIONS.map((opt) => {
                const disabled = opt.requiresLocation && !hasLocation;
                const active = value === opt.key;
                return (
                    <button
                        key={opt.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(opt.key)}
                        style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: "6px 14px",
                            borderRadius: "980px",
                            border: active
                                ? "1px solid var(--cc-accent)"
                                : "1px solid var(--cc-border)",
                            background: active ? "var(--cc-accent)" : "transparent",
                            color: active
                                ? "#ffffff"
                                : disabled
                                ? "var(--cc-text-tertiary)"
                                : "var(--cc-text-primary)",
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.5 : 1,
                            transition: "all 160ms ease",
                        }}
                        title={disabled ? "Enable location to sort by distance" : undefined}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

// Parse a price string like "₹₹₹" or "$$" or "₹500" into a comparable number.
// Returns 0 for unknown so unknowns sort to the top when ascending.
function priceScore(priceRange: string | undefined): number {
    if (!priceRange) return 0;
    const symbolCount = (priceRange.match(/[₹$€£]/g) || []).length;
    if (symbolCount > 0) return symbolCount;
    const numeric = parseFloat(priceRange.replace(/[^0-9.]/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
}

function ratingScore(rating: string | undefined): number {
    if (!rating) return 0;
    const n = parseFloat(rating);
    return Number.isFinite(n) ? n : 0;
}

function RestaurantMap({
    pins,
    center,
    selectedStableId,
    onSelect,
    apiKey,
    embedFallbackUrl,
}: {
    pins: MapPin[];
    center: Coords;
    selectedStableId: number | null;
    onSelect: (stableId: number) => void;
    apiKey: string;
    embedFallbackUrl: string | null;
}) {
    return (
        <div
            className="relative w-full overflow-hidden h-[320px] md:h-[500px]"
            style={{
                borderRadius: "12px",
                background: "var(--cc-surface-2)",
            }}
        >
            {apiKey && pins.length > 0 ? (
                <InteractiveRestaurantMap
                    pins={pins}
                    center={center}
                    selectedStableId={selectedStableId}
                    onSelect={onSelect}
                    apiKey={apiKey}
                    embedFallbackUrl={embedFallbackUrl}
                />
            ) : (
                <IframeMapFallback embedUrl={embedFallbackUrl} />
            )}
        </div>
    );
}

// ---------- Main component ----------

export function RestaurantView({ data }: RestaurantViewProps) {
    const { location } = useUser();
    const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

    // Selection is tracked by STABLE ID (original index in data.restaurants)
    // so sorting never breaks the selection or ref bookkeeping.
    const [selectedStableId, setSelectedStableId] = useState<number | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>("default");
    // cardRefs indexed by stableId (original position), so sort is purely visual.
    const cardRefs = useRef<Record<number, HTMLElement | null>>({});
    // Carousel container on mobile — used as the IntersectionObserver root so
    // we can tell which card is centered in the horizontal scroll view.
    const carouselRef = useRef<HTMLDivElement | null>(null);
    // When handleSelect programmatically scrolls a card into view, IntersectionObserver
    // will fire with a new "centered" card and flip selection back, creating a loop
    // on mobile. This flag suppresses observer-driven updates during a programmatic scroll.
    const suppressObserverRef = useRef(false);

    // Sort the full restaurant list by the active sort key. Each entry keeps its
    // stableId (original index) and gets a displayNumber (post-sort position + 1)
    // that the UI uses for pin badges + map markers.
    const sortedEntries = useMemo(() => {
        const base = (data.restaurants || []).map((restaurant, i) => ({
            restaurant,
            stableId: i,
        }));

        const withDistance = base.map((e) => {
            const hasCoords =
                typeof e.restaurant.lat === "number" &&
                typeof e.restaurant.lng === "number";
            const distanceKm =
                hasCoords && location
                    ? haversineKm(location, {
                          lat: e.restaurant.lat as number,
                          lng: e.restaurant.lng as number,
                      })
                    : Infinity;
            return { ...e, distanceKm };
        });

        const sorted = [...withDistance];
        if (sortKey === "rating") {
            sorted.sort(
                (a, b) =>
                    ratingScore(b.restaurant.rating) - ratingScore(a.restaurant.rating)
            );
        } else if (sortKey === "price") {
            sorted.sort(
                (a, b) =>
                    priceScore(a.restaurant.priceRange) - priceScore(b.restaurant.priceRange)
            );
        } else if (sortKey === "distance") {
            sorted.sort((a, b) => a.distanceKm - b.distanceKm);
        }

        return sorted.map((e, i) => ({ ...e, displayNumber: i + 1 }));
    }, [data.restaurants, sortKey, location]);

    // Map pins: only entries with real coordinates. Pin labels match the card's
    // displayNumber so pin "3" on the map is the same as card "3" in the list.
    const mapPins = useMemo<MapPin[]>(
        () =>
            sortedEntries
                .filter(
                    (e) =>
                        typeof e.restaurant.lat === "number" &&
                        typeof e.restaurant.lng === "number"
                )
                .map((e) => ({
                    lat: e.restaurant.lat as number,
                    lng: e.restaurant.lng as number,
                    label: e.displayNumber,
                    stableId: e.stableId,
                    title: e.restaurant.name,
                })),
        [sortedEntries]
    );

    // Determine map center: user location, else first pin, else India default.
    const mapCenter: Coords = useMemo(
        () =>
            location ||
            (mapPins.length > 0
                ? { lat: mapPins[0].lat, lng: mapPins[0].lng }
                : { lat: 28.6139, lng: 77.209 }),
        [location, mapPins]
    );

    // Iframe Embed fallback URL for when the JS API can't load.
    const embedUrl = useMemo(() => {
        if (!mapsApiKey) return null;
        const params = new URLSearchParams({
            key: mapsApiKey,
            q: data.query || "restaurants",
            center: `${mapCenter.lat},${mapCenter.lng}`,
            zoom: "13",
        });
        return `https://www.google.com/maps/embed/v1/search?${params.toString()}`;
    }, [mapsApiKey, data.query, mapCenter]);

    // Unified selection handler: both map pins and cards call this with a stableId.
    // On desktop, scrolls the vertical list. On mobile carousel, scrolls horizontally.
    const handleSelect = (stableId: number) => {
        setSelectedStableId(stableId);
        suppressObserverRef.current = true;
        const el = cardRefs.current[stableId];
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
        // Allow observer to resume after the programmatic scroll animation settles.
        setTimeout(() => {
            suppressObserverRef.current = false;
        }, 600);
    };

    // Mobile carousel IntersectionObserver: when a card snaps into center,
    // update selectedStableId so the map pin highlights in sync.
    useEffect(() => {
        const container = carouselRef.current;
        if (!container) return;
        // Only observe on mobile-width viewports where the carousel is visible.
        // On desktop (md+), the carousel is hidden and the vertical list is shown.
        const mql = window.matchMedia("(min-width: 768px)");
        if (mql.matches) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (suppressObserverRef.current) return;
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                        const sid = Number(
                            (entry.target as HTMLElement).dataset.stableid
                        );
                        if (!Number.isNaN(sid)) {
                            setSelectedStableId(sid);
                        }
                    }
                }
            },
            {
                root: container,
                threshold: 0.6,
            }
        );

        // Observe every card element inside the carousel.
        const cards = container.querySelectorAll<HTMLElement>("[data-stableid]");
        cards.forEach((card) => observer.observe(card));

        return () => observer.disconnect();
    }, [sortedEntries]);

    // Render a single card instance (shared between desktop list and mobile carousel).
    const renderCard = (entry: (typeof sortedEntries)[number]) => (
        <RestaurantCard
            key={entry.stableId}
            restaurant={entry.restaurant}
            stableId={entry.stableId}
            displayNumber={entry.displayNumber}
            userLocation={location}
            dishName={data.dishName}
            selected={selectedStableId === entry.stableId}
            onSelect={handleSelect}
            cardRef={(el) => {
                cardRefs.current[entry.stableId] = el;
            }}
        />
    );

    const emptyMessage = <RestaurantEmptyState />;

    return (
        <Card
            className="w-full overflow-hidden shadow-none border-0"
            style={{
                background: "var(--cc-surface)",
                color: "var(--cc-text-primary)",
                borderRadius: "12px",
                padding: "28px",
            }}
        >
            {/* Header */}
            <div style={{ marginBottom: "24px" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
                    <div className="flex items-center gap-2" style={{ color: "#ff6b35" }}>
                        <Utensils className="w-4 h-4" />
                        <span
                            style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            Dine Out
                        </span>
                        {sortedEntries.length > 0 && (
                            <span
                                style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: "980px",
                                    background: "rgba(255,107,53,0.15)",
                                    color: "#ff6b35",
                                }}
                            >
                                {sortedEntries.length}
                            </span>
                        )}
                    </div>
                    <ShareButton
                        title="Restaurant Suggestions"
                        text={`Check out these restaurant suggestions: ${data.reason}`}
                    />
                </div>
                <h2
                    style={{
                        fontSize: "28px",
                        fontWeight: 600,
                        lineHeight: 1.14,
                        letterSpacing: "0.007em",
                        color: "var(--cc-text-primary)",
                    }}
                >
                    Restaurant Suggestions
                </h2>
                <p
                    style={{
                        marginTop: "4px",
                        fontSize: "14px",
                        lineHeight: 1.43,
                        letterSpacing: "-0.016em",
                        color: "var(--cc-text-secondary)",
                    }}
                >
                    {data.reason}
                </p>

                {/* Delivery order buttons */}
                {data.dishName && location && (
                    <div className="flex gap-2 flex-wrap" style={{ marginTop: "12px" }}>
                        <a
                            href={buildSwiggyOrderLink(data.dishName, location.lat, location.lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-white bg-orange-500 hover:bg-orange-600 transition-colors"
                            style={{ fontSize: "12px", fontWeight: 600, padding: "8px 16px", borderRadius: "980px" }}
                        >
                            Order on Swiggy <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                            href={buildZomatoOrderLink(data.dishName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-white bg-red-500 hover:bg-red-600 transition-colors"
                            style={{ fontSize: "12px", fontWeight: 600, padding: "8px 16px", borderRadius: "980px" }}
                        >
                            Order on Zomato <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                )}
            </div>

            {/* Filter chips */}
            {sortedEntries.length > 1 && (
                <FilterChips
                    value={sortKey}
                    onChange={setSortKey}
                    hasLocation={!!location}
                />
            )}

            {/* ============================================================
                MOBILE layout (<md): map on top, horizontal snap carousel below.
                Carousel cards are ~280px wide, snap to center, one visible
                at a time with peek of the next card on both sides.
               ============================================================ */}
            <div className="block md:hidden" style={{ marginBottom: "16px" }}>
                <RestaurantMap
                    pins={mapPins}
                    center={mapCenter}
                    selectedStableId={selectedStableId}
                    onSelect={handleSelect}
                    apiKey={mapsApiKey}
                    embedFallbackUrl={embedUrl}
                />
            </div>

            {sortedEntries.length > 0 ? (
                <div
                    ref={carouselRef}
                    className="flex md:hidden gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-2 px-2 hide-scrollbar"
                    style={{
                        WebkitOverflowScrolling: "touch",
                    }}
                >
                    {sortedEntries.map((entry) => (
                        <div
                            key={entry.stableId}
                            data-stableid={entry.stableId}
                            className="snap-center shrink-0"
                            style={{ width: "85vw", maxWidth: "340px" }}
                        >
                            {renderCard(entry)}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="block md:hidden">{emptyMessage}</div>
            )}

            {/* ============================================================
                DESKTOP layout (md+): vertical scrollable list + sticky map.
               ============================================================ */}
            <div className="hidden md:grid md:grid-cols-[380px_1fr] gap-6">
                <div className="space-y-6 max-h-[700px] overflow-y-auto pr-2" style={{ scrollbarWidth: "thin" }}>
                    {sortedEntries.length > 0
                        ? sortedEntries.map((entry) => renderCard(entry))
                        : emptyMessage}
                </div>

                <div className="sticky top-4 self-start">
                    <RestaurantMap
                        pins={mapPins}
                        center={mapCenter}
                        selectedStableId={selectedStableId}
                        onSelect={handleSelect}
                        apiKey={mapsApiKey}
                        embedFallbackUrl={embedUrl}
                    />
                </div>
            </div>
        </Card>
    );
}

// ---------- Exported skeleton for streaming / loading state ----------

export function RestaurantViewSkeleton() {
    return (
        <Card
            className="w-full overflow-hidden shadow-none border-0"
            style={{
                background: "var(--cc-surface)",
                color: "var(--cc-text-primary)",
                borderRadius: "12px",
                padding: "28px",
            }}
        >
            {/* Header skeleton */}
            <div style={{ marginBottom: "24px" }}>
                <div
                    className="animate-pulse"
                    style={{ width: "80px", height: "14px", borderRadius: "6px", background: "var(--cc-surface-2)", marginBottom: "12px" }}
                />
                <div
                    className="animate-pulse"
                    style={{ width: "65%", height: "24px", borderRadius: "8px", background: "var(--cc-surface-2)", marginBottom: "8px" }}
                />
                <div
                    className="animate-pulse"
                    style={{ width: "90%", height: "14px", borderRadius: "6px", background: "var(--cc-surface-2)" }}
                />
            </div>

            {/* Body skeleton: cards + map placeholder */}
            <div className="hidden md:grid md:grid-cols-[380px_1fr] gap-6">
                <div className="space-y-6">
                    {[0, 1, 2].map((i) => (
                        <RestaurantCardSkeleton key={i} />
                    ))}
                </div>
                <div
                    className="animate-pulse"
                    style={{
                        borderRadius: "12px",
                        background: "var(--cc-surface-2)",
                        height: "500px",
                    }}
                />
            </div>

            {/* Mobile skeleton */}
            <div className="block md:hidden">
                <div
                    className="animate-pulse"
                    style={{
                        borderRadius: "12px",
                        background: "var(--cc-surface-2)",
                        height: "320px",
                        marginBottom: "16px",
                    }}
                />
                <div className="flex gap-4 overflow-hidden">
                    {[0, 1].map((i) => (
                        <div key={i} className="shrink-0" style={{ width: "85vw", maxWidth: "340px" }}>
                            <RestaurantCardSkeleton />
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
}
