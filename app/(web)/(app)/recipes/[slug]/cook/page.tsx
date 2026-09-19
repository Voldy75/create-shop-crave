"use client";

/**
 * /recipes/[slug]/cook — the cooking view, built to artboard w9b.
 *
 * WHAT w9b DRAWS THAT IS NOT BUILT:
 *  - The rail's "Quinoa timer · 12:00" and "Hands-free mode · Start" rows.
 *    There is no timer and no voice capability anywhere in this product;
 *    rendering them would be two dead controls, the class of defect that drew
 *    an App Store rejection once already.
 *  - Pantry state sourced from "Bo checked Tuesday's Instamart order and your
 *    saved staples." There is no order history and no pantry table. Pantry
 *    status here is lib/pantry.ts's KEYWORD HEURISTIC — the same one /cart and
 *    /m/buy use — so the banner says it is a guess and every row stays
 *    togglable. Do not reword that copy into a claim about order history.
 *
 * SERVINGS SCALING moves quantity, per-row price AND the total together. If you
 * touch one, touch all three or the screen contradicts itself — the mobile
 * recipe screen learned this. Quantity scaling is anchored at the START of the
 * string so "a pinch" and "to taste" pass through untouched.
 */

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Check, ChefHat, Flame, Minus, Plus, ShoppingBag } from "lucide-react";
import { AppTopbar } from "@/components/web/AppTopbar";
import { ShareButton } from "@/components/ShareButton";
import { resolveRecipeBySlug } from "@/lib/recipe-slug";
import { saveFavorite, removeFavorite, getFavorites } from "@/lib/storage";
import { setActiveRecipe, setBuyList } from "@/lib/mobile-handoff";
import { looksPantry } from "@/lib/pantry";
import { foodImage } from "@/lib/food-images";
import { parseNumeric } from "@/lib/nutrition";
import { mascotComponentFor } from "@/lib/ingredient-mascot";
import type { Ingredient, RecipeData } from "@/lib/types";

type Tab = "ingredients" | "instructions";

/**
 * Scale a free-text quantity. Only a leading number (incl. "1 1/2", "½", "0.5")
 * is touched; anything without one — "a pinch", "to taste" — is returned as-is.
 */
const VULGAR: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75 };

function scaleQuantity(q: string | undefined, factor: number): string | undefined {
  if (!q || factor === 1) return q;
  const trimmed = q.trim();

  const vulgarMatch = trimmed.match(/^([½⅓⅔¼¾])\s*(.*)$/);
  if (vulgarMatch) return `${fmt(VULGAR[vulgarMatch[1]] * factor)} ${vulgarMatch[2]}`.trim();

  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)\s*(.*)$/);
  if (mixed) {
    const value = (Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])) * factor;
    return `${fmt(value)} ${mixed[4]}`.trim();
  }

  const frac = trimmed.match(/^(\d+)\/(\d+)\s*(.*)$/);
  if (frac) return `${fmt((Number(frac[1]) / Number(frac[2])) * factor)} ${frac[3]}`.trim();

  const plain = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (plain) return `${fmt(Number(plain[1]) * factor)} ${plain[2]}`.trim();

  return q;
}

/** Add or drop a key, returning a NEW Set so React sees the change. */
function toggled<T>(prev: Set<T>, key: T): Set<T> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function fmt(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export default function CookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  const [recipe, setRecipe] = useState<RecipeData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>("ingredients");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [servings, setServings] = useState<number>(2);
  const [isSaved, setIsSaved] = useState(false);
  const [favId, setFavId] = useState<string | null>(null);
  /** Rows the user says they already own — seeded from the pantry heuristic. */
  const [have, setHave] = useState<Set<string>>(new Set());

  useEffect(() => {
    // session/localStorage read after mount — cannot run during SSR. Same
    // scoped disable and same reason as /cart's hydration effect.
    /* eslint-disable react-hooks/set-state-in-effect */
    const found = resolveRecipeBySlug(slug);
    setRecipe(found);
    if (found) {
      setServings(found.servings && found.servings > 0 ? found.servings : 2);
      setHave(new Set(found.ingredients.filter((i) => looksPantry(i.item)).map((i) => i.item)));
      const match = getFavorites().find((f) => f.type === "recipe" && (f.data as RecipeData).name === found.name);
      if (match) { setIsSaved(true); setFavId(match.id); }
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [slug]);

  const baseServings = recipe?.servings && recipe.servings > 0 ? recipe.servings : 2;
  const factor = servings / baseServings;

  const scaled = useMemo<Ingredient[]>(
    () =>
      (recipe?.ingredients ?? []).map((i) => ({
        ...i,
        quantity: scaleQuantity(i.quantity, factor),
        price: String(Math.round(parseNumeric(i.price) * factor)),
      })),
    [recipe, factor]
  );

  const missing = useMemo(() => scaled.filter((i) => !have.has(i.item)), [scaled, have]);
  const missingTotal = Math.round(missing.reduce((s, i) => s + parseNumeric(i.price), 0));

  const toggleSave = () => {
    if (!recipe) return;
    if (isSaved && favId) {
      removeFavorite(favId);
      setIsSaved(false);
      setFavId(null);
      return;
    }
    saveFavorite("recipe", recipe);
    const match = getFavorites().find((f) => f.type === "recipe" && (f.data as RecipeData).name === recipe.name);
    if (match) { setIsSaved(true); setFavId(match.id); }
  };

  const buyMissing = () => {
    if (!recipe) return;
    // Only the rows the user does NOT already have. Sending everything would
    // make the pantry check decorative — the exact BuyList trap /cart warns of.
    setActiveRecipe(recipe);
    setBuyList({ recipeName: recipe.name, items: missing });
    router.push("/cart");
  };

  if (hydrated && !recipe) {
    return (
      <>
        <AppTopbar title="Recipe not found" onBack="/recipes" />
        <main className="mbody">
          <div className="card vstack" style={{ margin: "40px auto", maxWidth: 520, padding: 34, gap: 13, alignItems: "center", textAlign: "center" }}>
            <ChefHat width={28} height={28} style={{ color: "var(--m-forest)" }} aria-hidden />
            <span className="t-d2">We don&rsquo;t have this one</span>
            {/* Honest about WHY, because it is a real property of the design:
                recipes live in this browser, not on a server. */}
            <span className="t-body-soft">
              Recipes live on the device they were saved on, so a link from another
              browser won&rsquo;t open. Ask Bo for it again, or pick one off your shelf.
            </span>
            <div className="hstack" style={{ gap: 9 }}>
              <Link href="/recipes" className="pill-secondary pill-sm" style={{ textDecoration: "none" }}>Your shelf</Link>
              <Link href="/chat" className="pill-primary pill-sm" style={{ textDecoration: "none" }}>Ask Bo</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!recipe) return <main className="mbody" />;

  const img = foodImage(recipe.name);
  const mins = recipe.prepTime?.match(/\d+/)?.[0];
  const kcalEach = recipe.nutritionEstimate?.calories
    ? Math.round(parseNumeric(recipe.nutritionEstimate.calories))
    : null;

  return (
    <>
      <AppTopbar title={recipe.name} onBack="/recipes">
        <button className="chip pill-sm" onClick={toggleSave} aria-pressed={isSaved}>
          <Bookmark width={14} height={14} fill={isSaved ? "currentColor" : "none"} aria-hidden />
          {isSaved ? "Saved" : "Save"}
        </button>
        <ShareButton title={recipe.name} text={recipe.description} />
      </AppTopbar>

      <div className="cook-page">
        <main className="mbody cook-main">
          {/* ── Tabs (w9b's .utabs) ── */}
          <div className="utabs" style={{ margin: "0 -32px 22px", position: "sticky", top: 0, zIndex: 2 }}>
            <button className={`utab${tab === "ingredients" ? " is-active" : ""}`} onClick={() => setTab("ingredients")} aria-pressed={tab === "ingredients"}>
              <ShoppingBag width={16} height={16} aria-hidden /> Ingredients
            </button>
            <button className={`utab${tab === "instructions" ? " is-active" : ""}`} onClick={() => setTab("instructions")} aria-pressed={tab === "instructions"}>
              <ChefHat width={16} height={16} aria-hidden /> Instructions
            </button>
          </div>

          {tab === "ingredients" && (
            <div className="vstack" style={{ gap: 16 }}>
              <div className="hstack" style={{ gap: 12, flexWrap: "wrap" }}>
                <span className="t-d2 grow">Full ingredient list</span>
                <div className="hstack" style={{ gap: 8 }}>
                  <span className="t-cap">Serves</span>
                  <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Fewer servings">
                    <Minus width={15} height={15} />
                  </button>
                  <span className="t-h2" style={{ minWidth: 18, textAlign: "center" }} aria-live="polite">{servings}</span>
                  <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setServings((s) => Math.min(12, s + 1))} aria-label="More servings">
                    <Plus width={15} height={15} />
                  </button>
                </div>
              </div>

              <div className="vstack" style={{ gap: 8 }}>
                {scaled.map((ing) => {
                  const Mascot = mascotComponentFor(ing.item);
                  const isChecked = checked.has(ing.item);
                  const owned = have.has(ing.item);
                  return (
                    <div key={ing.item} className={`ingr${isChecked ? " is-checked" : ""}`}>
                      <button
                        onClick={() => setChecked((prev) => toggled(prev, ing.item))}
                        className="hstack grow"
                        style={{ gap: 12, background: "none", border: "none", cursor: "pointer", textAlign: "left", minWidth: 0 }}
                        aria-pressed={isChecked}
                        aria-label={`${isChecked ? "Uncheck" : "Check"} ${ing.item}`}
                      >
                        <span className="ingbox" aria-hidden><Check width={13} height={13} strokeWidth={3.4} /></span>
                        <Mascot width={26} height={26} style={{ flex: "none" }} aria-hidden />
                        <span className="t-body ingt grow" style={{ minWidth: 0 }}>
                          {ing.quantity ? `${ing.quantity} ` : ""}{ing.item}
                        </span>
                      </button>
                      {/* The pantry call is a GUESS, so it is a control, not a
                          label — the user is the authority on their own kitchen. */}
                      <button
                        onClick={() => setHave((prev) => toggled(prev, ing.item))}
                        className="t-cap"
                        style={{ background: "none", border: "none", cursor: "pointer", flex: "none", color: owned ? "var(--m-ink-soft)" : "var(--m-burnt)" }}
                        aria-pressed={owned}
                        aria-label={owned ? `Mark ${ing.item} as needed` : `Mark ${ing.item} as already in your kitchen`}
                      >
                        {owned ? "in kitchen" : `need · ₹${Math.round(parseNumeric(ing.price))}`}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="card tint-green hstack" style={{ boxShadow: "none", padding: 16, gap: 13, flexWrap: "wrap" }}>
                <div className="vstack grow" style={{ gap: 2, minWidth: 0 }}>
                  <span className="t-h2">
                    {missing.length === 0 ? "You have everything" : `${missing.length} to pick up`}
                  </span>
                  {/* Deliberately worded as a guess. See the header note. */}
                  <span className="t-cap">
                    {missing.length === 0
                      ? "Nothing to buy for this one."
                      : "Bo guessed your staples from the ingredient names — tap any row to correct it."}
                  </span>
                </div>
                {missing.length > 0 && (
                  <button className="pill-lime pill-sm" onClick={buyMissing}>
                    Add {missing.length} to cart · ₹{missingTotal}
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === "instructions" && (
            <div className="vstack" style={{ gap: 18 }}>
              <div className="hstack" style={{ gap: 11, flexWrap: "wrap" }}>
                <span className="t-d2 grow">Preparation</span>
                {mins && <span className="chip pill-sm">{mins} min total</span>}
                <span className="t-cap">Tap a step to tick it off</span>
              </div>
              <div className="vstack" style={{ gap: 0 }}>
                {recipe.instructions.map((step, i) => {
                  const done = doneSteps.has(i);
                  return (
                    <button
                      key={i}
                      className={`stp${done ? " is-done" : ""}`}
                      onClick={() => setDoneSteps((prev) => toggled(prev, i))}
                      style={{ background: "none", textAlign: "left", width: "100%" }}
                      aria-pressed={done}
                    >
                      <span className="stpn" aria-hidden>
                        <span className="stpnum">{i + 1}</span>
                        <Check className="stpck" width={15} height={15} strokeWidth={3.2} />
                      </span>
                      <span className="t-body stpt">{step}</span>
                    </button>
                  );
                })}
              </div>
              {recipe.description && (
                <div className="vstack" style={{ gap: 7, maxWidth: 640 }}>
                  <span className="t-d2">About this recipe</span>
                  <span className="t-body-soft">{recipe.description}</span>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Rail (w9b), minus the timer and hands-free rows ── */}
        <aside className="rail cook-rail">
          <div style={{ position: "relative", height: 200, borderRadius: 20, overflow: "hidden", flex: "none" }}>
            {img ? (
              <div className="imgfill" style={{ position: "absolute", inset: 0, backgroundImage: `url('${img}')` }} aria-hidden />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: "var(--m-tint-green)" }} aria-hidden />
            )}
          </div>

          <span className="t-d2">{recipe.name}</span>
          <span className="t-cap">
            {mins ? `${mins} minutes · ` : ""}{recipe.ingredients.length} ingredients · serves {servings}
          </span>

          <div className="hstack" style={{ gap: 7, flexWrap: "wrap" }}>
            {kcalEach !== null && (
              <span className="chip pill-sm">
                <Flame width={13} height={13} style={{ color: "var(--m-burnt)" }} aria-hidden /> {kcalEach} kcal
              </span>
            )}
            {recipe.nutritionEstimate?.protein && <span className="chip pill-sm">{recipe.nutritionEstimate.protein} protein</span>}
            {(recipe.dietaryTags ?? []).slice(0, 2).map((t) => <span key={t} className="chip pill-sm">{t}</span>)}
          </div>

          {missing.length > 0 && (
            <button className="pill-lime" style={{ width: "100%" }} onClick={buyMissing}>
              Add missing {missing.length} to cart · ₹{missingTotal}
            </button>
          )}

          <div className="grow" />

          <div className="card tint-peach hstack" style={{ boxShadow: "none", padding: 15, gap: 11 }}>
            <ChefHat width={24} height={24} style={{ color: "var(--m-burnt)", flex: "none", animation: "mm-bob 3.3s ease-in-out infinite" }} aria-hidden />
            <div className="vstack" style={{ gap: 1, minWidth: 0 }}>
              <span className="t-h2" style={{ fontSize: 14 }}>Log it when you&rsquo;re done</span>
              <Link href="/planner?tab=tracker&log=1" className="t-cap" style={{ color: "var(--m-forest)" }}>
                Adds to today&rsquo;s tracker
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
