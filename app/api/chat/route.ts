import { google } from "@ai-sdk/google";
import { streamText } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!process.env.GOOGLE_AI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Google AI API key is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { messages, userContext } = await req.json();

    const dietaryPrefs = userContext?.dietaryPreferences?.length
      ? `Dietary Preferences: ${userContext.dietaryPreferences.join(", ")}. ALWAYS respect these preferences in every suggestion.`
      : "";

    const systemPrompt = `
    You are a helpful AI food companion. Your goal is to help the user decide what to eat based on their input (Dish Type) and optional Occasion.

    User Context:
    Name: ${userContext?.userName || "User"}
    Location: ${userContext?.location ? `${userContext.location.lat}, ${userContext.location.lng}` : "Unknown"}
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

    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Error in chat API:", error);
    const message = error instanceof Error ? error.message : "Failed to process request";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
