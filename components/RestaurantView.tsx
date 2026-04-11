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
    index,
    userLocation,
    dishName,
    selected,
    onSelect,
    cardRef,
}: {
    restaurant: Restaurant;
    index: number;
    userLocation: Coords | null;
    dishName?: string;
    selected: boolean;
    onSelect: (index: number) => void;
    cardRef?: (el: HTMLElement | null) => void;
}) {
    const photoId = IMAGE_POOL[index % IMAGE_POOL.length];
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
            onMouseEnter={() => onSelect(index)}
            onClick={() => onSelect(index)}
            style={{
                background: "var(--cc-surface)",
                border: selected
                    ? "2px solid var(--cc-accent)"
                    : "1px solid var(--cc-border)",
                borderRadius: "12px",
                overflow: "hidden",
                transition: "border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease",
                boxShadow: selected ? "0 8px 24px rgba(255,107,53,0.18)" : "none",
                cursor: "pointer",
                scrollMarginTop: "12px",
            }}
        >
            {/* Thumbnail */}
            <div
                className="aspect-[16/9] relative overflow-hidden"
                style={{ background: "var(--cc-surface-2)" }}
            >
                <img
                    src={`https://images.unsplash.com/photo-${photoId}?w=600&h=340&fit=crop&auto=format`}
                    alt={restaurant.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_IMG;
                    }}
                />

                {/* Numbered pin badge */}
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
                    aria-label={`Marker ${index + 1}`}
                >
                    {index + 1}
                </div>

                {/* Rating badge */}
                <div
                    className="absolute top-3 right-3 flex items-center gap-1"
                    style={{
                        background: "rgba(0,0,0,0.7)",
                        backdropFilter: "blur(8px)",
                        padding: "4px 8px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#ffffff",
                    }}
                >
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {restaurant.rating}
                </div>
            </div>

            {/* Body */}
            <div style={{ padding: "14px 16px 16px" }}>
                {/* Meta row: cuisine · price · distance · ETA */}
                <div
                    className="flex items-center flex-wrap gap-x-1.5"
                    style={{
                        fontSize: "12px",
                        color: "var(--cc-text-tertiary)",
                        marginBottom: "4px",
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

                {/* Title */}
                <h3
                    style={{
                        fontSize: "17px",
                        fontWeight: 600,
                        lineHeight: 1.24,
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

function InteractiveRestaurantMap({
    restaurants,
    center,
    selectedIndex,
    onSelect,
    apiKey,
}: {
    restaurants: MapRestaurant[];
    center: Coords;
    selectedIndex: number | null;
    onSelect: (index: number) => void;
    apiKey: string;
}) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: "crave-create-maps",
        googleMapsApiKey: apiKey,
    });

    const mapRef = useRef<google.maps.Map | null>(null);

    // Fit bounds once after load so all markers are visible.
    useEffect(() => {
        if (!isLoaded || !mapRef.current) return;
        if (restaurants.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        restaurants.forEach((r) => bounds.extend({ lat: r.lat, lng: r.lng }));
        bounds.extend(center);
        mapRef.current.fitBounds(bounds, 64);
    }, [isLoaded, restaurants, center]);

    // Pan to selected marker on change.
    useEffect(() => {
        if (!isLoaded || !mapRef.current || selectedIndex === null) return;
        const r = restaurants[selectedIndex];
        if (!r) return;
        mapRef.current.panTo({ lat: r.lat, lng: r.lng });
    }, [isLoaded, selectedIndex, restaurants]);

    if (loadError) {
        return (
            <MapErrorFallback
                message="Couldn't load Google Maps. Check that the Maps JavaScript API is enabled for your key."
            />
        );
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
            {restaurants.map((r, i) => (
                <Marker
                    key={i}
                    position={{ lat: r.lat, lng: r.lng }}
                    icon={numberedMarkerIcon(i + 1, selectedIndex === i)}
                    onClick={() => onSelect(i)}
                    zIndex={selectedIndex === i ? 999 : 10 + i}
                    title={r.name}
                />
            ))}
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

function RestaurantMap({
    restaurants,
    center,
    selectedIndex,
    onSelect,
    apiKey,
    embedFallbackUrl,
}: {
    restaurants: MapRestaurant[];
    center: Coords;
    selectedIndex: number | null;
    onSelect: (index: number) => void;
    apiKey: string;
    embedFallbackUrl: string | null;
}) {
    return (
        <div
            className="relative w-full overflow-hidden"
            style={{
                borderRadius: "12px",
                background: "var(--cc-surface-2)",
                height: "500px",
                minHeight: "400px",
            }}
        >
            {apiKey && restaurants.length > 0 ? (
                <InteractiveRestaurantMap
                    restaurants={restaurants}
                    center={center}
                    selectedIndex={selectedIndex}
                    onSelect={onSelect}
                    apiKey={apiKey}
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

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const cardRefs = useRef<Array<HTMLElement | null>>([]);

    // Restaurants from AI that have valid coordinates — these are what we pin.
    const restaurantsWithCoords = useMemo<MapRestaurant[]>(
        () =>
            (data.restaurants || []).filter(
                (r): r is MapRestaurant =>
                    typeof r.lat === "number" && typeof r.lng === "number"
            ),
        [data.restaurants]
    );

    // Determine map center: user location, else first restaurant, else India default.
    const mapCenter: Coords = useMemo(
        () =>
            location ||
            (restaurantsWithCoords.length > 0
                ? { lat: restaurantsWithCoords[0].lat, lng: restaurantsWithCoords[0].lng }
                : { lat: 28.6139, lng: 77.209 }),
        [location, restaurantsWithCoords]
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

    // When a pin is clicked on the map, scroll the matching card into view.
    // We look up by the restaurant's position in data.restaurants, not
    // restaurantsWithCoords, because cardRefs are indexed by the full list.
    const handleSelectFromMap = (mapIndex: number) => {
        const target = restaurantsWithCoords[mapIndex];
        if (!target) return;
        const cardIndex = (data.restaurants || []).findIndex((r) => r === target);
        if (cardIndex < 0) return;
        setSelectedIndex(cardIndex);
        const el = cardRefs.current[cardIndex];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    // When a card is hovered/clicked, sync the map highlight.
    const handleSelectFromCard = (cardIndex: number) => {
        setSelectedIndex(cardIndex);
    };

    // Translate the card-index selection to a map-index selection for the map.
    const mapSelectedIndex = useMemo(() => {
        if (selectedIndex === null) return null;
        const card = (data.restaurants || [])[selectedIndex];
        if (!card) return null;
        const mi = restaurantsWithCoords.findIndex((r) => r === card);
        return mi >= 0 ? mi : null;
    }, [selectedIndex, data.restaurants, restaurantsWithCoords]);

    return (
        <Card
            className="w-full overflow-hidden shadow-none border-0"
            style={{
                background: "var(--cc-surface)",
                color: "var(--cc-text-primary)",
                borderRadius: "12px",
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
                    <div className="flex gap-2" style={{ marginTop: "12px" }}>
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

            {/* Body: list + map */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    {data.restaurants && data.restaurants.length > 0 ? (
                        data.restaurants.map((restaurant, index) => (
                            <RestaurantCard
                                key={index}
                                restaurant={restaurant}
                                index={index}
                                userLocation={location}
                                dishName={data.dishName}
                                selected={selectedIndex === index}
                                onSelect={handleSelectFromCard}
                                cardRef={(el) => {
                                    cardRefs.current[index] = el;
                                }}
                            />
                        ))
                    ) : (
                        <p style={{ fontSize: "14px", color: "var(--cc-text-tertiary)" }}>
                            No specific restaurants found. Check the map!
                        </p>
                    )}
                </div>

                <RestaurantMap
                    restaurants={restaurantsWithCoords}
                    center={mapCenter}
                    selectedIndex={mapSelectedIndex}
                    onSelect={handleSelectFromMap}
                    apiKey={mapsApiKey}
                    embedFallbackUrl={embedUrl}
                />
            </div>
        </Card>
    );
}
