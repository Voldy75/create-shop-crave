"use client";

import { useState, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { Card } from "@/components/ui/card";
import { Star, Utensils, ExternalLink } from "lucide-react";
import { useUser } from "@/app/context/UserContext";

interface Restaurant {
    name: string;
    rating: string;
    priceRange: string;
    area: string;
    zomatoUrl: string;
    swiggyUrl: string;
}

interface RestaurantSuggestion {
    query: string;
    reason: string;
    restaurants?: Restaurant[];
}

interface RestaurantViewProps {
    data: RestaurantSuggestion;
}

interface Place {
    place_id: string;
    name: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
}

const containerStyle = {
    width: "100%",
    height: "100%",
};

export function RestaurantView({ data }: RestaurantViewProps) {
    const { location } = useUser();
    const [mapPlace, setMapPlace] = useState<Place | null>(null);
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [directionsError, setDirectionsError] = useState<string | null>(null);

    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: ["places"],
    });

    // Fetch a place for the map based on the query or first restaurant
    useEffect(() => {
        const fetchPlaceForMap = async () => {
            if (!location) return;
            try {
                // Use the query provided by AI to find a representative place on the map
                const res = await fetch(
                    `/api/places?query=${encodeURIComponent(data.query)}&lat=${location.lat}&lng=${location.lng}`
                );
                const result = await res.json();
                if (result.results && result.results.length > 0) {
                    setMapPlace(result.results[0]);
                }
            } catch (error) {
                console.error("Failed to fetch place for map", error);
            }
        };

        fetchPlaceForMap();
    }, [data.query, location]);

    useEffect(() => {
        if (isLoaded && location && mapPlace) {
            const directionsService = new google.maps.DirectionsService();
            directionsService.route(
                {
                    origin: location,
                    destination: mapPlace.geometry.location,
                    travelMode: google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === google.maps.DirectionsStatus.OK) {
                        setDirections(result);
                        setDirectionsError(null);
                    } else {
                        setDirectionsError("Could not calculate directions to this restaurant.");
                    }
                }
            );
        }
    }, [isLoaded, location, mapPlace]);

    const mapCenter = location || { lat: 28.6139, lng: 77.2090 };

    return (
        <Card className="w-full bg-white shadow-none border-0 overflow-hidden">
            <div className="mb-6">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                    <Utensils className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-wider text-xs">Dine Out</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Restaurant Suggestions</h2>
                <p className="text-gray-500 mt-1">{data.reason}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* List Section */}
                <div className="space-y-6">
                    {data.restaurants && data.restaurants.length > 0 ? (
                        data.restaurants.map((restaurant, index) => (
                            <div
                                key={index}
                                className="group cursor-pointer"
                            >
                                {/* Restaurant Thumbnail */}
                                <div className="aspect-[4/3] bg-gray-100 rounded-xl mb-3 relative overflow-hidden">
                                    <img
                                        src={`https://images.unsplash.com/photo-${[
                                            '1517248135467-4c7edcad34c4',
                                            '1552566626-52f8b828add9',
                                            '1555396273-367ea4eb4db5',
                                            '1414235077428-338989a2e8c0',
                                            '1600891964092-4316c288032e'
                                        ][index % 5]}?w=400&h=300&fit=crop&auto=format`}
                                        alt={restaurant.name}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop&auto=format';
                                        }}
                                    />
                                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-sm">
                                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                        {restaurant.rating}
                                    </div>
                                </div>

                                {/* Content */}
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-indigo-600 transition-colors">
                                            {restaurant.name}
                                        </h3>
                                        <span className="text-gray-900 font-medium text-sm">{restaurant.priceRange}</span>
                                    </div>
                                    <p className="text-gray-500 text-sm mt-1">{restaurant.area}</p>

                                    <div className="flex gap-3 mt-3">
                                        {restaurant.zomatoUrl && (
                                            <a
                                                href={restaurant.zomatoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-full transition-colors"
                                            >
                                                Zomato
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                        {restaurant.swiggyUrl && (
                                            <a
                                                href={restaurant.swiggyUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-full transition-colors"
                                            >
                                                Swiggy
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-gray-500">No specific restaurants found. Check the map!</p>
                    )}
                </div>

                {/* Map Section */}
                <div className="relative min-h-[400px] w-full rounded-2xl overflow-hidden bg-gray-100">
                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={mapCenter}
                            zoom={13}
                            options={{
                                disableDefaultUI: true,
                                zoomControl: true,
                                tilt: 45,
                                heading: 0,
                                mapTypeId: 'hybrid',
                                styles: [
                                    {
                                        featureType: "poi",
                                        elementType: "labels",
                                        stylers: [{ visibility: "off" }],
                                    },
                                ]
                            }}
                        >
                            {/* User Location */}
                            {location && (
                                <Marker
                                    position={location}
                                    icon={{
                                        path: google.maps.SymbolPath.CIRCLE,
                                        scale: 8,
                                        fillColor: "#4F46E5",
                                        fillOpacity: 1,
                                        strokeColor: "white",
                                        strokeWeight: 2,
                                    }}
                                />
                            )}

                            {/* Directions */}
                            {directions && (
                                <DirectionsRenderer
                                    directions={directions}
                                    options={{
                                        suppressMarkers: false,
                                        polylineOptions: {
                                            strokeColor: "#4F46E5",
                                            strokeWeight: 4,
                                        },
                                    }}
                                />
                            )}
                        </GoogleMap>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            Loading Map...
                        </div>
                    )}

                    {/* Overlay Info */}
                    {directionsError && (
                        <div className="absolute top-4 left-4 right-4 bg-red-50 text-red-600 text-sm p-3 rounded-xl shadow-sm">
                            {directionsError}
                        </div>
                    )}

                    {mapPlace && directions && (
                        <div className="absolute bottom-6 left-6 right-6 bg-white p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nearest Option</p>
                                <p className="font-bold text-gray-900 text-lg">
                                    {mapPlace.name}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-indigo-600">
                                    {directions.routes[0]?.legs[0]?.duration?.text?.split(" ")[0]}
                                </p>
                                <p className="text-xs text-gray-500 font-medium">min drive</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
