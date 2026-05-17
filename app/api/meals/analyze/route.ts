import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkAndIncrementPhotoUsage } from "@/lib/photo-quota";
import { getModel, getServerModel, type Provider } from "@/lib/providers";

export const maxDuration = 30;

const NutritionSchema = z.object({
  name: z.string().describe("Short name of the dish, e.g. 'Paneer tikka with mint chutney'"),
  calories: z.number().int().nonnegative().describe("Estimated total kcal for the portion shown"),
  protein: z.number().nonnegative().describe("Protein in grams"),
  carbs: z.number().nonnegative().describe("Carbohydrates in grams"),
  fat: z.number().nonnegative().describe("Fat in grams"),
  confidence: z.number().min(0).max(1).describe("0–1 confidence in the estimate. Below 0.6 means the image was unclear or the dish was ambiguous."),
  notes: z.string().optional().describe("Short qualifier shown to the user, e.g. 'Assumed 1 standard cup portion'"),
});

type Body =
  | { kind: "photo"; imageBase64: string; mealType?: string; provider?: Provider; apiKey?: string }
  | { kind: "dish"; name: string; mealType?: string; provider?: Provider; apiKey?: string };

const SYSTEM_PROMPT = `You are a nutrition estimator for a food tracking app.
You will be shown either a photo of a meal or the name of a dish.
Return a single JSON object that conforms to the schema. Be realistic — do NOT round to vague numbers.
Estimate based on a single typical portion as shown / commonly served. If the portion is unusual, note it in "notes".
If the image is unclear, the dish is ambiguous, or there is no food visible, set "confidence" below 0.5 and explain in "notes".
Calories must be consistent with macros (~4 kcal/g protein, ~4 kcal/g carbs, ~9 kcal/g fat) within ±15%.`;

function stripDataUrl(b64: string): string {
  return b64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.kind || (body.kind !== "photo" && body.kind !== "dish")) {
    return Response.json({ error: "invalid_kind" }, { status: 400 });
  }
  if (body.kind === "photo" && (!body.imageBase64 || typeof body.imageBase64 !== "string")) {
    return Response.json({ error: "missing_image" }, { status: 400 });
  }
  if (body.kind === "dish" && (!body.name || !body.name.trim())) {
    return Response.json({ error: "missing_name" }, { status: 400 });
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

    // Pick model
    let model;
    let usedBYOK = false;
    if (body.apiKey && body.provider) {
      usedBYOK = true;
      model = getModel(body.provider, body.apiKey);
    } else {
      // Photo analyses meter against the photo quota; dish-name estimates use the chat quota.
      if (body.kind === "photo") {
        const quota = await checkAndIncrementPhotoUsage(user.id);
        if (!quota.allowed) {
          return Response.json(
            {
              error: "photo_quota_exceeded",
              needsKey: true,
              message: "Daily photo limit reached. Add an API key or upgrade for unlimited.",
            },
            { status: 429 },
          );
        }
      }
      // dish-name estimates are very cheap; share with chat quota would punish users — skip
      // the check here for now; revisit if abuse appears.
      model = getServerModel();
    }

    const userContent =
      body.kind === "photo"
        ? [
            {
              type: "text" as const,
              text: `Estimate the nutrition for the meal shown.${body.mealType ? ` Meal type: ${body.mealType}.` : ""}`,
            },
            {
              type: "image" as const,
              image: stripDataUrl(body.imageBase64),
              mimeType: "image/jpeg",
            },
          ]
        : `Estimate the nutrition for: "${body.name.trim()}".${
            body.mealType ? ` Meal type: ${body.mealType}.` : ""
          }`;

    const { object } = await generateObject({
      model,
      schema: NutritionSchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    return Response.json({
      ...object,
      calories: Math.round(object.calories),
      protein: Math.round(object.protein),
      carbs: Math.round(object.carbs),
      fat: Math.round(object.fat),
      needsConfirmation: object.confidence < 0.6,
      byok: usedBYOK,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    // Truncate — provider errors can echo request payload fragments (incl. base64).
    console.error("Meal analyze error:", errMsg.slice(0, 200));

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

    return Response.json(
      { error: "analyze_failed", message: errMsg },
      { status: 500 },
    );
  }
}
