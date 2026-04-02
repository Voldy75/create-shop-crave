import { streamText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { checkAndIncrementUsage } from "@/lib/rate-limit";
import { getModel, getServerModel, type Provider } from "@/lib/providers";

export const maxDuration = 30;

const systemPrompt = (userName: string, location: string, dietaryPrefs: string) => `
You are a helpful AI food companion. Your goal is to help the user decide what to eat based on their input (Dish Type) and optional Occasion.

User Context:
Name: ${userName}
Location: ${location}
${dietaryPrefs}

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
          { "platform": "blinkit", "label": "Blinkit", "url": "https://blinkit.com/s/?q=ITEM_NAME" },
          { "platform": "swiggy_instamart", "label": "Swiggy Instamart", "url": "https://www.swiggy.com/instamart/search?custom_back=true&query=ITEM_NAME" },
          { "platform": "instacart", "label": "Instacart", "url": "https://www.instacart.com/store/search/ITEM_NAME" }
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
        "zomatoUrl": "https://www.zomato.com/...",
        "swiggyUrl": "https://www.swiggy.com/..."
      }
    ]
  }
}
\`\`\`

IMPORTANT RULES:
- If the user's input is vague, ask for clarification (type: "clarification").
- If the user specifically asks to cook, provide "recipe".
- If the user specifically asks to go out, provide "restaurant".
- If it's ambiguous, suggest "both" or ask.
- For "ingredients", simulate realistic prices in INR. For EACH ingredient, generate a "links" array with ALL THREE platforms (Blinkit, Swiggy Instamart, Instacart) using the URL templates shown above. Replace ITEM_NAME with the URL-encoded ingredient name.
- For "restaurants", suggest 3-5 popular real restaurants in the user's city (if known from their coordinates) or general famous chains. Include approximate lat/lng coordinates for each restaurant. Include the cuisine type.
- Generate search URLs for Zomato and Swiggy for each restaurant.
- Include "dishName" in restaurantSuggestion so the app can build delivery order links.
- Include nutritionEstimate with approximate per-serving values.
- Include prepTime, servings, and dietaryTags for every recipe.
- Keep the conversational part friendly and engaging.
`;

export async function POST(req: Request) {
  // Strip apiKey from body BEFORE any error handling to prevent log exposure
  const rawBody = await req.json();
  const { apiKey: _stripped, ...safeBody } = rawBody;
  const { messages, userContext, provider, apiKey } = { ...rawBody };

  try {
    // 1. Verify Supabase session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Build context strings
    const dietaryPrefs = userContext?.dietaryPreferences?.length
      ? `Dietary Preferences: ${userContext.dietaryPreferences.join(", ")}. ALWAYS respect these preferences in every suggestion.`
      : "";

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

    // 4. Stream the response
    const result = await streamText({
      model,
      system: systemPrompt(userName, locationStr, dietaryPrefs),
      messages,
    });

    const response = result.toDataStreamResponse();

    // 5. If BYOK, pass usage info in headers so client can update badge
    if (usedBYOK) {
      response.headers.set("X-Usage-BYOK", "true");
    }

    return response;
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
