"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, MapPin } from "lucide-react";
import { getActiveRecipe, setActiveRecipe } from "@/lib/mobile-handoff";
import { getFavorites, isFavorited, removeFavorite, saveFavorite } from "@/lib/storage";
import { parseNumeric } from "@/lib/nutrition";
import { foodImage } from "@/lib/food-images";
import { mascotComponentFor, tileTint } from "@/lib/ingredient-mascot";
import type { RecipeData } from "@/lib/types";

/**
 * Recipe detail — built to the Flow 3 "Recipe detail" artboard (1f).
 *
 * The artboard is a photo hero with a cream sheet riding over it, and it makes
 * two structural choices the previous editorial layout did not:
 *
 *  - Ingredients are a 4-up grid of MASCOT TILES, not a checklist. Four show;
 *    the fourth becomes "+N more" and expands to the full priced list, so the
 *    quantities and estimates the buy flow depends on are still reachable.
 *  - The bottom is a three-way action row (Cook / Buy / Dine-in), which
 *    replaces the black sticky pill — the single largest piece of hardcoded
 *    dark styling on this screen.
 *
 * The servings toggle scales quantities and the price estimate, so it is a real
 * control rather than the artboard's static 2/4 chip pair.
 */

const SAMPLE: RecipeData = {
  name: "Butter Chicken",
  description: "Restaurant-style, rich & creamy.",
  prepTime: "35 min",
  servings: 4,
  dietaryTags: ["gluten-free", "high-protein"],
  ingredients: [
    { item: "Boneless chicken thigh", quantity: "500 g", price: "₹180" },
    { item: "Tomato passata", quantity: "400 g", price: "₹95" },
    { item: "Heavy cream", quantity: "120 ml", price: "₹85" },
    { item: "Butter (unsalted)", quantity: "50 g", price: "₹35" },
    { item: "Garam masala", quantity: "1 tsp", price: "₹25" },
  ],
  instructions: [
    "Marinate chicken in yogurt, ginger-garlic & spices for 20 min.",
    "Char chicken in a hot pan or under the grill until just done.",
    "Simmer tomato base with butter, cream and a pinch of sugar.",
    "Add chicken back, finish with cream & kasuri methi. Serve hot.",
  ],
  nutritionEstimate: { calories: "520 cal", protein: "38g", carbs: "18g", fat: "32g" },
};

/** Tiles shown before the grid collapses into "+N more". */
const TILE_SLOTS = 4;

/**
 * Scale the leading number in a quantity string ("500 g" → "250 g"). Anything
 * without a leading number ("to taste", "a pinch") passes through untouched —
 * doubling "a pinch" would be nonsense.
 */
function scaleQuantity(quantity: string | undefined, factor: number): string | undefined {
  if (!quantity || factor === 1) return quantity;
  return quantity.replace(/^\s*(\d+(?:\.\d+)?)/, (_, n: string) => {
    const scaled = parseFloat(n) * factor;
    return String(Math.round(scaled * 100) / 100);
  });
}

/**
 * Scale a price string ("₹180" → "₹360"). The number is not leading here, so
 * unlike a quantity this replaces the first number anywhere in the string —
 * keeping the currency symbol and any suffix intact. Row prices must scale with
 * the same factor as the total, or the two disagree on screen.
 */
function scalePrice(price: string | undefined, factor: number): string | undefined {
  if (!price || factor === 1) return price;
  return price.replace(/\d+(?:\.\d+)?/, (n) => String(Math.round(parseFloat(n) * factor)));
}

/** "35 min" → "35m" for the Cook button; falls back to the raw string. */
function shortTime(prepTime: string | undefined): string | null {
  if (!prepTime) return null;
  const n = prepTime.match(/\d+/);
  return n ? `${n[0]}m` : prepTime;
}

/** Rough difficulty from step count — the artboard's "EZ" badge. */
function difficultyFor(steps: number): string {
  if (steps <= 4) return "EZ";
  if (steps <= 7) return "MID";
  return "PRO";
}

export default function MobileRecipe() {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [saved, setSaved] = useState(false);
  const [portions, setPortions] = useState(2);
  const [showAllIngredients, setShowAllIngredients] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(false);

  useEffect(() => {
    const r = getActiveRecipe() ?? SAMPLE;
    setRecipe(r);
    setPortions(r.servings && r.servings > 0 ? r.servings : 2);
    setSaved(isFavorited("recipe", r.name));
  }, []);

  const basePortions = recipe?.servings && recipe.servings > 0 ? recipe.servings : 2;
  const factor = portions / basePortions;

  const estTotal = useMemo(
    () => (recipe ? Math.round(recipe.ingredients.reduce((s, i) => s + parseNumeric(i.price) * factor, 0)) : 0),
    [recipe, factor],
  );

  if (!recipe) return <div style={{ minHeight: "100dvh", background: "var(--m-cream)" }} />;

  const img = foodImage(recipe.name);
  const cookTime = shortTime(recipe.prepTime);
  const kcal = recipe.nutritionEstimate?.calories;
  const tiles = showAllIngredients ? recipe.ingredients : recipe.ingredients.slice(0, TILE_SLOTS - 1);
  const overflow = recipe.ingredients.length - (TILE_SLOTS - 1);
  const steps = showAllSteps ? recipe.instructions : recipe.instructions.slice(0, 1);

  const toggleSave = () => {
    if (saved) {
      const hit = getFavorites().find((f) => f.type === "recipe" && (f.data as RecipeData).name === recipe.name);
      if (hit) removeFavorite(hit.id);
      setSaved(false);
    } else {
      saveFavorite("recipe", recipe);
      setSaved(true);
    }
  };

  const buyAll = () => {
    setActiveRecipe(recipe);
    router.push("/m/buy");
  };

  /* No cook mode exists yet, so Cook does the honest thing: opens every step. */
  const startCooking = () => {
    setShowAllSteps(true);
    document.getElementById("recipe-steps")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--m-cream)" }}>
      {/* Hero */}
      <div
        className={img ? "imgfill" : "ph ph-saffron"}
        style={{
          height: 310,
          backgroundImage: img ? `url(${img})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
        }}
      >
        {/* Top-down scrim so the controls stay legible on a bright photo */}
        <div className="scrim-hero" />
        <div
          className="hstack"
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 12px) + 8px)",
            left: 16,
            right: 16,
            justifyContent: "space-between",
          }}
        >
          <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft width={20} height={20} />
          </button>
          <button
            className="icon-btn"
            onClick={toggleSave}
            aria-label={saved ? "Remove from saved" : "Save recipe"}
            aria-pressed={saved}
            style={{ color: "var(--m-red)" }}
          >
            <Heart width={20} height={20} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      {/* Sheet — rides 40px over the hero, per the artboard's 310/270 offset */}
      <div
        className="vstack"
        style={{
          position: "relative",
          marginTop: -40,
          background: "var(--m-cream)",
          borderRadius: "32px 32px 0 0",
          padding: "18px 22px 0",
          gap: 14,
        }}
      >
        {/* Title, rating, badges */}
        <div className="hstack" style={{ alignItems: "flex-start", gap: 12 }}>
          {/* The artboard carries a carrot rating here, but RecipeData has no
              rating and nothing collects one — inventing "4.2 (154)" would put
              fabricated review data on a real screen. Restore this the day
              ratings exist; the CarrotRating component is already built. */}
          <div className="vstack grow" style={{ gap: 6, minWidth: 0 }}>
            <span className="t-d2">{recipe.name}</span>
          </div>
          <div className="hstack" style={{ gap: 6, flex: "none" }}>
            {cookTime && <span className="badge badge-forest"><b>{cookTime.replace("m", "")}</b>min</span>}
            <span className="badge badge-plum"><b>{portions}</b>ppl</span>
            <span className="badge badge-burnt"><b>{difficultyFor(recipe.instructions.length)}</b>diff</span>
          </div>
        </div>

        {/* Tags */}
        <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
          {kcal && (
            <span className="chip-tag chip" style={{ background: "var(--m-tint-peach)", color: "var(--m-burnt)" }}>
              {kcal}
            </span>
          )}
          {(recipe.dietaryTags ?? []).slice(0, 3).map((t, i) => (
            <span
              key={t}
              className="chip-tag chip"
              style={
                i % 2 === 0
                  ? undefined
                  : { background: "var(--m-tint-lav)", color: "var(--m-plum)" }
              }
            >
              {t}
            </span>
          ))}
        </div>

        {recipe.description && <p className="t-body-soft">{recipe.description}</p>}

        {/* Ingredients */}
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <span className="t-h1">Ingredients</span>
          <div className="hstack" style={{ gap: 0, background: "var(--m-cream-2)", borderRadius: 99, padding: 4 }}>
            {[basePortions, basePortions * 2].map((p) => {
              const on = portions === p;
              return (
                <button
                  key={p}
                  onClick={() => setPortions(p)}
                  className="t-cap"
                  aria-pressed={on}
                  style={{
                    padding: "4px 12px",
                    border: "none",
                    borderRadius: 99,
                    background: on ? "var(--m-card)" : "transparent",
                    boxShadow: on ? "var(--m-shadow)" : "none",
                    color: "var(--m-ink)",
                    fontWeight: 700,
                  }}
                >
                  {p} ppl
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {tiles.map((ing, i) => {
            const Mascot = mascotComponentFor(ing.item);
            const qty = scaleQuantity(ing.quantity, factor);
            return (
              <div
                key={ing.item}
                className={`mascot-tile ing-tile ${tileTint(i)}`}
                style={{ padding: "10px 4px", gap: 3 }}
                title={[qty, ing.item].filter(Boolean).join(" ")}
              >
                <Mascot width={38} height={38} />
                {qty && <span className="t-cap ing-qty">{qty}</span>}
                <span className="t-cap ing-name">{ing.item}</span>
              </div>
            );
          })}
          {!showAllIngredients && overflow > 0 && (
            <button
              className={`mascot-tile ing-tile ${tileTint(TILE_SLOTS - 1)}`}
              onClick={() => setShowAllIngredients(true)}
              style={{ padding: "10px 4px", gap: 3, border: "none" }}
            >
              {(() => {
                const Mascot = mascotComponentFor(recipe.ingredients[TILE_SLOTS - 1]?.item ?? "onion");
                return <Mascot width={38} height={38} />;
              })()}
              <span className="t-cap ing-name">+{overflow} more</span>
            </button>
          )}
        </div>

        {/* The priced list the buy flow relies on — revealed with the full grid */}
        {showAllIngredients && (
          <div className="vstack" style={{ gap: 8 }}>
            {recipe.ingredients.map((ing) => (
              <div key={`row-${ing.item}`} className="row" style={{ padding: "10px 14px" }}>
                <span className="t-body grow">{ing.item}</span>
                {ing.quantity && <span className="t-cap">{scaleQuantity(ing.quantity, factor)}</span>}
                {ing.price && (
                  <span className="t-cap" style={{ color: "var(--m-forest)", fontWeight: 700 }}>{scalePrice(ing.price, factor)}</span>
                )}
              </div>
            ))}
            {estTotal > 0 && (
              <span className="t-cap" style={{ alignSelf: "flex-end" }}>~₹{estTotal} estimated</span>
            )}
          </div>
        )}

        {/* Steps */}
        {recipe.instructions.length > 0 && (
          <div className="vstack" id="recipe-steps" style={{ gap: 10 }}>
            <span className="t-h1">Steps</span>
            {steps.map((s, i) => (
              <div key={i} className="row" style={{ padding: "12px 14px", alignItems: "flex-start" }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--m-forest)",
                    color: "var(--m-on-deep)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    font: "800 15px var(--m-font-display)",
                    flex: "none",
                  }}
                >
                  {i + 1}
                </span>
                <span className="t-body grow">{s}</span>
              </div>
            ))}
            {!showAllSteps && recipe.instructions.length > 1 && (
              <button
                onClick={() => setShowAllSteps(true)}
                className="row"
                style={{ padding: "10px 14px", boxShadow: "none", background: "transparent", justifyContent: "center", border: "none" }}
              >
                <span className="t-cap" style={{ color: "var(--m-forest)", fontWeight: 700 }}>
                  +{recipe.instructions.length - 1} more steps
                </span>
              </button>
            )}
          </div>
        )}

        {/* Clears the sticky action row */}
        <div style={{ height: 86 }} />
      </div>

      {/* Actions — sticky so Buy stays reachable on a long recipe */}
      <div
        className="action-fade"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          margin: "0 auto",
          maxWidth: 520,
          display: "flex",
          alignItems: "stretch",
          gap: 8,
          padding: "12px 22px calc(14px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button className="pill-primary" style={{ flex: 1.5, padding: "0 14px" }} onClick={startCooking}>
          Cook{cookTime ? ` · ${cookTime}` : ""}
        </button>
        <button className="pill-lime" style={{ flex: 1, padding: "0 14px" }} onClick={buyAll}>
          Buy
        </button>
        <button
          className="pill-plum"
          style={{ flex: 1.4, padding: "0 14px", gap: 6 }}
          onClick={() => router.push("/m/restaurants")}
        >
          <MapPin width={17} height={17} />
          Dine-in
        </button>
      </div>
    </div>
  );
}
