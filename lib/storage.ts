import type { MealLog, NutritionGoals, RecipeData, Restaurant } from "./types";

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

// --- Meal Plan ---

export interface MealSlot {
  dish: string;
  recipe?: RecipeData;
}

export interface DayPlan {
  breakfast?: MealSlot;
  lunch?: MealSlot;
  dinner?: MealSlot;
  snack?: MealSlot;
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

// --- Meal Log (tracker) ---

const MEAL_LOGS_KEY = "crave_mealLogs";

function readMealLogs(): MealLog[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(MEAL_LOGS_KEY);
    return stored ? (JSON.parse(stored) as MealLog[]) : [];
  } catch {
    return [];
  }
}

function writeMealLogs(logs: MealLog[]): void {
  try {
    localStorage.setItem(MEAL_LOGS_KEY, JSON.stringify(logs));
  } catch {
    // QuotaExceededError — base64 thumbnails are the heaviest field. Retry
    // without them so the log itself still persists.
    const stripped = logs.map((l) => {
      const copy: MealLog = { ...l };
      delete copy.imageDataUrl;
      return copy;
    });
    try {
      localStorage.setItem(MEAL_LOGS_KEY, JSON.stringify(stripped));
    } catch {
      // Still full — drop oldest entries until it fits.
      const trimmed = stripped.slice(0, Math.max(20, Math.floor(stripped.length / 2)));
      try {
        localStorage.setItem(MEAL_LOGS_KEY, JSON.stringify(trimmed));
      } catch {
        // Give up rather than crash the UI.
      }
    }
  }
}

export function getMealLogs(fromDate?: string, toDate?: string): MealLog[] {
  const logs = readMealLogs();
  if (!fromDate && !toDate) return logs;
  return logs.filter((l) => {
    if (fromDate && l.date < fromDate) return false;
    if (toDate && l.date > toDate) return false;
    return true;
  });
}

export function saveMealLog(log: Omit<MealLog, "id" | "loggedAt">): MealLog {
  const newLog: MealLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    loggedAt: new Date().toISOString(),
  };
  writeMealLogs([newLog, ...readMealLogs()]);
  return newLog;
}

export function updateMealLog(id: string, patch: Partial<MealLog>): void {
  const logs = readMealLogs().map((l) => (l.id === id ? { ...l, ...patch } : l));
  writeMealLogs(logs);
}

export function deleteMealLog(id: string): void {
  writeMealLogs(readMealLogs().filter((l) => l.id !== id));
}

// --- Nutrition Goals ---

const NUTRITION_GOALS_KEY = "crave_nutritionGoals";

export function getNutritionGoals(): NutritionGoals | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(NUTRITION_GOALS_KEY);
    return stored ? (JSON.parse(stored) as NutritionGoals) : null;
  } catch {
    return null;
  }
}

export function saveNutritionGoals(goals: NutritionGoals): void {
  localStorage.setItem(NUTRITION_GOALS_KEY, JSON.stringify(goals));
}

// --- Pending log handoff (chat → tracker) ---

export interface PendingMealLog {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "search";
  notes?: string;
}

const PENDING_LOG_KEY = "crave_pendingLog";

export function setPendingMealLog(p: PendingMealLog): void {
  localStorage.setItem(PENDING_LOG_KEY, JSON.stringify(p));
}

export function takePendingMealLog(): PendingMealLog | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(PENDING_LOG_KEY);
    if (!stored) return null;
    localStorage.removeItem(PENDING_LOG_KEY);
    return JSON.parse(stored) as PendingMealLog;
  } catch {
    return null;
  }
}
