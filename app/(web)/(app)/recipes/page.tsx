"use client";

/**
 * /recipes — the saved shelf, built to artboard w9a.
 *
 * WHAT w9a DRAWS THAT IS NOT BUILT, and why. This is the same call /cart made
 * against w4a: take the artboard's LAYOUT, refuse its invented data.
 *
 *  - "This week on meshi · Fast and forgiving: monsoon dinners" over a hero and
 *    a 2x2 grid of EDITORIAL picks. There is no recipe catalogue, no editorial
 *    feed and no seasonal collection anywhere in this product — recipes exist
 *    only as chat artifacts the user saved. So the hero and grid are filled
 *    from the user's OWN shelf, newest first, and the header says so.
 *  - "Show 24 more monsoon recipes". Nothing to page through.
 *  - The four Collections cards ("20-minute dinners / 38 recipes", …). No
 *    collections data model and no counts to put in one — the same reason the
 *    mobile saved screen dropped its Collections chip.
 *  - Per-tile relations like "cooked twice" and "in Monday's plan". Nothing
 *    tracks a cook count. "in Monday's plan" IS derivable from the meal plan,
 *    but only for planned dishes, so it renders only when genuinely true.
 *
 * Item 4's "history of dishes favourited or saved during chat conversations" is
 * exactly this data: components/FavoriteButton.tsx (rendered by RecipeView
 * inside chat) already writes to lib/storage's favorites. This page is the
 * missing surface for it, not a new store.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChefHat, Flame, Search, ShoppingBag } from "lucide-react";
import { AppTopbar } from "@/components/web/AppTopbar";
import { savedRecipes, recipeSlug } from "@/lib/recipe-slug";
import { removeFavorite, getMealPlan } from "@/lib/storage";
import { setActiveRecipe, setBuyList } from "@/lib/mobile-handoff";
import { foodImage } from "@/lib/food-images";
import { parseNumeric } from "@/lib/nutrition";
import { mascotComponentFor, tileTint } from "@/lib/ingredient-mascot";
import type { RecipeData } from "@/lib/types";

interface Row {
  id: string;
  savedAt: string;
  recipe: RecipeData;
}

/** Which weekday, if any, this dish is planned for — real data or nothing. */
function plannedDay(name: string): string | null {
  const plan = getMealPlan();
  for (const [day, slots] of Object.entries(plan)) {
    for (const slot of Object.values(slots ?? {})) {
      if (slot?.dish && slot.dish.toLowerCase() === name.toLowerCase()) return day;
    }
  }
  return null;
}

function savedLabel(savedAt: string, name: string): string {
  const planned = plannedDay(name);
  const t = Date.parse(savedAt);
  const when = Number.isNaN(t)
    ? "Saved"
    : `Saved ${new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  return planned ? `${when} · in ${planned}'s plan` : when;
}

function estTotal(recipe: RecipeData): number {
  return Math.round(recipe.ingredients.reduce((s, i) => s + parseNumeric(i.price), 0));
}

function minutesOf(recipe: RecipeData): string | null {
  return recipe.prepTime?.match(/\d+/)?.[0] ?? null;
}

export default function RecipesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setRows(savedRecipes());
    setHydrated(true);
  }, []);

  useEffect(() => {
    // localStorage read after mount — cannot run during SSR. Same scoped
    // disable and same reason as /cart's hydration effect. `load` is reused on
    // unsave, which is why it is a callback rather than inlined here.
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.recipe.name.toLowerCase().includes(needle) ||
        (r.recipe.dietaryTags ?? []).some((t) => t.toLowerCase().includes(needle))
    );
  }, [rows, q]);

  const hero = filtered[0];
  const grid = filtered.slice(1, 5);
  const shelf = filtered;

  const unsave = (id: string) => { removeFavorite(id); load(); };

  const startCooking = (recipe: RecipeData) => {
    // Hand off through sessionStorage so the cooking view has the full recipe
    // even when it was never saved — resolveRecipeBySlug checks this first.
    setActiveRecipe(recipe);
    router.push(`/recipes/${recipeSlug(recipe.name)}/cook`);
  };

  const buyIngredients = (recipe: RecipeData) => {
    // Same handoff RecipeView uses, so the pantry pre-check on /cart runs
    // before anything reaches a store.
    setActiveRecipe(recipe);
    setBuyList({ recipeName: recipe.name, items: recipe.ingredients });
    router.push("/cart");
  };

  return (
    <>
      <AppTopbar
        title="Recipes"
        caption={
          hydrated && rows.length > 0
            ? `${rows.length} saved · from your chats with Bo`
            : "Saved from your chats with Bo"
        }
      >
        <div className="input" style={{ height: 40, width: 280, maxWidth: "100%" }}>
          <Search width={16} height={16} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipes…"
            className="grow"
            style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", minWidth: 0 }}
            aria-label="Search saved recipes"
          />
        </div>
      </AppTopbar>

      <main className="mbody">
        <div className="vstack" style={{ gap: 26, padding: "26px 32px 40px", maxWidth: 1180, margin: "0 auto", width: "100%" }}>
          {!hydrated && <span className="t-cap">Loading your shelf…</span>}

          {hydrated && rows.length === 0 && (
            <div className="card vstack" style={{ padding: "46px 30px", gap: 14, alignItems: "center", textAlign: "center" }}>
              <ChefHat width={30} height={30} style={{ color: "var(--m-forest)" }} aria-hidden />
              <span className="t-d2">No saved recipes yet</span>
              <span className="t-body-soft" style={{ maxWidth: 420 }}>
                Ask Bo for something to cook, then tap the heart on a recipe to keep it here.
              </span>
              <Link href="/chat" className="pill-primary" style={{ textDecoration: "none" }}>
                Ask Bo for a recipe
              </Link>
            </div>
          )}

          {hydrated && rows.length > 0 && filtered.length === 0 && (
            <div className="card" style={{ padding: 30, textAlign: "center" }}>
              <span className="t-body-soft">Nothing on your shelf matches &ldquo;{q.trim()}&rdquo;.</span>
            </div>
          )}

          {/* ── Header. w9a centres an editorial eyebrow + headline; this says
              what the screen actually is. ── */}
          {hydrated && filtered.length > 0 && (
            <div className="vstack" style={{ gap: 7, alignItems: "center", textAlign: "center" }}>
              <span className="t-micro" style={{ color: "var(--m-burnt)" }}>Your shelf</span>
              <span className="t-d1" style={{ fontSize: 32 }}>
                {filtered.length === 1 ? "One recipe worth keeping" : `${filtered.length} recipes worth keeping`}
              </span>
            </div>
          )}

          {/* ── Hero + 2x2, w9a's proportions (1.35fr / 1fr) ── */}
          {hero && (
            <div className="recipes-hero-grid">
              <HeroCard
                row={hero}
                onUnsave={() => unsave(hero.id)}
                onCook={() => startCooking(hero.recipe)}
                onBuy={() => buyIngredients(hero.recipe)}
              />
              {grid.length > 0 && (
                <div className="recipes-mini-grid">
                  {grid.map((r) => (
                    <MiniCard key={r.id} row={r} onUnsave={() => unsave(r.id)} onCook={() => startCooking(r.recipe)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Saved shelf. Kept even when it repeats the cards above: it is
              the complete list and the only place the older entries appear. ── */}
          {shelf.length > 0 && (
            <div className="card vstack" style={{ padding: 22, gap: 16 }}>
              <div className="hstack" style={{ gap: 11, flexWrap: "wrap" }}>
                <Bookmark width={19} height={19} style={{ color: "var(--m-forest)" }} aria-hidden />
                <span className="t-d2">Saved recipes</span>
                <span className="chip pill-sm">{shelf.length} saved</span>
                <div className="grow" />
                <span className="t-cap">On this device · tap a heart in chat to add</span>
              </div>
              <div className="recipes-shelf">
                {shelf.map((r, i) => {
                  const Mascot = mascotComponentFor(r.recipe.name);
                  return (
                    <button
                      key={r.id}
                      className="din-lift"
                      onClick={() => startCooking(r.recipe)}
                      style={{
                        flexDirection: "column", alignItems: "flex-start", gap: 8,
                        background: "var(--m-cream-2)", border: "none", borderRadius: 16,
                        padding: 13, cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 42, height: 42, borderRadius: 12, background: tileTint(i),
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        aria-hidden
                      >
                        <Mascot width={28} height={28} />
                      </span>
                      <span className="t-h2" style={{ fontSize: 14 }}>{r.recipe.name}</span>
                      <span className="t-cap" style={{ fontSize: 11.5 }}>{savedLabel(r.savedAt, r.recipe.name)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function HeroCard({ row, onUnsave, onCook, onBuy }: { row: Row; onUnsave: () => void; onCook: () => void; onBuy: () => void }) {
  const { recipe } = row;
  const img = foodImage(recipe.name);
  const mins = minutesOf(recipe);
  const kcal = recipe.nutritionEstimate?.calories ? Math.round(parseNumeric(recipe.nutritionEstimate.calories)) : null;

  return (
    <div className="card din-lift" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", height: 300, flex: "none" }}>
        {img ? (
          <div className="imgfill din-zoom" style={{ position: "absolute", inset: 0, backgroundImage: `url('${img}')` }} aria-hidden />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "var(--m-tint-green)" }} aria-hidden />
        )}
        <button className="bkw is-saved" onClick={onUnsave} aria-label={`Remove ${recipe.name} from saved`} title="Remove from saved">
          <Bookmark width={16} height={16} fill="currentColor" />
        </button>
      </div>
      <div className="vstack" style={{ gap: 13, padding: 20 }}>
        <span className="t-h1" style={{ fontSize: 23 }}>{recipe.name}</span>
        <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
          {mins && <span className="chip pill-sm">{mins} min</span>}
          <span className="chip pill-sm">{recipe.ingredients.length} ingredients</span>
          {kcal !== null && (
            <span className="chip pill-sm">
              <Flame width={14} height={14} style={{ color: "var(--m-burnt)" }} aria-hidden /> {kcal} kcal
            </span>
          )}
        </div>
        <div className="hstack" style={{ gap: 9, flexWrap: "wrap" }}>
          <button className="pill-primary pill-sm" onClick={onCook}>Start cooking</button>
          <button className="pill-lime pill-sm" onClick={onBuy}>
            <ShoppingBag width={15} height={15} aria-hidden /> Buy ingredients · ₹{estTotal(recipe)}
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ row, onUnsave, onCook }: { row: Row; onUnsave: () => void; onCook: () => void }) {
  const { recipe } = row;
  const img = foodImage(recipe.name);
  const mins = minutesOf(recipe);

  return (
    <div className="card din-lift" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", height: 130, flex: "none" }}>
        {img ? (
          <div className="imgfill din-zoom" style={{ position: "absolute", inset: 0, backgroundImage: `url('${img}')` }} aria-hidden />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "var(--m-tint-lav)" }} aria-hidden />
        )}
        <button className="bkw is-saved" onClick={onUnsave} aria-label={`Remove ${recipe.name} from saved`} title="Remove from saved">
          <Bookmark width={15} height={15} fill="currentColor" />
        </button>
      </div>
      <button
        onClick={onCook}
        className="vstack grow"
        style={{ gap: 4, padding: 14, background: "none", border: "none", textAlign: "left", cursor: "pointer", alignItems: "flex-start" }}
      >
        <span className="t-h2" style={{ fontSize: 15 }}>{recipe.name}</span>
        <span className="t-cap">
          {mins ? `${mins} min · ` : ""}{recipe.ingredients.length} ingredients
        </span>
      </button>
    </div>
  );
}
