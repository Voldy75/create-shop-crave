"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Trash2, ArrowLeft, ChefHat, Utensils } from "lucide-react";
import { getFavorites, removeFavorite, type FavoriteItem } from "@/lib/storage";
import type { RecipeData, Restaurant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function FavoritesPage() {
    const router = useRouter();
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

    useEffect(() => {
        setFavorites(getFavorites());
    }, []);

    const handleRemove = (id: string) => {
        removeFavorite(id);
        setFavorites(getFavorites());
    };

    const recipes = favorites.filter((f) => f.type === "recipe");
    const restaurants = favorites.filter((f) => f.type === "restaurant");

    return (
        <div className="min-h-screen bg-white">
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
                <button
                    onClick={() => router.push("/chat")}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Back to chat"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                    <h1 className="font-bold text-lg text-gray-900">Favorites</h1>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-6 space-y-8">
                {favorites.length === 0 && (
                    <div className="text-center py-20 space-y-4">
                        <Heart className="w-12 h-12 text-gray-200 mx-auto" />
                        <p className="text-gray-500 text-lg">No favorites yet</p>
                        <p className="text-gray-400 text-sm">
                            Save recipes and restaurants from the chat to find them here.
                        </p>
                        <Button
                            onClick={() => router.push("/chat")}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full mt-4"
                        >
                            Start chatting
                        </Button>
                    </div>
                )}

                {recipes.length > 0 && (
                    <section>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
                            <ChefHat className="w-5 h-5 text-orange-600" />
                            Saved Recipes
                        </h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {recipes.map((fav) => {
                                const recipe = fav.data as RecipeData;
                                return (
                                    <Card key={fav.id} className="p-4 border border-gray-100 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-gray-900">{recipe.name}</h3>
                                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{recipe.description}</p>
                                                <div className="flex gap-2 mt-2">
                                                    {recipe.prepTime && (
                                                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                                                            {recipe.prepTime}
                                                        </span>
                                                    )}
                                                    {recipe.dietaryTags?.slice(0, 2).map((tag) => (
                                                        <span key={tag} className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemove(fav.id)}
                                                className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                aria-label="Remove from favorites"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                )}

                {restaurants.length > 0 && (
                    <section>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
                            <Utensils className="w-5 h-5 text-indigo-600" />
                            Saved Restaurants
                        </h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {restaurants.map((fav) => {
                                const restaurant = fav.data as Restaurant;
                                return (
                                    <Card key={fav.id} className="p-4 border border-gray-100 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-gray-900">{restaurant.name}</h3>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {restaurant.area} · {restaurant.priceRange}
                                                </p>
                                                {restaurant.cuisine && (
                                                    <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full mt-2 inline-block">
                                                        {restaurant.cuisine}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleRemove(fav.id)}
                                                className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                aria-label="Remove from favorites"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
