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

// --- Meal tracking ---

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type MealSource = "planned" | "search" | "manual" | "photo";

export interface MealLog {
  id: string;
  date: string;          // YYYY-MM-DD in user's local timezone
  mealType: MealType;
  source: MealSource;
  name: string;
  calories: number;
  protein: number;       // grams
  carbs: number;         // grams
  fat: number;           // grams
  imageDataUrl?: string; // optional thumbnail (base64); kept client-side only in Phase 1/2
  notes?: string;
  loggedAt: string;      // ISO timestamp
}

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type WeightGoal = "lose" | "maintain" | "gain";

export interface NutritionProfile {
  sex?: Sex;
  age?: number;          // years
  heightCm?: number;
  weightKg?: number;
  activity?: ActivityLevel;
  goal?: WeightGoal;
}

export interface NutritionGoals {
  dailyCalories: number;
  protein: number;       // grams
  carbs: number;         // grams
  fat: number;           // grams
  goal: WeightGoal;
  profile?: NutritionProfile;
}

// --- Notification subscriptions ---

export type WhatsAppStatus = "none" | "pending" | "active" | "revoked";

/** Wire shape of the notification_subscriptions table row. */
export interface NotificationSubscription {
  userId: string;
  webPushEnabled: boolean;
  webPushSubscription?: PushSubscriptionJSON | null;
  whatsappEnabled: boolean;
  phoneE164?: string | null;
  whatsappStatus: WhatsAppStatus;
  lastInboundAt?: string | null;
  updatedAt: string;
}

/** Standard PushSubscription serialized — subset we care about, matches browser shape. */
export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}
