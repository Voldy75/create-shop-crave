/**
 * Pure prompt-building + summarization helpers for the Coach feature.
 *
 * Used by:
 *  - app/api/coach/route.ts (streaming insights + full diet chart)
 *  - app/api/cron/daily-nudge/route.ts (one-shot nudge composition)
 *
 * Keeping these out of the API route means the cron doesn't need to make an
 * HTTP call to its own /api/coach to compose a daily nudge.
 */

import { z } from "zod";
import { generateObject } from "ai";
import { getServerModel } from "@/lib/providers";
import { tastesLine } from "@/lib/taste-prompt";

// ─── Shared types ───────────────────────────────────────────────────────────

export interface CoachLog {
  date: string;
  mealType: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CoachGoals {
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  goal: "lose" | "maintain" | "gain";
}

// ─── Schemas (shared between routes and cron) ──────────────────────────────

export const InsightSchema = z.object({
  title: z.string().describe("Short headline (≤ 60 chars)"),
  body: z.string().describe("One or two sentences explaining the observation and the specific action."),
  severity: z.enum(["info", "nudge", "warn"]).describe(
    "info: positive or neutral observation. nudge: gentle suggestion. warn: meaningful gap from goal worth flagging.",
  ),
});

export const InsightsResponse = z.object({
  insights: z.array(InsightSchema).min(2).max(6),
});

export const DietChartSlot = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner"]),
  dish: z.string().describe("Specific dish name, not a generic category."),
  calories: z.number().int().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
});

export const DietChartDay = z.object({
  day: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]),
  meals: z.array(DietChartSlot).min(3).max(3),
});

export const DietChartResponse = z.object({
  summary: z.string().describe("One sentence explaining the approach taken (~ 1 line)."),
  days: z.array(DietChartDay).length(7),
});

// Nudge: single-sentence push-friendly suggestion. Distinct schema from
// Insights — different shape, different length budget for WhatsApp/push.
export const NudgeResponse = z.object({
  title: z.string().max(60).describe("Short headline for the notification (≤ 60 chars). No emoji."),
  body: z.string().max(160).describe(
    "One sentence. Must reference at least one number from the user's intake or goal. ≤ 160 chars to fit a single SMS-style line. Direct, no greetings.",
  ),
});

export type Nudge = z.infer<typeof NudgeResponse>;

// ─── Summarization ──────────────────────────────────────────────────────────

export function summarizeLogs(logs: CoachLog[]): string {
  if (logs.length === 0) return "(no meals logged yet)";
  const byDay: Record<string, CoachLog[]> = {};
  for (const l of logs) {
    if (!byDay[l.date]) byDay[l.date] = [];
    byDay[l.date].push(l);
  }
  const lines: string[] = [];
  for (const date of Object.keys(byDay).sort()) {
    const dayLogs = byDay[date];
    const totalCal = dayLogs.reduce((s, l) => s + l.calories, 0);
    const totalP = dayLogs.reduce((s, l) => s + l.protein, 0);
    const totalC = dayLogs.reduce((s, l) => s + l.carbs, 0);
    const totalF = dayLogs.reduce((s, l) => s + l.fat, 0);
    const items = dayLogs.map((l) => `${l.mealType}: ${l.name} (${l.calories}kcal)`).join("; ");
    lines.push(
      `${date} — total ${totalCal}kcal / P${totalP}g C${totalC}g F${totalF}g. ${items}`,
    );
  }
  return lines.join("\n");
}

// ─── Prompt builders ────────────────────────────────────────────────────────

interface PromptArgs {
  logs: CoachLog[];
  goals: CoachGoals;
  dietaryPreferences?: string[];
  /** Soft taste signal from onboarding's 2b step. See lib/taste-prompt.ts. */
  favoriteCuisines?: string[];
  /**
   * Pre-formatted cuisine string. Predates `favoriteCuisines` and was declared
   * on both request types but NEVER SENT by any caller — a half-built seam.
   * Kept so an existing caller cannot break; `favoriteCuisines` wins when both
   * are present.
   */
  cuisinesHint?: string;
}

export function buildInsightsPrompt(req: PromptArgs): { system: string; prompt: string } {
  const system = `You are a pragmatic nutrition coach inside a food-tracking app.
You produce concrete, numeric observations a user can act on today.
Each insight must reference an actual number from the user's recent intake or their goal — never generic advice.
Tone: friendly but specific. No medical claims. No emojis.`;

  const dietary = req.dietaryPreferences?.length
    ? `Dietary preferences (must respect): ${req.dietaryPreferences.join(", ")}.`
    : "No dietary restrictions provided.";
  // Soft signal, kept distinct from the strict `dietary` line above.
  const tastes = tastesLine(req.favoriteCuisines);

  const prompt = `User's daily goal: ${req.goals.dailyCalories} kcal, ${req.goals.protein}g protein, ${req.goals.carbs}g carbs, ${req.goals.fat}g fat. Goal: ${req.goals.goal}.
${dietary}
${tastes}

Recent meal logs (last few days):
${summarizeLogs(req.logs)}

Produce 3–5 insights. At least one should be a concrete suggestion for the next meal. Mix severities — use "warn" only when something is meaningfully off (e.g. > 25% short on protein for 3+ days).`;
  return { system, prompt };
}

export function buildDietChartPrompt(req: PromptArgs): { system: string; prompt: string } {
  const system = `You are a meal planning assistant. Generate a 7-day diet plan (Monday–Sunday, breakfast/lunch/dinner only — no snacks).
Each meal must be a specific named dish a regular person can recognize, not a category. Each day's total calories must be within ±10% of the user's daily goal. Macros across the week should hit the user's daily targets on average. Respect dietary preferences strictly.
Vary dishes across the week — do not repeat the same dish more than twice. Prefer locally familiar dishes when location/cuisine context is given.
No medical claims.`;

  const dietary = req.dietaryPreferences?.length
    ? `Dietary preferences (strict): ${req.dietaryPreferences.join(", ")}.`
    : "No dietary restrictions.";
  const cuisines = tastesLine(req.favoriteCuisines)
    || (req.cuisinesHint ? `Cuisine context: ${req.cuisinesHint}.` : "");

  const prompt = `Daily target: ${req.goals.dailyCalories} kcal, ${req.goals.protein}g protein, ${req.goals.carbs}g carbs, ${req.goals.fat}g fat. Goal: ${req.goals.goal}.
${dietary}
${cuisines}

Recent intake (for context — vary the plan from these):
${summarizeLogs(req.logs.slice(0, 12))}

Generate a 7-day plan with one breakfast, one lunch, one dinner per day.`;
  return { system, prompt };
}

function buildNudgePrompt(req: PromptArgs): { system: string; prompt: string } {
  const system = `You write single-line evening nudges for a food-tracking app's daily push notification.
Constraints:
- Title ≤ 60 chars. Body ≤ 160 chars (so it fits one SMS line).
- Reference at least one number from intake or goal.
- Action-oriented: hint at tomorrow OR flag a gap, never both. Direct, no greeting.
- No medical claims, no emojis.`;

  const dietary = req.dietaryPreferences?.length
    ? `Dietary prefs (respect): ${req.dietaryPreferences.join(", ")}.`
    : "";
  const prompt = `Daily goal: ${req.goals.dailyCalories} kcal, ${req.goals.protein}g protein, ${req.goals.carbs}g carbs, ${req.goals.fat}g fat (${req.goals.goal}).
${dietary}

Today + recent days:
${summarizeLogs(req.logs)}

Write one nudge for tonight. If user logged 0 meals today, prompt them to log. If they hit goal, congratulate briefly. Otherwise, surface the most-actionable gap.`;
  return { system, prompt };
}

/**
 * One-shot daily nudge for the cron.
 * Uses the server's default model (no BYOK in the cron — system-initiated).
 * Returns null if anything goes wrong; caller decides whether to skip the user
 * or fall back to a static message.
 */
export async function composeNudge(args: PromptArgs): Promise<Nudge | null> {
  try {
    const { system, prompt } = buildNudgePrompt(args);
    const { object } = await generateObject({
      model: getServerModel(),
      schema: NudgeResponse,
      system,
      prompt,
    });
    return object;
  } catch (err) {
    console.error("composeNudge:", err instanceof Error ? err.message.slice(0, 200) : err);
    return null;
  }
}
