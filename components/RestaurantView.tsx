"use client";

import { Card } from "@/components/ui/card";
import { Star, Utensils, ExternalLink, Car, Navigation, AlertCircle } from "lucide-react";
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

// ---------- Local helper components ----------

function RideButtons({
    pickup,
    dropoff,
    name,
}: {
    pickup: Coords;
    dropoff: Coords;
    name: string;
}) {
    const uberUrl = buildUberDeepLink(pickup, dropoff, name);
    const olaUrl = buildOlaDeepLink(pickup, dropoff, name);
    return (
        <div className="flex gap-2">
            <a
                href={uberUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-white bg-black hover:bg-gray-800 transition-colors"
                style={{ fontSize: "12px", fontWeight: 600, padding: "4px 12px", borderRadius: "980px" }}
            >
                <Car className="w-3 h-3" /> Uber
            </a>
            <a
                href={olaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-white bg-green-600 hover:bg-green-700 transition-colors"
                style={{ fontSize: "12px", fontWeight: 600, padding: "4px 12px", borderRadius: "980px" }}
            >
                <Car className="w-3 h-3" /> Ola
            </a>
        </div>
    );
}

function RestaurantCard({
    restaurant,
    index,
    userLocation,
}: {
    restaurant: Restaurant;
    index: number;
    userLocation: Coords | null;
}) {
    const imagePool = [
        "1517248135467-4c7edcad34c4",
        "1552566626-52f8b828add9",
        "1555396273-367ea4eb4db5",
        "1414235077428-338989a2e8c0",
        "1600891964092-4316c288032e",
    ];
    const photoId = imagePool[index % imagePool.length];

    return (
        <div className="group cursor-pointer">
            {/* Thumbnail */}
            <div
                className="aspect-[4/3] mb-3 relative overflow-hidden"
                style={{ borderRadius: "12px", background: "var(--cc-surface-2)" }}
            >
                <img
                    src={`https://images.unsplash.com/photo-${photoId}?w=400&h=300&fit=crop&auto=format`}
                    alt={restaurant.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop&auto=format";
                    }}
                />
                <div
                    className="absolute top-3 right-3 flex items-center gap-1"
                    style={{
                        background: "rgba(0,0,0,0.65)",
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
                {restaurant.cuisine && (
                    <div
                        className="absolute top-3 left-3"
                        style={{
                            background: "rgba(0,0,0,0.65)",
                            backdropFilter: "blur(8px)",
                            padding: "4px 8px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 400,
                            color: "#ffffff",
                        }}
                    >
                        {restaurant.cuisine}
                    </div>
                )}
            </div>

            {/* Content */}
            <div>
                <div className="flex justify-between items-start">
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
                    <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--cc-text-secondary)" }}>
                        {restaurant.priceRange}
                    </span>
                </div>
                <p style={{ fontSize: "14px", marginTop: "4px", color: "var(--cc-text-secondary)" }}>
                    {restaurant.area}
                </p>

                {/* Platform links */}
                <div className="flex flex-wrap gap-2" style={{ marginTop: "12px" }}>
                    {restaurant.zomatoUrl && (
                        <a
                            href={restaurant.zomatoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-white bg-red-500 hover:bg-red-600 transition-colors"
                            style={{ fontSize: "12px", fontWeight: 600, padding: "4px 12px", borderRadius: "980px" }}
                        >
                            Zomato <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                    {restaurant.swiggyUrl && (
                        <a
                            href={restaurant.swiggyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-white bg-orange-500 hover:bg-orange-600 transition-colors"
                            style={{ fontSize: "12px", fontWeight: 600, padding: "4px 12px", borderRadius: "980px" }}
                        >
                            Swiggy <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                    {restaurant.lat && restaurant.lng && userLocation && (
                        <a
                            href={buildGoogleMapsDirectionsLink(userLocation, {
                                lat: restaurant.lat,
                                lng: restaurant.lng,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                            style={{ fontSize: "12px", fontWeight: 600, padding: "4px 12px", borderRadius: "980px" }}
                        >
                            <Navigation className="w-3 h-3" /> Directions
                        </a>
                    )}
                </div>

                {/* Ride buttons per restaurant */}
                {restaurant.lat && restaurant.lng && userLocation && (
                    <div style={{ marginTop: "8px" }}>
                        <RideButtons
                            pickup={userLocation}
                            dropoff={{ lat: restaurant.lat, lng: restaurant.lng }}
                            name={restaurant.name}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function RestaurantMap({ embedUrl }: { embedUrl: string | null }) {
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
            {embedUrl ? (
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
            ) : (
                <div
                    className="flex flex-col items-center justify-center h-full p-6 text-center gap-2"
                    style={{ color: "var(--cc-text-tertiary)" }}
                >
                    <AlertCircle className="w-6 h-6" />
                    <p style={{ fontSize: "14px" }}>
                        Map unavailable — set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable.
                    </p>
                </div>
            )}
        </div>
    );
}

// ---------- Main component ----------

export function RestaurantView({ data }: RestaurantViewProps) {
    const { location } = useUser();
    const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

    // Restaurants from AI that have valid coordinates
    const restaurantsWithCoords = (data.restaurants || []).filter(
        (r): r is typeof r & { lat: number; lng: number } =>
            typeof r.lat === "number" && typeof r.lng === "number"
    );

    // Determine map center: user location, else first restaurant, else India default
    const mapCenter: Coords =
        location ||
        (restaurantsWithCoords.length > 0
            ? { lat: restaurantsWithCoords[0].lat, lng: restaurantsWithCoords[0].lng }
            : { lat: 28.6139, lng: 77.209 });

    // Build an Embed API URL. Use "search" mode with the query so Google shows
    // multiple results as markers automatically, centered on the user's location.
    const embedUrl = (() => {
        if (!mapsApiKey) return null;
        const params = new URLSearchParams({
            key: mapsApiKey,
            q: data.query || "restaurants",
            center: `${mapCenter.lat},${mapCenter.lng}`,
            zoom: "13",
        });
        return `https://www.google.com/maps/embed/v1/search?${params.toString()}`;
    })();

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
                            />
                        ))
                    ) : (
                        <p style={{ fontSize: "14px", color: "var(--cc-text-tertiary)" }}>
                            No specific restaurants found. Check the map!
                        </p>
                    )}
                </div>

                <RestaurantMap embedUrl={embedUrl} />
            </div>
        </Card>
    );
}
