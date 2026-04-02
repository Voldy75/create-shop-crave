"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { saveFavorite, removeFavorite, getFavorites } from "@/lib/storage";
import type { RecipeData, Restaurant } from "@/lib/types";

interface FavoriteButtonProps {
  type: "recipe" | "restaurant";
  data: RecipeData | Restaurant;
}

export function FavoriteButton({ type, data }: FavoriteButtonProps) {
  const [isFav, setIsFav] = useState(false);
  const [favId, setFavId] = useState<string | null>(null);

  useEffect(() => {
    const favorites = getFavorites();
    const match = favorites.find(
      (f) => f.type === type && (f.data as { name: string }).name === data.name
    );
    if (match) {
      setIsFav(true);
      setFavId(match.id);
    }
  }, [type, data.name]);

  const toggle = () => {
    if (isFav && favId) {
      removeFavorite(favId);
      setIsFav(false);
      setFavId(null);
    } else {
      saveFavorite(type, data);
      const favorites = getFavorites();
      const match = favorites.find(
        (f) => f.type === type && (f.data as { name: string }).name === data.name
      );
      if (match) {
        setIsFav(true);
        setFavId(match.id);
      }
    }
  };

  return (
    <button
      onClick={toggle}
      className={`p-1.5 rounded-full transition-colors ${
        isFav
          ? "text-red-500 bg-red-50 hover:bg-red-100"
          : "text-gray-400 bg-gray-50 hover:bg-gray-100 hover:text-gray-600"
      }`}
      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className={`w-4 h-4 ${isFav ? "fill-red-500" : ""}`} />
    </button>
  );
}
