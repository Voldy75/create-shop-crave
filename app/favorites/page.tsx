"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Trash2, ArrowLeft, ChefHat, Utensils } from "lucide-react";
import { getFavorites, removeFavorite, type FavoriteItem } from "@/lib/storage";
import type { RecipeData, Restaurant } from "@/lib/types";

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
        <div className="min-h-screen" style={{ background: "var(--cc-bg)", color: "var(--cc-text-primary)" }}>
            <header className="glass-nav px-6 flex items-center gap-4 sticky top-0 z-10" style={{ height: "48px" }}>
                <button
                    onClick={() => router.push("/chat")}
                    className="p-2 rounded-full transition-opacity hover:opacity-70"
                    style={{ color: "var(--cc-text-secondary)" }}
                    aria-label="Back to chat"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 fill-current" style={{ color: "var(--cc-accent)" }} />
                    <h1 style={{ fontSize: "14px", fontWeight: 400, color: "var(--cc-text-primary)" }}>Favorites</h1>
                </div>
            </header>

            <main className="max-w-[980px] mx-auto p-6 space-y-8">
                {favorites.length === 0 && (
                    <div className="text-center" style={{ paddingTop: "100px", paddingBottom: "100px" }}>
                        <div className="space-y-4">
                            <div
                                className="w-16 h-16 mx-auto flex items-center justify-center text-3xl"
                                style={{ background: "var(--cc-surface-2)", borderRadius: "12px" }}
                            >
                                🍽️
                            </div>
                            <p style={{ fontSize: "21px", fontWeight: 600, color: "var(--cc-text-primary)" }}>Nothing saved yet</p>
                            <p style={{ fontSize: "14px", maxWidth: "280px", margin: "0 auto", color: "var(--cc-text-secondary)" }}>
                                Save recipes and restaurants from the chat to find them here.
                            </p>
                            <button
                                onClick={() => router.push("/chat")}
                                className="btn-pill-primary"
                                style={{ display: "inline-block", marginTop: "16px" }}
                            >
                                Start exploring
                            </button>
                        </div>
                    </div>
                )}

                {recipes.length > 0 && (
                    <section>
                        <h2 className="flex items-center gap-2" style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "-0.01em",
                            color: "var(--cc-text-secondary)",
                            marginBottom: "16px",
                        }}>
                            <ChefHat className="w-4 h-4" style={{ color: "var(--cc-accent)" }} />
                            Saved Recipes
                            <span style={{
                                fontSize: "12px", fontWeight: 400, padding: "2px 8px",
                                borderRadius: "980px", background: "var(--cc-surface-2)", color: "var(--cc-text-tertiary)",
                            }}>
                                {recipes.length}
                            </span>
                        </h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {recipes.map((fav) => {
                                const recipe = fav.data as RecipeData;
                                return (
                                    <div key={fav.id} className="p-4" style={{ background: "var(--cc-surface)", borderRadius: "12px" }}>
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0 flex-1">
                                                <h3 style={{ fontSize: "17px", fontWeight: 600, color: "var(--cc-text-primary)" }}>{recipe.name}</h3>
                                                <p className="line-clamp-2" style={{ fontSize: "14px", marginTop: "4px", color: "var(--cc-text-secondary)" }}>{recipe.description}</p>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {recipe.prepTime && (
                                                        <span style={{
                                                            fontSize: "12px", padding: "2px 8px", borderRadius: "980px",
                                                            background: "var(--cc-surface-2)", color: "var(--cc-text-secondary)",
                                                        }}>
                                                            {recipe.prepTime}
                                                        </span>
                                                    )}
                                                    {recipe.dietaryTags?.slice(0, 2).map((tag) => (
                                                        <span key={tag} style={{
                                                            fontSize: "12px", padding: "2px 8px", borderRadius: "980px",
                                                            background: "rgba(52,199,89,0.1)", color: "#34c759",
                                                        }}>
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemove(fav.id)}
                                                className="p-2 rounded-full transition-colors shrink-0 ml-2 text-[var(--cc-text-tertiary)] hover:text-[#ff453a] hover:bg-[rgba(255,69,58,0.1)]"
                                                aria-label="Remove from favorites"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {restaurants.length > 0 && (
                    <section>
                        <h2 className="flex items-center gap-2" style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "-0.01em",
                            color: "var(--cc-text-secondary)",
                            marginBottom: "16px",
                        }}>
                            <Utensils className="w-4 h-4" style={{ color: "var(--cc-accent)" }} />
                            Saved Restaurants
                            <span style={{
                                fontSize: "12px", fontWeight: 400, padding: "2px 8px",
                                borderRadius: "980px", background: "var(--cc-surface-2)", color: "var(--cc-text-tertiary)",
                            }}>
                                {restaurants.length}
                            </span>
                        </h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            {restaurants.map((fav) => {
                                const restaurant = fav.data as Restaurant;
                                return (
                                    <div key={fav.id} className="p-4" style={{ background: "var(--cc-surface)", borderRadius: "12px" }}>
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0 flex-1">
                                                <h3 style={{ fontSize: "17px", fontWeight: 600, color: "var(--cc-text-primary)" }}>{restaurant.name}</h3>
                                                <p style={{ fontSize: "14px", marginTop: "4px", color: "var(--cc-text-secondary)" }}>
                                                    {restaurant.area} · {restaurant.priceRange}
                                                </p>
                                                {restaurant.cuisine && (
                                                    <span className="inline-block mt-2" style={{
                                                        fontSize: "12px", padding: "2px 8px", borderRadius: "980px",
                                                        background: "var(--cc-surface-2)", color: "var(--cc-text-secondary)",
                                                    }}>
                                                        {restaurant.cuisine}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleRemove(fav.id)}
                                                className="p-2 rounded-full transition-colors shrink-0 ml-2 text-[var(--cc-text-tertiary)] hover:text-[#ff453a] hover:bg-[rgba(255,69,58,0.1)]"
                                                aria-label="Remove from favorites"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
