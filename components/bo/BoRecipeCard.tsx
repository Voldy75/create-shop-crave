"use client";

/**
 * The recipe Bo chose to cook — rendered from the input of its
 * `meshi_cook__show_recipe` call (lib/bo/cook-tools.ts), so the card is the
 * recipe exactly as the model wrote it.
 *
 * Buttons: Start cooking (each tree's cook screen, via the shared hand-off),
 * Get the ingredients (asks Bo, which shops on Instamart behind the usual
 * Approval card) and Add to today's plan (the local planner, today's meal by
 * the clock). Shared by both root layouts: meshi-b classes and tokens only.
 */

import { useState } from "react";
import { Check, ChefHat, ShoppingBasket, Timer, Users, CalendarPlus } from "lucide-react";
import { getMealPlan, saveMealPlan } from "@/lib/storage";
import type { Ingredient, RecipeData } from "@/lib/types";

export interface CookActions {
  /** Open the cook screen for this recipe. */
  start: (recipe: RecipeData) => void;
  /** Send Bo a message as the user. */
  ask: (text: string) => void;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHOWN = 8;

function mealNow(): "breakfast" | "lunch" | "dinner" | "snack" {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

/** The tool input as a RecipeData, or null while it is still incomplete. */
export function recipeFromInput(input: unknown): RecipeData | null {
  const r = (input ?? {}) as Record<string, unknown>;
  if (typeof r.name !== "string" || !Array.isArray(r.ingredients) || !Array.isArray(r.instructions)) return null;
  const ingredients: Ingredient[] = r.ingredients
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object" && typeof (i as { item?: unknown }).item === "string")
    .map((i) => ({
      item: i.item as string,
      quantity: typeof i.quantity === "string" ? i.quantity : undefined,
      price: typeof i.price === "string" ? i.price : "",
    }));
  const n = r.nutritionEstimate as Record<string, unknown> | undefined;
  return {
    name: r.name,
    description: typeof r.description === "string" ? r.description : "",
    prepTime: typeof r.prepTime === "string" ? r.prepTime : undefined,
    servings: typeof r.servings === "number" ? r.servings : undefined,
    dietaryTags: Array.isArray(r.dietaryTags) ? r.dietaryTags.filter((t): t is string => typeof t === "string") : undefined,
    ingredients,
    instructions: r.instructions.filter((s): s is string => typeof s === "string"),
    nutritionEstimate:
      n && typeof n.calories === "string"
        ? { calories: n.calories, protein: String(n.protein ?? ""), carbs: String(n.carbs ?? ""), fat: String(n.fat ?? "") }
        : undefined,
  };
}

export function BoRecipeCard({ recipe, actions, busy }: { recipe: RecipeData; actions?: CookActions; busy: boolean }) {
  const [all, setAll] = useState(false);
  const [planned, setPlanned] = useState(false);
  const meal = mealNow();
  const shown = all ? recipe.ingredients : recipe.ingredients.slice(0, SHOWN);
  const more = recipe.ingredients.length - SHOWN;

  const addToPlan = () => {
    const day = DAYS[new Date().getDay()];
    const plan = getMealPlan();
    plan[day] = { ...plan[day], [meal]: { dish: recipe.name, recipe } };
    saveMealPlan(plan);
    setPlanned(true);
  };

  return (
    <section className="card vstack" aria-label={`Recipe: ${recipe.name}`} style={{ padding: "16px 18px", gap: 12, maxWidth: 560 }}>
      <div className="hstack" style={{ gap: 8 }}>
        <ChefHat width={16} height={16} aria-hidden style={{ color: "var(--figure-accent)", flex: "none" }} />
        <span className="t-micro">Cook it yourself</span>
      </div>
      <div className="vstack" style={{ gap: 4 }}>
        <h3 className="t-h2" style={{ margin: 0 }}>{recipe.name}</h3>
        {recipe.description && <p className="t-body-soft" style={{ margin: 0, fontSize: 14 }}>{recipe.description}</p>}
      </div>

      <div className="hstack t-cap" style={{ gap: 14, flexWrap: "wrap" }}>
        {recipe.prepTime && (
          <span className="hstack" style={{ gap: 4 }}><Timer width={14} height={14} aria-hidden /> {recipe.prepTime}</span>
        )}
        {recipe.servings ? (
          <span className="hstack" style={{ gap: 4 }}><Users width={14} height={14} aria-hidden /> Serves {recipe.servings}</span>
        ) : null}
        {recipe.nutritionEstimate && <span>≈ {recipe.nutritionEstimate.calories} · {recipe.nutritionEstimate.protein} protein / serving</span>}
        {recipe.dietaryTags?.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
      </div>

      <div className="vstack" style={{ gap: 6 }}>
        <span className="t-micro">You’ll need</span>
        <ul className="vstack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 4 }}>
          {shown.map((i, k) => (
            <li key={`${i.item}-${k}`} className="hstack t-body" style={{ gap: 8, fontSize: 14, alignItems: "baseline" }}>
              <span className="grow">{i.item}</span>
              {i.quantity && <span className="t-cap" style={{ flex: "none" }}>{i.quantity}</span>}
            </li>
          ))}
        </ul>
        {more > 0 && (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className="t-cap"
            aria-expanded={all}
            style={{ alignSelf: "flex-start", background: "none", border: "none", padding: "6px 0", minHeight: 32, cursor: "pointer", color: "var(--figure-accent)", fontWeight: 800 }}
          >
            {all ? "Show fewer" : `Show all ${recipe.ingredients.length}`}
          </button>
        )}
        <span className="t-cap">{recipe.instructions.length} steps</span>
      </div>

      {actions && (
        <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="pill-primary pill-sm" onClick={() => actions.start(recipe)}>
            <ChefHat width={15} height={15} aria-hidden /> Start cooking
          </button>
          <button
            type="button"
            className="pill-secondary pill-sm"
            disabled={busy}
            onClick={() => actions.ask(`Get the ingredients for ${recipe.name} on Instamart`)}
          >
            <ShoppingBasket width={15} height={15} aria-hidden /> Get ingredients
          </button>
          <button type="button" className="pill-secondary pill-sm" disabled={planned} onClick={addToPlan}>
            {planned ? <Check width={15} height={15} aria-hidden /> : <CalendarPlus width={15} height={15} aria-hidden />}
            {planned ? `Added to today’s ${meal}` : `Add to today’s ${meal}`}
          </button>
        </div>
      )}
    </section>
  );
}
