import { streamText, toUIMessageStream, createUIMessageStreamResponse } from "ai";
import { toModelMessages } from "@/lib/ai-messages";
import { requireUser, denyIfRestricted } from "@/lib/auth-guard";
import { checkAndIncrementUsage } from "@/lib/rate-limit";
import { getModel, getServerModel, type Provider } from "@/lib/providers";
import { tastesLine, goalLine } from "@/lib/taste-prompt";
import { getServerPartners } from "@/lib/feature-flags-server";
import type { Partners } from "@/lib/partners";

/** Only the partners that are switched on reach the prompt (lib/partners.ts),
 *  so Bo never generates — or talks up — a store the app no longer offers. */
function groceryLinkLines(p: Partners): { lines: string; names: string } {
  const all = [
    { on: true, name: "Swiggy Instamart", line: `{ "platform": "swiggy_instamart", "label": "Swiggy Instamart", "url": "https://www.swiggy.com/instamart/search?custom_back=true&query=ITEM_NAME" }` },
    { on: p.blinkit, name: "Blinkit", line: `{ "platform": "blinkit", "label": "Blinkit", "url": "https://blinkit.com/s/?q=ITEM_NAME" }` },
    { on: p.instacart, name: "Instacart", line: `{ "platform": "instacart", "label": "Instacart", "url": "https://www.instacart.com/store/search/ITEM_NAME" }` },
  ].filter((x) => x.on);
  return { lines: all.map((x) => `          ${x.line}`).join(",\n"), names: all.map((x) => x.name).join(", ") };
}

export const maxDuration = 30;

const systemPrompt = (userName: string, location: string, dietaryPrefs: string, tastes: string, goal: string, partners: Partners) => {
  const grocery = groceryLinkLines(partners);
  return `
You are a helpful AI food companion. Your goal is to help the user decide what to eat based on their input (Dish Type) and optional Occasion.

User Context:
Name: ${userName}
Location: ${location}
${dietaryPrefs}
${tastes}
${goal}

You should analyze the user's request and provide a response in a structured JSON format inside a code block, followed by a brief conversational message.

The JSON structure should be:
\`\`\`json
{
  "type": "recipe" | "restaurant" | "both" | "clarification",
  "recipe": {
    "name": "Dish Name",
    "description": "Brief description",
    "prepTime": "e.g. 30 mins",
    "servings": 2,
    "dietaryTags": ["vegetarian", "gluten-free"],
    "ingredients": [
      {
        "item": "Ingredient Name",
        "quantity": "e.g. 200g",
        "price": "₹XX",
        "links": [
${grocery.lines}
        ]
      }
    ],
    "instructions": ["Step 1", "Step 2"],
    "nutritionEstimate": {
      "calories": "~450 kcal",
      "protein": "~20g",
      "carbs": "~55g",
      "fat": "~15g"
    }
  },
  "restaurantSuggestion": {
    "query": "Search query for Google Places API (for the map)",
    "dishName": "The specific dish name being suggested",
    "reason": "Why this is good for the occasion",
    "restaurants": [
      {
        "name": "Restaurant Name",
        "rating": "4.5",
        "priceRange": "₹₹₹",
        "area": "Location/Area",
        "cuisine": "Italian",
        "lat": 28.6139,
        "lng": 77.2090,
${partners.zomato ? `        "zomatoUrl": "https://www.zomato.com/...",\n` : ""}        "swiggyUrl": "https://www.swiggy.com/..."
      }
    ]
  }
}
\`\`\`

IMPORTANT RULES:
- If the user's input is vague, ask for clarification (type: "clarification").
- PREFER returning "both" (recipe AND restaurant suggestions) for most food queries. Only return "recipe" alone if the user explicitly says they want to cook at home. Only return "restaurant" alone if the user explicitly says they want to eat out or find restaurants.
- Default to "both" whenever a dish or cuisine is mentioned without specifying cook vs. eat out.
- For "ingredients", simulate realistic prices in INR. For EACH ingredient, generate a "links" array with exactly these platforms (${grocery.names}) using the URL templates shown above. Replace ITEM_NAME with the URL-encoded ingredient name.
- For "restaurants", suggest 3-5 popular real restaurants in the user's city (if known from their coordinates) or general famous chains. Include approximate lat/lng coordinates for each restaurant. Include the cuisine type.
- Generate a Swiggy search URL${partners.zomato ? " and a Zomato search URL" : ""} for each restaurant.
- The services this app offers are: Swiggy for food delivery, Swiggy Instamart for groceries, Swiggy Dineout for booking a table, and Uber/Ola for rides${partners.zomato ? ", plus Zomato" : ""}${partners.blinkit ? ", Blinkit" : ""}${partners.instacart ? ", Instacart" : ""}. Never recommend or mention any other ordering, grocery or reservation service. For eating out, say the user can find or book a table on Swiggy Dineout.
- Include "dishName" in restaurantSuggestion so the app can build delivery order links.
- Include nutritionEstimate with approximate per-serving values.
- Include prepTime, servings, and dietaryTags for every recipe.
- Keep the conversational part friendly and engaging.
`;
};

export async function POST(req: Request) {
  // Strip apiKey from body BEFORE any error handling to prevent log exposure
  const rawBody = await req.json();
  const { apiKey: _stripped, ...safeBody } = rawBody;
  const { messages, userContext, provider, apiKey } = { ...rawBody };

  try {
    // 1. Verify Supabase session
    const guard = await requireUser();
    if (guard instanceof Response) return guard;
    const { user, profile } = guard;

    // Must precede the BYOK branch below: BYOK skips quota entirely, so
    // without this a restricted user just supplies their own key.
    const restricted = denyIfRestricted(profile);
    if (restricted) return restricted;

    // 2. Build context strings
    const dietaryPrefs = userContext?.dietaryPreferences?.length
      ? `Dietary Preferences: ${userContext.dietaryPreferences.join(", ")}. ALWAYS respect these preferences in every suggestion.`
      : "";

    // Tastes are a SOFT signal and deliberately separate from dietaryPrefs —
    // see lib/taste-prompt.ts for why merging them corrupts the strict filter.
    const tastes = tastesLine(userContext?.favoriteCuisines);
    // Also soft, and also separate — see goalLine in lib/taste-prompt.ts.
    const goal = goalLine(userContext?.weightGoal);

    const locationStr = userContext?.location
      ? `${userContext.location.lat}, ${userContext.location.lng}`
      : "Unknown";

    const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

    // 3. Determine which model to use
    let model;
    let usedBYOK = false;

    if (apiKey && provider) {
      // BYOK path — user provided their own key
      usedBYOK = true;
      model = getModel(provider as Provider, apiKey);
    } else {
      // Free tier path — check rate limit first
      const usage = await checkAndIncrementUsage(user.id);

      if (!usage.allowed) {
        return new Response(
          JSON.stringify({
            error: "rate_limit_exceeded",
            needsKey: true,
            remaining: 0,
            message: "Daily limit reached. Add your API key to continue.",
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      model = getServerModel();
    }

    // 4. Stream the response (AI SDK 7 UI message stream). Only user and
    // assistant turns are forwarded — see lib/ai-messages.
    const result = streamText({
      model,
      instructions: systemPrompt(userName, locationStr, dietaryPrefs, tastes, goal, await getServerPartners()),
      messages: await toModelMessages(messages),
      // Model errors arrive in the stream (not as a throw) since AI SDK 4.
      onError: ({ error }) => {
        console.error("chat: model stream failed:", error instanceof Error ? error.message.slice(0, 300) : error);
      },
    });

    // 5. If BYOK, pass usage info in headers so client can update badge
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: () => "Bo couldn't reach the AI model just now. Please try again in a moment.",
      }),
      headers: usedBYOK ? { "X-Usage-BYOK": "true" } : undefined,
    });
  } catch (error) {
    // Log without apiKey (already stripped above)
    console.error("Chat API error:", safeBody, error instanceof Error ? error.message : error);

    // Handle provider-specific errors for BYOK
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const isAuthError =
      errMsg.includes("401") ||
      errMsg.includes("invalid_api_key") ||
      errMsg.includes("authentication") ||
      errMsg.toLowerCase().includes("unauthorized");

    if (apiKey && isAuthError) {
      return new Response(
        JSON.stringify({
          error: "invalid_key",
          provider: provider || "unknown",
          message: `Your ${provider || "API"} key is invalid or has insufficient quota. Please check your key and try again.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Failed to process request", message: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
