/**
 * Client helper for the batch-ingredients flow.
 *
 * Coach returns dish names + macros. This module fetches ingredient
 * lists for those dishes from /api/ingredients and wires up the
 * Blinkit / Swiggy Instamart / Instacart deeplinks locally.
 *
 * Returns a Map<dishName, Ingredient[]> the caller can splice into
 * generated MealSlots.
 */

import { buildBlinkitLink, buildInstacartLink, buildSwiggyInstamartLink } from "@/lib/deeplinks";
import type { Ingredient, ShoppingLink } from "@/lib/types";

interface RawDish {
  dish: string;
  ingredients: Array<{
    item: string;
    quantity?: string;
    price: string;
  }>;
}

interface BatchResponse {
  dishes: RawDish[];
  byok?: boolean;
  error?: string;
  message?: string;
}

function linksFor(item: string): ShoppingLink[] {
  return [
    { platform: "blinkit", label: "Blinkit", url: buildBlinkitLink(item) },
    { platform: "swiggy_instamart", label: "Swiggy Instamart", url: buildSwiggyInstamartLink(item) },
    { platform: "instacart", label: "Instacart", url: buildInstacartLink(item) },
  ];
}

export interface FetchIngredientsResult {
  /** Map keyed by dish name (case-insensitive comparison) */
  byDish: Map<string, Ingredient[]>;
  /** True if every requested dish came back with ingredients. */
  complete: boolean;
}

export class IngredientsFetchError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Fetches ingredient lists for a batch of dish names. Throws IngredientsFetchError
 * on rate-limit, auth, or network failure. The caller should fall back to
 * applying the plan with synthetic recipes.
 */
export async function fetchBatchIngredients(
  dishes: string[],
  dietaryPreferences?: string[],
  opts?: { signal?: AbortSignal },
): Promise<FetchIngredientsResult> {
  const unique = Array.from(new Set(dishes.map((d) => d.trim()).filter(Boolean)));
  if (unique.length === 0) return { byDish: new Map(), complete: true };

  const res = await fetch("/api/ingredients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dishes: unique, dietaryPreferences }),
    signal: opts?.signal,
  });
  const data = (await res.json().catch(() => ({}))) as BatchResponse;
  if (!res.ok) {
    throw new IngredientsFetchError(
      data.message || data.error || "Ingredients fetch failed",
      data.error,
    );
  }

  const byDish = new Map<string, Ingredient[]>();
  for (const d of data.dishes ?? []) {
    const ingredients: Ingredient[] = d.ingredients.map((i) => ({
      item: i.item,
      quantity: i.quantity,
      price: i.price,
      links: linksFor(i.item),
    }));
    byDish.set(d.dish.toLowerCase(), ingredients);
  }

  const complete = unique.every((d) => byDish.has(d.toLowerCase()));
  return { byDish, complete };
}

/** Look up ingredients case-insensitively. */
export function lookupIngredients(map: Map<string, Ingredient[]>, dishName: string): Ingredient[] | undefined {
  return map.get(dishName.toLowerCase());
}
