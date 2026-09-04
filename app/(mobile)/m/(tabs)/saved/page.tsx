"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { getFavorites, getNutritionGoals, removeFavorite, type FavoriteItem } from "@/lib/storage";
import { setActiveRecipe } from "@/lib/mobile-handoff";
import { foodImage } from "@/lib/food-images";
import { Beet } from "@/components/mascots";
import type { RecipeData, Restaurant } from "@/lib/types";

/**
 * Saved tab — built to the Flow 7 artboard (1m).
 *
 * The artboard's real idea is the GOAL-AWARE empty state: when a category is
 * empty it does not just say "nothing here", it names the user's actual calorie
 * target and offers to go find something. That only works with a real goal, so
 * the copy falls back when none is set rather than inventing "2,000".
 *
 * Rows are the design's `.row` list card with a filled heart that genuinely
 * un-saves — previously the list was read-only, with no way to remove anything.
 */

type Tab = "recipes" | "restaurants";

const TABS: { id: Tab; label: string }[] = [
  { id: "recipes", label: "Recipes" },
  { id: "restaurants", label: "Restaurants" },
];

export default function SavedTab() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [goalKcal, setGoalKcal] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("recipes");

  useEffect(() => {
    setItems(getFavorites());
    setGoalKcal(getNutritionGoals()?.dailyCalories ?? null);
    setHydrated(true);
  }, []);

  const shown = useMemo(
    () => items.filter((i) => (tab === "recipes" ? i.type === "recipe" : i.type === "restaurant")),
    [items, tab],
  );

  const unsave = (id: string) => {
    removeFavorite(id);
    setItems((p) => p.filter((x) => x.id !== id));
  };

  const open = (it: FavoriteItem) => {
    if (it.type !== "recipe") return;
    setActiveRecipe(it.data as RecipeData);
    router.push("/m/recipe");
  };

  if (!hydrated) return <div style={{ minHeight: "100dvh", background: "var(--m-cream)" }} />;

  return (
    <div className="vstack" style={{ minHeight: "100dvh", background: "var(--m-cream)", padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px 0", gap: 14 }}>
      <span className="t-d2">Saved</span>

      {/* The artboard's third chip is "Collections", which does not exist as a
          data model. Two chips that work beat three where one is a decoy. */}
      <div className="hstack" style={{ gap: 8 }}>
        {TABS.map((t) => (
          <button key={t.id} className={`chip ${tab === t.id ? "chip-active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="scroll vstack" style={{ flex: 1, gap: 12, paddingBottom: 12 }}>
        {shown.map((it) => {
          const isRecipe = it.type === "recipe";
          const name = (it.data as { name: string }).name;
          const img = foodImage(name);
          const recipe = it.data as RecipeData;
          const rest = it.data as Restaurant;
          const mins = isRecipe ? (recipe.prepTime?.match(/\d+/)?.[0] ?? null) : null;
          const caption = isRecipe
            ? [
                recipe.nutritionEstimate?.calories,
                recipe.servings ? `${recipe.servings} serving${recipe.servings === 1 ? "" : "s"}` : null,
              ].filter(Boolean).join(" · ")
            : [rest.rating, rest.cuisine, rest.area].filter(Boolean).join(" · ");

          return (
            <div key={it.id} className="row">
              <button
                onClick={() => open(it)}
                className={img ? "imgfill" : "ph ph-saffron"}
                aria-label={isRecipe ? `Open ${name}` : name}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  border: "none",
                  flex: "none",
                  padding: 0,
                  backgroundImage: img ? `url(${img})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="vstack grow" style={{ gap: 2, minWidth: 0 }}>
                <span className="t-h2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                <div className="hstack" style={{ gap: 6 }}>
                  {mins && (
                    <span className="badge badge-forest" style={{ minWidth: 0, padding: "4px 8px 3px" }}>
                      <b style={{ fontSize: 13 }}>{mins}</b>
                    </span>
                  )}
                  {caption && <span className="t-cap">{caption}</span>}
                </div>
              </div>
              <button
                onClick={() => unsave(it.id)}
                aria-label={`Remove ${name} from saved`}
                style={{ background: "none", border: "none", padding: 0, color: "var(--m-red)", flex: "none" }}
              >
                <Heart width={20} height={20} fill="currentColor" />
              </button>
            </div>
          );
        })}

        {shown.length === 0 && (
          <div
            className="tint-lav vstack"
            style={{ borderRadius: 24, padding: "26px 22px", alignItems: "center", gap: 10, textAlign: "center", marginTop: 8 }}
          >
            <Beet width={110} height={110} />
            <span className="t-h1" style={{ color: "var(--m-plum)" }}>
              No saved {tab === "recipes" ? "recipes" : "restaurants"} yet
            </span>
            <span className="t-body-soft">
              {goalKcal
                ? `You’re aiming for ${goalKcal.toLocaleString()} kcal days — want Bo to find ${tab === "recipes" ? "recipes" : "spots"} that fit?`
                : `Tap the heart on a ${tab === "recipes" ? "recipe" : "restaurant"} and it lands here. Want Bo to find you one?`}
            </span>
            <button className="pill-plum pill-sm" onClick={() => router.push("/m/chat")}>Bo, do your thing</button>
          </div>
        )}
      </div>
    </div>
  );
}
