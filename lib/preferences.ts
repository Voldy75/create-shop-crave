/**
 * preferences — the single model behind web first-run (WF10, /welcome) and
 * Settings → Preferences. Both screens edit the same values through these
 * helpers so they cannot disagree about how a choice is stored.
 *
 * STORAGE (unchanged — this file only wraps what already exists):
 *   - diet:      `dietaryPreferences`, lowercase ("vegetarian", "gluten-free")
 *   - allergies: ALSO `dietaryPreferences`, as "avoid <x>" tags. That array is
 *                the strict "must respect" filter threaded into every AI path,
 *                which is exactly where a hard-no belongs. Mobile onboarding
 *                established this encoding; do not invent a second field.
 *   - tastes:    `favoriteCuisines` — a SOFT signal, deliberately separate from
 *                the strict array (see lib/taste-prompt.ts for why merging them
 *                corrupts the filter).
 *   - goal:      see getWeightGoal / setWeightGoal below.
 *
 * NEVER DROP WHAT YOU DON'T RENDER. Mobile onboarding uses different option
 * lists — its diets include Pescatarian and Low-carb, its "tastes" are dishes
 * (Ramen, Tacos) rather than cuisines, and its allergies include Cilantro and
 * Olives. A value saved there must survive a save here. The split/join helpers
 * keep every unrecognised entry, and the UI shows it as an extra selected chip
 * rather than silently deleting it on the next tap.
 */

import type { NutritionGoals, WeightGoal } from "@/lib/types";
import { getNutritionGoals, saveNutritionGoals } from "@/lib/storage";
import { defaultGoalsFromProfile } from "@/lib/nutrition";

export const DIET_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Halal",
  "Keto",
] as const;

export const ALLERGY_OPTIONS = [
  "Peanuts",
  "Tree nuts",
  "Shellfish",
  "Fish",
  "Eggs",
  "Milk",
  "Soy",
  "Wheat",
  "Sesame",
] as const;

export const CUISINE_OPTIONS = [
  "North Indian",
  "South Indian",
  "Gujarati",
  "Bengali",
  "Indo-Chinese",
  "Street food",
  "Italian",
  "Mexican",
  "Thai",
  "Japanese",
  "Korean",
  "Middle Eastern",
  "Mediterranean",
  "Continental",
] as const;

export const GOAL_OPTIONS: { value: WeightGoal; label: string; sub: string }[] = [
  { value: "lose", label: "Lose weight", sub: "Lighter portions, more fibre" },
  { value: "maintain", label: "Maintain weight", sub: "Balanced, no calorie push" },
  { value: "gain", label: "Gain weight", sub: "More protein and energy" },
];

const AVOID = "avoid ";

/** Case-insensitive identity for a chip value. */
export const norm = (s: string) => s.trim().toLowerCase();

/** Split the strict array into diets and allergies, keeping unknown entries. */
export function splitDietary(prefs: string[]): { diets: string[]; allergies: string[] } {
  const diets: string[] = [];
  const allergies: string[] = [];
  for (const raw of prefs) {
    const p = norm(raw);
    if (!p) continue;
    if (p.startsWith(AVOID)) allergies.push(p.slice(AVOID.length).trim());
    else diets.push(p);
  }
  return { diets: dedupe(diets), allergies: dedupe(allergies) };
}

/** Rebuild the strict array. Diets first, then "avoid <x>" tags. */
export function joinDietary(diets: string[], allergies: string[]): string[] {
  return [
    ...dedupe(diets.map(norm)).filter(Boolean),
    ...dedupe(allergies.map(norm)).filter(Boolean).map((a) => `${AVOID}${a}`),
  ];
}

/** Values present in `selected` that have no chip in `options`, in order. */
export function extras(selected: string[], options: readonly string[]): string[] {
  const known = new Set(options.map(norm));
  return selected.filter((s) => !known.has(norm(s)));
}

/** Toggle `value` in `list` case-insensitively. */
export function toggle(list: string[], value: string): string[] {
  const v = norm(value);
  return list.some((x) => norm(x) === v) ? list.filter((x) => norm(x) !== v) : [...list, value];
}

export const has = (list: string[], value: string) => list.some((x) => norm(x) === norm(value));

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
}

// ─── Weight goal ────────────────────────────────────────────────────────────
//
// The goal historically lived ONLY inside NutritionGoals, which also requires a
// calorie target — and defaultGoalsFromProfile() returns null without age,
// height and weight. So a first-run "just the goal" pick had nowhere valid to
// live. It now has its own key, which is what the chat prompt reads.
//
// Reads fall back to NutritionGoals.goal, so a user who set full targets on the
// planner or in mobile onboarding sees their goal here without re-picking.
// "none" is a real stored value: an explicit "no goal" must beat that fallback,
// otherwise clearing the goal here would silently resurrect the planner's.

const WEIGHT_GOAL_KEY = "crave_weightGoal";
const NO_GOAL = "none";
const GOALS: WeightGoal[] = ["lose", "maintain", "gain"];

export function getWeightGoal(): WeightGoal | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(WEIGHT_GOAL_KEY);
    if (v === NO_GOAL) return null;
    if (v && (GOALS as string[]).includes(v)) return v as WeightGoal;
  } catch {
    /* fall through to the planner's goal */
  }
  return getNutritionGoals()?.goal ?? null;
}

/**
 * Set or clear the goal. When planner targets exist, they follow the new goal
 * too — and their calories are recomputed when the profile is complete enough
 * to do so honestly. Without a profile the calories are left as they are
 * rather than guessed.
 */
export function setWeightGoal(goal: WeightGoal | null): void {
  try {
    localStorage.setItem(WEIGHT_GOAL_KEY, goal ?? NO_GOAL);
  } catch {
    return;
  }
  if (!goal) return;
  const current = getNutritionGoals();
  if (!current) return;
  const recomputed = current.profile ? defaultGoalsFromProfile({ ...current.profile, goal }) : null;
  const next: NutritionGoals = recomputed ?? { ...current, goal };
  saveNutritionGoals(next);
}

// ─── Web first-run ──────────────────────────────────────────────────────────
//
// Per-device, like the preferences it collects (they live in localStorage, so
// a second browser genuinely has none). Shown once; "Skip to app" counts.

const FIRST_RUN_KEY = "crave_webFirstRun";

export function webFirstRunDone(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(FIRST_RUN_KEY) === "done";
  } catch {
    return true;
  }
}

export function markWebFirstRunDone(): void {
  try {
    localStorage.setItem(FIRST_RUN_KEY, "done");
  } catch {
    /* non-fatal: worst case the first-run is offered again */
  }
}

/**
 * Should a signed-in user on this device see /welcome? Only when they have
 * neither finished it nor already told us anything. A returning user who set
 * diet chips on the landing, or onboarded on this device before, is not sent
 * through it again.
 */
export function needsWebFirstRun(dietaryPreferences: string[], favoriteCuisines: string[]): boolean {
  if (webFirstRunDone()) return false;
  return dietaryPreferences.length === 0 && favoriteCuisines.length === 0;
}
