"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Share2, Heart, ShoppingCart } from "lucide-react";
import { getActiveRecipe, setActiveRecipe } from "@/lib/mobile-handoff";
import { parseNumeric } from "@/lib/nutrition";
import { buildBlinkitLink } from "@/lib/deeplinks";
import type { RecipeData } from "@/lib/types";

/**
 * meshi Recipe — editorial layout from v2-screens ScreenRecipeEditorial.
 * Full-bleed saffron hero, stats strip, ingredient list with est. prices,
 * numbered steps, sticky buy bar. Reads the recipe handed off from chat
 * (sessionStorage); falls back to a sample on direct visits.
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

export default function MobileRecipe() {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeData | null>(null);

  useEffect(() => {
    setRecipe(getActiveRecipe() ?? SAMPLE);
  }, []);

  if (!recipe) return <div style={{ minHeight: "100dvh", background: "var(--cc-bg)" }} />;

  const estTotal = recipe.ingredients.reduce((s, i) => s + parseNumeric(i.price), 0);
  const stats = [
    recipe.prepTime ? { t: recipe.prepTime.replace(/[^\d]/g, "") || recipe.prepTime, s: "min" } : null,
    recipe.servings ? { t: String(recipe.servings), s: "servings" } : null,
    recipe.nutritionEstimate?.calories ? { t: String(parseNumeric(recipe.nutritionEstimate.calories)), s: "cal" } : null,
    recipe.nutritionEstimate?.protein ? { t: recipe.nutritionEstimate.protein, s: "protein" } : null,
  ].filter(Boolean) as { t: string; s: string }[];

  const buyAll = () => {
    setActiveRecipe(recipe);
    router.push("/m/buy");
  };

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)", position: "relative" }}>
      <div className="scroll" style={{ flex: 1, paddingBottom: 96 }}>
        {/* Hero */}
        <div className="ph ph-saffron" style={{ height: 260, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 50%, rgba(0,0,0,0.8) 100%)" }} />
          <div className="row" style={{ position: "absolute", top: "calc(env(safe-area-inset-top,12px) + 6px)", left: 12, right: 12, justifyContent: "space-between" }}>
            <button onClick={() => router.back()} style={iconBtn} aria-label="Back"><ChevronLeft width={20} height={20} /></button>
            <div className="row" style={{ gap: 6 }}>
              <button style={iconBtn} aria-label="Share"><Share2 width={16} height={16} /></button>
              <button style={iconBtn} aria-label="Save"><Heart width={16} height={16} /></button>
            </div>
          </div>
          <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, color: "#fff" }}>
            {recipe.dietaryTags && recipe.dietaryTags.length > 0 && (
              <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {recipe.dietaryTags.slice(0, 3).map((t) => (
                  <span key={t} className="chip" style={{ background: "rgba(255,255,255,0.18)", borderColor: "transparent", color: "#fff", fontSize: 10, textTransform: "capitalize" }}>{t}</span>
                ))}
              </div>
            )}
            <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.022em", lineHeight: 1.05 }}>{recipe.name}</h1>
            {recipe.description && <p style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>{recipe.description}</p>}
          </div>
        </div>

        {/* Stats */}
        {stats.length > 0 && (
          <div className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--cc-line)", justifyContent: "space-between" }}>
            {stats.map((s) => (
              <div key={s.s} className="col" style={{ alignItems: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.015em" }}>{s.t}</span>
                <span className="t-cap" style={{ fontSize: 9 }}>{s.s}</span>
              </div>
            ))}
          </div>
        )}

        {/* Ingredients */}
        <div style={{ padding: 18 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h2 className="t-h2">Ingredients</h2>
            <span className="t-small">{recipe.ingredients.length} items{estTotal > 0 ? ` · ₹${estTotal} est.` : ""}</span>
          </div>
          <div className="col" style={{ gap: 1, background: "var(--cc-line)", borderRadius: "var(--cc-r-md)", overflow: "hidden", border: "1px solid var(--cc-line)" }}>
            {recipe.ingredients.map((ing) => (
              <div key={ing.item} className="row" style={{ padding: "12px 14px", background: "var(--cc-surf-1)", gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid var(--cc-line-2)", flexShrink: 0 }} />
                <div className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{ing.item}</span>
                  {ing.quantity && <span className="t-small">{ing.quantity}</span>}
                </div>
                {ing.price && <span style={{ fontSize: 13, color: "var(--cc-ink-2)" }}>{ing.price}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        {recipe.instructions.length > 0 && (
          <div style={{ padding: "0 18px 24px" }}>
            <h2 className="t-h2" style={{ marginBottom: 14 }}>Steps</h2>
            <div className="col" style={{ gap: 14 }}>
              {recipe.instructions.map((s, i) => (
                <div key={i} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--cc-acc-soft)", color: "var(--cc-acc)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
                  <p className="t-body" style={{ flex: 1, lineHeight: 1.5 }}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky buy bar */}
      <div style={{ position: "fixed", left: 12, right: 12, bottom: "calc(14px + env(safe-area-inset-bottom,0px))", maxWidth: 496, margin: "0 auto", background: "#000", borderRadius: "var(--cc-r-pill)", padding: 6, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 14px 40px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="row" style={{ padding: "0 14px", gap: 8, flex: 1 }}>
          <ShoppingCart width={18} height={18} style={{ color: "var(--cc-acc)" }} />
          <div className="col" style={{ gap: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Buy ingredients</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{estTotal > 0 ? `~₹${estTotal} · pantry pre-check` : "pantry pre-check"}</span>
          </div>
        </div>
        <button onClick={buyAll} style={{ background: "var(--cc-acc)", color: "#fff", border: "none", borderRadius: "var(--cc-r-pill)", padding: "10px 18px", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>Review</button>
        <a href={buildBlinkitLink(recipe.name + " ingredients")} target="_blank" rel="noopener noreferrer" style={{ display: "none" }} aria-hidden />
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "none",
  background: "rgba(0,0,0,0.5)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  backdropFilter: "blur(8px)",
};
