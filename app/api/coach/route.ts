import { generateObject, streamObject } from "ai";
import { requireUser, denyIfRestricted } from "@/lib/auth-guard";
import { checkAndIncrementUsage } from "@/lib/rate-limit";
import { getModel, getServerModel, type Provider } from "@/lib/providers";
import {
  InsightsResponse,
  DietChartResponse,
  buildInsightsPrompt,
  buildDietChartPrompt,
  type CoachLog,
  type CoachGoals,
} from "@/lib/coach-insights";

export const maxDuration = 45;

type Mode = "insights" | "diet_chart";

interface CoachRequest {
  mode: Mode;
  logs: CoachLog[];
  goals: CoachGoals;
  dietaryPreferences?: string[];
  /** Soft taste signal from onboarding's 2b step. See lib/taste-prompt.ts. */
  favoriteCuisines?: string[];
  /** Legacy pre-formatted variant; favoriteCuisines wins when both are set. */
  cuisinesHint?: string;
  provider?: Provider;
  apiKey?: string;
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
    const guard = await requireUser();
    if (guard instanceof Response) return guard;
    const { user, profile } = guard;

    // Must precede the BYOK branch below: BYOK skips quota entirely, so
    // without this a restricted user just supplies their own key.
    const restricted = denyIfRestricted(profile);
    if (restricted) return restricted;

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
