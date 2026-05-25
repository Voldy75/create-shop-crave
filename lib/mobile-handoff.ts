/**
 * Lightweight client-side handoff for passing a selected recipe / restaurant
 * suggestion between mobile screens (e.g. chat card → /m/recipe → /m/buy)
 * without threading big objects through the URL. Uses sessionStorage so it
 * survives the navigation but not a fresh app launch.
 */

import type { RecipeData, RestaurantSuggestion } from "@/lib/types";

const RECIPE_KEY = "meshi_active_recipe";
const RESTAURANTS_KEY = "meshi_active_restaurants";

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
