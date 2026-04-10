import type { RecipeData, Restaurant } from "./types";

// --- Favorites ---

export interface FavoriteItem {
  id: string;
  type: "recipe" | "restaurant";
  data: RecipeData | Restaurant;
  savedAt: string;
}

const FAVORITES_KEY = "crave_favorites";

export function getFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveFavorite(type: "recipe" | "restaurant", data: RecipeData | Restaurant): void {
  const favorites = getFavorites();
  const id = `${type}-${Date.now()}`;
  favorites.unshift({ id, type, data, savedAt: new Date().toISOString() });
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export function removeFavorite(id: string): void {
  const favorites = getFavorites().filter((f) => f.id !== id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export function isFavorited(type: "recipe" | "restaurant", name: string): boolean {
  return getFavorites().some(
    (f) => f.type === type && (f.data as { name: string }).name === name
  );
}

// --- Chat History ---

export interface ChatSession {
  id: string;
  title: string;
  messages: Array<{ role: string; content: string; id: string }>;
  createdAt: string;
  updatedAt: string;
}

const CHAT_SESSIONS_KEY = "crave_chatSessions";

export function getChatSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CHAT_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveChatSession(session: ChatSession): void {
  const sessions = getChatSessions().filter((s) => s.id !== session.id);
  sessions.unshift(session);
  // Keep only last 20 sessions
  const trimmed = sessions.slice(0, 20);
  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(trimmed));
}

export function deleteChatSession(id: string): void {
  const sessions = getChatSessions().filter((s) => s.id !== id);
  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
}

// --- Meal Plan ---

export interface MealSlot {
  dish: string;
  recipe?: RecipeData;
}

export interface DayPlan {
  breakfast?: MealSlot;
  lunch?: MealSlot;
  dinner?: MealSlot;
}

export type WeekPlan = Record<string, DayPlan>;

const MEAL_PLAN_KEY = "crave_mealPlan";

export function getMealPlan(): WeekPlan {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(MEAL_PLAN_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveMealPlan(plan: WeekPlan): void {
  localStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(plan));
}
