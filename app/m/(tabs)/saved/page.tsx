"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, ChefHat, Store } from "lucide-react";
import { getFavorites, type FavoriteItem } from "@/lib/storage";
import type { RecipeData, Restaurant } from "@/lib/types";

/**
 * Saved tab — favorites list (meshi ScreenFavorites), real data from
 * getFavorites(). Recipes and restaurants the user starred elsewhere.
 */
export default function SavedTab() {
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    setItems(getFavorites());
    setHydrated(true);
  }, []);

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top,12px) + 10px) 16px 8px" }}>
        <h1 className="t-h1">Saved</h1>
      </div>

      <div className="scroll" style={{ flex: 1, padding: "8px 14px 90px" }}>
        {hydrated && items.length === 0 && (
          <div className="col" style={{ alignItems: "center", textAlign: "center", gap: 12, paddingTop: "22vh" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--cc-surf-2)", display: "grid", placeItems: "center", color: "var(--cc-ink-3)" }}>
              <Heart width={26} height={26} />
            </div>
            <h2 className="t-h2">Nothing saved yet</h2>
            <p className="t-small" style={{ maxWidth: 260 }}>Tap the heart on a recipe or restaurant to keep it here.</p>
            <Link href="/m/chat" className="pill-primary" style={{ width: "auto", padding: "12px 22px", textDecoration: "none", marginTop: 4 }}>Find something</Link>
          </div>
        )}

        <div className="col" style={{ gap: 10 }}>
          {items.map((it) => {
            const isRecipe = it.type === "recipe";
            const name = (it.data as { name: string }).name;
            const sub = isRecipe
              ? [(it.data as RecipeData).prepTime, (it.data as RecipeData).nutritionEstimate?.calories].filter(Boolean).join(" · ")
              : [(it.data as Restaurant).area, (it.data as Restaurant).priceRange].filter(Boolean).join(" · ");
            return (
              <div key={it.id} className="card row" style={{ padding: 10, gap: 12 }}>
                <div className={`ph ${isRecipe ? "ph-saffron" : "ph-fire"}`} style={{ width: 60, height: 60, borderRadius: "var(--cc-r-md)", flexShrink: 0, display: "grid", placeItems: "center" }}>
                  {isRecipe ? <ChefHat width={20} height={20} style={{ color: "#fff", opacity: 0.9 }} /> : <Store width={20} height={20} style={{ color: "#fff", opacity: 0.9 }} />}
                </div>
                <div className="col" style={{ flex: 1, gap: 3, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="t-cap" style={{ fontSize: 9 }}>{isRecipe ? "RECIPE" : "RESTAURANT"}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                  {sub && <span className="t-small">{sub}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
