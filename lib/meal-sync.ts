/**
 * Sync layer for meal_logs + nutrition_goals between localStorage and Supabase.
 *
 * Strategy: localStorage stays the read-source of truth on the client (zero-latency
 * UI). Writes hit localStorage first, then fire-and-forget to Supabase if signed in.
 * On sign-in, pull server state and merge by id (latest loggedAt wins per row).
 *
 * Anonymous users never call any of this. RLS does the actual access control.
 */

import { createClient } from "@/lib/supabase/client";
import type { MealLog, NutritionGoals } from "@/lib/types";

interface MealLogRow {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealLog["mealType"];
  source: MealLog["source"];
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  image_url: string | null;
  notes: string | null;
  logged_at: string;
}

function rowToLog(r: MealLogRow): MealLog {
  return {
    id: r.id,
    date: r.date,
    mealType: r.meal_type,
    source: r.source,
    name: r.name,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    // image_url is reserved for a future Supabase Storage move; we don't put
    // base64 thumbnails in Postgres. Server-side photos are not stored today.
    imageDataUrl: undefined,
    notes: r.notes ?? undefined,
    loggedAt: r.logged_at,
  };
}

function logToRow(userId: string, l: MealLog): Omit<MealLogRow, "user_id"> & { user_id: string } {
  return {
    id: l.id,
    user_id: userId,
    date: l.date,
    meal_type: l.mealType,
    source: l.source,
    name: l.name,
    calories: l.calories,
    protein: l.protein,
    carbs: l.carbs,
    fat: l.fat,
    image_url: null,
    notes: l.notes ?? null,
    logged_at: l.loggedAt,
  };
}

/** Merge local + server log lists. Latest `loggedAt` wins per id. */
export function mergeLogs(local: MealLog[], remote: MealLog[]): MealLog[] {
  const byId = new Map<string, MealLog>();
  for (const l of remote) byId.set(l.id, l);
  for (const l of local) {
    const existing = byId.get(l.id);
    if (!existing || new Date(l.loggedAt) > new Date(existing.loggedAt)) {
      byId.set(l.id, l);
    }
  }
  // Sort newest first to match localStorage ordering.
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
  );
}

// ─── Push (single ops) ─────────────────────────────────────────────────────

export async function pushMealLog(log: MealLog): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("meal_logs")
    .upsert(logToRow(user.id, log), { onConflict: "user_id,id" });
  if (error) console.error("pushMealLog:", error.message);
}

export async function deleteMealLogRemote(id: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("meal_logs")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) console.error("deleteMealLogRemote:", error.message);
}

export async function pushNutritionGoals(goals: NutritionGoals): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("nutrition_goals")
    .upsert(
      {
        user_id: user.id,
        daily_calories: goals.dailyCalories,
        protein: goals.protein,
        carbs: goals.carbs,
        fat: goals.fat,
        goal: goals.goal,
        profile: goals.profile ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) console.error("pushNutritionGoals:", error.message);
}

// ─── Pull (on sign-in) ─────────────────────────────────────────────────────

export async function pullMealLogs(userId: string, since?: string): Promise<MealLog[]> {
  const supabase = createClient();
  let q = supabase
    .from("meal_logs")
    .select("*")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false });
  if (since) q = q.gte("date", since);
  const { data, error } = await q;
  if (error) {
    console.error("pullMealLogs:", error.message);
    return [];
  }
  return (data as MealLogRow[]).map(rowToLog);
}

export async function pullNutritionGoals(userId: string): Promise<NutritionGoals | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("nutrition_goals")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // PGRST116 = no rows; not an error for first-time users
    if (error.code !== "PGRST116") console.error("pullNutritionGoals:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    dailyCalories: data.daily_calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
    goal: data.goal,
    profile: data.profile ?? undefined,
  };
}

// ─── Backfill on first sign-in ─────────────────────────────────────────────

/**
 * Push every local log + the local goal once, after we've pulled and merged.
 * Used the first time a previously-anonymous user signs in: their device data
 * shouldn't disappear.
 */
export async function pushLocalState(userId: string, logs: MealLog[], goals: NutritionGoals | null): Promise<void> {
  const supabase = createClient();
  if (logs.length > 0) {
    const rows = logs.map((l) => logToRow(userId, l));
    // upsert in chunks of 50 to avoid request size limits
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const { error } = await supabase
        .from("meal_logs")
        .upsert(chunk, { onConflict: "user_id,id" });
      if (error) {
        console.error("pushLocalState (logs):", error.message);
        break;
      }
    }
  }
  if (goals) await pushNutritionGoals(goals);
}
