import { generateObject } from "ai";
import { z } from "zod";
import { requireUser, denyIfRestricted } from "@/lib/auth-guard";
import { checkAndIncrementUsage } from "@/lib/rate-limit";
import { getModel, getServerModel, type Provider } from "@/lib/providers";

export const maxDuration = 45;

/**
 * Batch ingredient extraction for a list of dishes.
 *
 * Used by the diet-chart Apply flow: when Coach generates a 7-day plan, the
 * dishes come back as names + macros only. This endpoint converts those names
 * into ingredient lists that the Plan tab Shopping List can render with real
 * Blinkit / Swiggy Instamart / Instacart deeplinks.
 *
 * Returns ingredient names + quantities + prices only. The client builds the
 * platform URLs locally via lib/deeplinks.ts — cuts LLM payload ~50% and keeps
 * URL construction centralized.
 */

const IngredientNameSchema = z.object({
  item: z.string().describe("Ingredient name as you'd search a grocery app (e.g. 'paneer', 'basmati rice')."),
  quantity: z.string().optional().describe("Quantity for one batch of the recipe (e.g. '200g', '2 cups')."),
  price: z.string().describe("Rough INR estimate per quantity (e.g. '₹80'). One short string."),
});

const DishIngredientsSchema = z.object({
  dish: z.string().describe("Echo the dish name verbatim from the input."),
  ingredients: z.array(IngredientNameSchema).min(3).max(15),
});

const BatchResponse = z.object({
  dishes: z.array(DishIngredientsSchema),
});

interface IngredientsRequest {
  dishes: string[];
  dietaryPreferences?: string[];
  provider?: Provider;
  apiKey?: string;
}

function buildPrompt(req: IngredientsRequest): { system: string; prompt: string } {
  const system = `You are a culinary assistant. For each dish name in the input list, produce a realistic ingredient list suitable for a single recipe batch (serves 2).
- Ingredient names must be grocery-app-search-ready: simple, lowercase-ish nouns (e.g. "boneless chicken thigh", "fresh ginger", "garam masala"). Avoid compound phrases like "1 cup of finely chopped onions" — that goes in quantity.
- Quantity is for a 2-serving batch.
- Price is a rough INR estimate per quantity. Realistic Indian retail prices.
- Echo the dish name exactly as given. Do not rename or pluralize.
- No medical claims, no commentary outside the JSON.`;

  const dietary = req.dietaryPreferences?.length
    ? `Dietary preferences (strict): ${req.dietaryPreferences.join(", ")}.`
    : "";
  /* NOTE: `favoriteCuisines` is deliberately NOT used here, and that is not an
     omission to fix later. This route expands an ALREADY-CHOSEN dish name into
     its ingredients. A soft cuisine preference has no business changing what
     goes into a named dish — "user tends to enjoy Thai" must not put lemongrass
     in a rajma recipe. Tastes belong where a dish is being CHOSEN (chat, coach,
     diet chart), which is where they are wired. */
  const prompt = `Dishes:
${req.dishes.map((d, i) => `${i + 1}. ${d}`).join("\n")}

${dietary}

Produce ingredients for ALL ${req.dishes.length} dishes, in the same order.`;

  return { system, prompt };
}

export async function POST(req: Request) {
  let body: IngredientsRequest;
  try {
    body = (await req.json()) as IngredientsRequest;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!Array.isArray(body.dishes) || body.dishes.length === 0) {
    return Response.json({ error: "missing_dishes" }, { status: 400 });
  }
  if (body.dishes.length > 30) {
    return Response.json({ error: "too_many_dishes", message: "Max 30 dishes per request." }, { status: 400 });
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
      // One batch = one quota point regardless of dish count. Cheaper than the
      // /api/chat flow since this only extracts ingredient names.
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

    const { system, prompt } = buildPrompt(body);
    const { object } = await generateObject({
      model,
      schema: BatchResponse,
      system,
      prompt,
    });

    return Response.json({ ...object, byok: usedBYOK });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Ingredients error:", errMsg.slice(0, 200));

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
    return Response.json({ error: "ingredients_failed", message: errMsg }, { status: 500 });
  }
}
