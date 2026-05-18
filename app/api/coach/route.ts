import { generateObject, streamObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkAndIncrementUsage } from "@/lib/rate-limit";
import { getModel, getServerModel, type Provider } from "@/lib/providers";

export const maxDuration = 45;

const InsightSchema = z.object({
  title: z.string().describe("Short headline (≤ 60 chars)"),
  body: z.string().describe("One or two sentences explaining the observation and the specific action."),
  severity: z.enum(["info", "nudge", "warn"]).describe(
    "info: positive or neutral observation. nudge: gentle suggestion. warn: meaningful gap from goal worth flagging.",
  ),
});

const InsightsResponse = z.object({
  insights: z.array(InsightSchema).min(2).max(6),
});

const DietChartSlot = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner"]),
  dish: z.string().describe("Specific dish name, not a generic category."),
  calories: z.number().int().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
});

const DietChartDay = z.object({
  day: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]),
  meals: z.array(DietChartSlot).min(3).max(3),
});

const DietChartResponse = z.object({
  summary: z.string().describe("One sentence explaining the approach taken (~ 1 line)."),
  days: z.array(DietChartDay).length(7),
});

type Mode = "insights" | "diet_chart";

interface CoachRequest {
  mode: Mode;
  logs: Array<{
    date: string;
    mealType: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  goals: {
    dailyCalories: number;
    protein: number;
    carbs: number;
    fat: number;
    goal: "lose" | "maintain" | "gain";
  };
  dietaryPreferences?: string[];
  cuisinesHint?: string;
  provider?: Provider;
  apiKey?: string;
}

function summarizeLogs(logs: CoachRequest["logs"]): string {
  if (logs.length === 0) return "(no meals logged yet)";
  const byDay: Record<string, typeof logs> = {};
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

function buildInsightsPrompt(req: CoachRequest): { system: string; prompt: string } {
  const system = `You are a pragmatic nutrition coach inside a food-tracking app.
You produce concrete, numeric observations a user can act on today.
Each insight must reference an actual number from the user's recent intake or their goal — never generic advice.
Tone: friendly but specific. No medical claims. No emojis.`;

  const dietary = req.dietaryPreferences?.length
    ? `Dietary preferences (must respect): ${req.dietaryPreferences.join(", ")}.`
    : "No dietary restrictions provided.";

  const prompt = `User's daily goal: ${req.goals.dailyCalories} kcal, ${req.goals.protein}g protein, ${req.goals.carbs}g carbs, ${req.goals.fat}g fat. Goal: ${req.goals.goal}.
${dietary}

Recent meal logs (last few days):
${summarizeLogs(req.logs)}

Produce 3–5 insights. At least one should be a concrete suggestion for the next meal. Mix severities — use "warn" only when something is meaningfully off (e.g. > 25% short on protein for 3+ days).`;
  return { system, prompt };
}

function buildDietChartPrompt(req: CoachRequest): { system: string; prompt: string } {
  const system = `You are a meal planning assistant. Generate a 7-day diet plan (Monday–Sunday, breakfast/lunch/dinner only — no snacks).
Each meal must be a specific named dish a regular person can recognize, not a category. Each day's total calories must be within ±10% of the user's daily goal. Macros across the week should hit the user's daily targets on average. Respect dietary preferences strictly.
Vary dishes across the week — do not repeat the same dish more than twice. Prefer locally familiar dishes when location/cuisine context is given.
No medical claims.`;

  const dietary = req.dietaryPreferences?.length
    ? `Dietary preferences (strict): ${req.dietaryPreferences.join(", ")}.`
    : "No dietary restrictions.";
  const cuisines = req.cuisinesHint ? `Cuisine context: ${req.cuisinesHint}.` : "";

  const prompt = `Daily target: ${req.goals.dailyCalories} kcal, ${req.goals.protein}g protein, ${req.goals.carbs}g carbs, ${req.goals.fat}g fat. Goal: ${req.goals.goal}.
${dietary}
${cuisines}

Recent intake (for context — vary the plan from these):
${summarizeLogs(req.logs.slice(0, 12))}

Generate a 7-day plan with one breakfast, one lunch, one dinner per day.`;
  return { system, prompt };
}

export async function POST(req: Request) {
  let body: CoachRequest;
  try {
    body = (await req.json()) as CoachRequest;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body.mode !== "insights" && body.mode !== "diet_chart") {
    return Response.json({ error: "invalid_mode" }, { status: 400 });
  }
  if (!body.goals || typeof body.goals.dailyCalories !== "number") {
    return Response.json({ error: "missing_goals" }, { status: 400 });
  }
  if (!Array.isArray(body.logs)) {
    return Response.json({ error: "missing_logs" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let model;
    let usedBYOK = false;
    if (body.apiKey && body.provider) {
      usedBYOK = true;
      model = getModel(body.provider, body.apiKey);
    } else {
      const quota = await checkAndIncrementUsage(user.id);
      if (!quota.allowed) {
        return Response.json(
          {
            error: "rate_limit_exceeded",
            needsKey: true,
            message: "Daily AI limit reached. Add your API key to keep using Coach.",
          },
          { status: 429 },
        );
      }
      model = getServerModel();
    }

    if (body.mode === "insights") {
      // Stream the insights object as NDJSON: each chunk is a complete
      // JSON.stringify of the in-progress partial. The client takes the last
      // fully-received line as the current state, so even if a partial is
      // mid-character the client just waits one more chunk.
      const { system, prompt } = buildInsightsPrompt(body);
      const result = await streamObject({
        model,
        schema: InsightsResponse,
        system,
        prompt,
      });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const partial of result.partialObjectStream) {
              controller.enqueue(encoder.encode(JSON.stringify(partial) + "\n"));
            }
            // Final marker carrying BYOK flag (clients can ignore if they want).
            controller.enqueue(encoder.encode(JSON.stringify({ _done: true, byok: usedBYOK }) + "\n"));
            controller.close();
          } catch (err) {
            console.error("Coach insights stream error:", err instanceof Error ? err.message : err);
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ _error: "stream_failed", message: "Stream interrupted" }) + "\n",
              ),
            );
            controller.close();
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // diet_chart — keep non-streaming. A partial 7-day plan would render
    // confusingly (3 days of meals visible, others empty). Single atomic
    // delivery is the right UX.
    const { system, prompt } = buildDietChartPrompt(body);
    const { object } = await generateObject({
      model,
      schema: DietChartResponse,
      system,
      prompt,
    });
    return Response.json({ ...object, byok: usedBYOK });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Coach error:", errMsg);

    const isAuthError =
      errMsg.includes("401") ||
      errMsg.includes("invalid_api_key") ||
      errMsg.toLowerCase().includes("unauthorized");
    if (body.apiKey && isAuthError) {
      return Response.json(
        {
          error: "invalid_key",
          provider: body.provider || "unknown",
          message: `Your ${body.provider || "API"} key is invalid or has insufficient quota.`,
        },
        { status: 400 },
      );
    }
    return Response.json({ error: "coach_failed", message: errMsg }, { status: 500 });
  }
}
