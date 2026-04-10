"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { saveFavorite, removeFavorite, getFavorites } from "@/lib/storage";
import { toast } from "sonner";
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
      toast("Removed from favorites");
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
      toast("Saved to favorites ♥");
    }
  };

  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-full transition-colors"
      style={
        isFav
          ? { color: "#ff453a", background: "rgba(255,69,58,0.12)" }
          : { color: "var(--cc-text-tertiary)", background: "var(--cc-surface-2)" }
      }
      onMouseEnter={(e) => {
        if (!isFav) (e.currentTarget as HTMLButtonElement).style.background = "var(--cc-surface-3)";
      }}
      onMouseLeave={(e) => {
        if (!isFav) (e.currentTarget as HTMLButtonElement).style.background = "var(--cc-surface-2)";
      }}
      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className="w-4 h-4" fill={isFav ? "currentColor" : "none"} />
    </button>
  );
}
