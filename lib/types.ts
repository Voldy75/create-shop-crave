export interface ShoppingLink {
  platform: "blinkit" | "swiggy_instamart" | "instacart";
  label: string;
  url: string;
}

export interface Ingredient {
  item: string;
  quantity?: string;
  price: string;
  links?: ShoppingLink[];
  link?: string; // backward compat with old single-link format
}

export interface NutritionEstimate {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

export interface RecipeData {
  name: string;
  description: string;
  prepTime?: string;
  servings?: number;
  dietaryTags?: string[];
  ingredients: Ingredient[];
  instructions: string[];
  nutritionEstimate?: NutritionEstimate;
}

export interface Restaurant {
  name: string;
  rating: string;
  priceRange: string;
  area: string;
  cuisine?: string;
  lat?: number;
  lng?: number;
  zomatoUrl: string;
  swiggyUrl: string;
}

export interface RestaurantSuggestion {
  query: string;
  reason: string;
  dishName?: string;
  restaurants?: Restaurant[];
}

export interface ChatResponse {
  type: "recipe" | "restaurant" | "both" | "clarification";
  recipe?: RecipeData;
  restaurantSuggestion?: RestaurantSuggestion;
}
