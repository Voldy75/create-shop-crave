/**
 * recipe-slug — stable URL identity for a recipe, and how /recipes/[slug]/cook
 * finds its data.
 *
 * There is NO recipe catalogue and no recipes table. A recipe exists in exactly
 * two places: the sessionStorage hand-off (lib/mobile-handoff's ActiveRecipe,
 * how a chat artifact reaches another route) and the saved shelf (lib/storage's
 * favorites, localStorage). So the slug is derived from the name rather than
 * being a database id, and resolution tries the hand-off first — it is the
 * fresher, more specific source — then falls back to the shelf.
 *
 * CONSEQUENCE, and it is deliberate: /recipes/<slug>/cook is not a durable
 * permalink. Open it in a new browser with nothing saved and there is no recipe
 * to show, which is why the cooking view has a real not-found state instead of
 * assuming data. Two saved recipes with the same name collide onto one slug;
 * the shelf lookup returns the most recently saved, which is the better guess.
 */

import type { RecipeData } from "./types";
import { getFavorites } from "./storage";
import { getActiveRecipe } from "./mobile-handoff";

export function recipeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      // Strip accents so "sauté" and "saute" produce the same slug.
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "recipe"
  );
}

/** Every saved recipe, newest first. */
export function savedRecipes(): Array<{ id: string; savedAt: string; recipe: RecipeData }> {
  return getFavorites()
    .filter((f) => f.type === "recipe")
    .map((f) => ({ id: f.id, savedAt: f.savedAt, recipe: f.data as RecipeData }));
}

/**
 * Resolve a slug to a recipe. Hand-off first (it is what a "Start cooking"
 * click just wrote), then the saved shelf.
 */
export function resolveRecipeBySlug(slug: string): RecipeData | null {
  const active = getActiveRecipe();
  if (active && recipeSlug(active.name) === slug) return active;

  const match = savedRecipes().find((r) => recipeSlug(r.recipe.name) === slug);
  return match ? match.recipe : null;
}
