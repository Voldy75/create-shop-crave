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

    const systemPrompt = `
    You are a helpful AI food companion. Your goal is to help the user decide what to eat based on their input (Dish Type) and optional Occasion.
    
    User Context:
    Name: ${userContext?.userName || "User"}
    Location: ${userContext?.location ? `${userContext.location.lat}, ${userContext.location.lng}` : "Unknown"}

    You should analyze the user's request and provide a response in a structured JSON format inside a code block, followed by a brief conversational message.
    
    The JSON structure should be:
    \`\`\`json
    {
      "type": "recipe" | "restaurant" | "both" | "clarification",
      "recipe": {
        "name": "Dish Name",
        "description": "Brief description",
        "ingredients": [
          { "item": "Ingredient 1", "price": "₹XX", "link": "https://blinkit.com/s/?q=..." },
          ...
        ],
        "instructions": ["Step 1", "Step 2", ...]
      },
      "restaurantSuggestion": {
        "query": "Search query for Google Places API (for the map)",
        "reason": "Why this is good for the occasion",
        "restaurants": [
          {
            "name": "Restaurant Name",
            "rating": "4.5",
            "priceRange": "₹₹₹",
            "area": "Location/Area",
            "zomatoUrl": "https://www.zomato.com/...",
            "swiggyUrl": "https://www.swiggy.com/..."
          },
          ...
        ]
      }
    }
    \`\`\`

    If the user's input is vague, ask for clarification (type: "clarification").
    If the user specifically asks to cook, provide "recipe".
    If the user specifically asks to go out, provide "restaurant".
    If it's ambiguous, you can suggest "both" or ask.
    
    For "ingredients", simulate realistic prices in INR and generate search links for Blinkit (https://blinkit.com/s/?q=ITEM_NAME).
    
    For "restaurants", suggest 3-5 popular real restaurants in the user's city (if known) or general famous chains. 
    Generate search URLs for Zomato (https://www.zomato.com/city/restaurants/restaurant-name) and Swiggy (https://www.swiggy.com/search?query=restaurant-name) if exact URLs aren't known.
    
    Keep the conversational part friendly and engaging.
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
