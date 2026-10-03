/**
 * Lightweight client-side handoff for passing a selected recipe / restaurant
 * suggestion between mobile screens (e.g. chat card → /m/recipe → /m/buy)
 * without threading big objects through the URL. Uses sessionStorage so it
 * survives the navigation but not a fresh app launch.
 */

import type { Ingredient, RecipeData, RestaurantSuggestion } from "@/lib/types";

const RECIPE_KEY = "meshi_active_recipe";
const RESTAURANTS_KEY = "meshi_active_restaurants";
const BUY_LIST_KEY = "meshi_buy_list";

/**
 * What the user actually chose to buy, after deselecting pantry staples on
 * /m/buy. Without this the platform screen re-derived the list from the whole
 * recipe, so skipping "butter" still put butter in the search query and the
 * estimate — the pre-check's entire purpose, silently discarded.
 */
export interface BuyList {
  recipeName: string;
  items: Ingredient[];
}

export function setBuyList(list: BuyList): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(BUY_LIST_KEY, JSON.stringify(list));
  } catch {
    /* quota / disabled — non-fatal */
  }
}

export function getBuyList(): BuyList | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BUY_LIST_KEY);
    return raw ? (JSON.parse(raw) as BuyList) : null;
  } catch {
    return null;
  }
}

export function setActiveRecipe(recipe: RecipeData): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RECIPE_KEY, JSON.stringify(recipe));
  } catch {
    /* quota / disabled — non-fatal */
  }
}

export function getActiveRecipe(): RecipeData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RECIPE_KEY);
    return raw ? (JSON.parse(raw) as RecipeData) : null;
  } catch {
    return null;
  }
}

export function setActiveRestaurants(sugg: RestaurantSuggestion): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RESTAURANTS_KEY, JSON.stringify(sugg));
  } catch {
    /* non-fatal */
  }
}

export function getActiveRestaurants(): RestaurantSuggestion | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RESTAURANTS_KEY);
    return raw ? (JSON.parse(raw) as RestaurantSuggestion) : null;
  } catch {
    return null;
  }
}
