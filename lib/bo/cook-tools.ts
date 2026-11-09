/**
 * Bo's "cook it yourself" option: one internal tool, `meshi_cook__show_recipe`.
 *
 * The recipe IS the tool input — the model writes it as the call's
 * arguments, the chat renders those arguments as a recipe card
 * (components/bo/BoRecipeCard.tsx), and execute only records the step. So
 * cooking costs no extra model call, and the recipe stays in the thread for
 * the next turn ("get the ingredients" → Instamart).
 *
 * The card's buttons act on the user's device — Start cooking, Add to
 * today's plan (localStorage planner), Get the ingredients (a new message to
 * Bo, which then shops on Instamart with the usual Approval card). Nothing
 * here touches money, so no approval.
 */

import { jsonSchema, tool } from "ai";
import { addTaskEvent, updateTask } from "@/lib/bo/tasks";

export const SHOW_RECIPE = "meshi_cook__show_recipe";

/** Gemini-safe: plain types, no unions, no formats. */
const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Dish name." },
    description: { type: "string", description: "One or two sentences: why this dish, for this user, now." },
    prepTime: { type: "string", description: 'Total time, e.g. "25 min".' },
    servings: { type: "integer" },
    dietaryTags: { type: "array", items: { type: "string" }, description: 'e.g. "vegetarian", "high protein".' },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          quantity: { type: "string", description: 'e.g. "2 cups", "200 g".' },
          price: { type: "string", description: 'Rough Indian retail cost of that quantity, e.g. "₹40".' },
        },
        required: ["item", "quantity", "price"],
      },
    },
    instructions: { type: "array", items: { type: "string" }, description: "Numbered steps, one action each." },
    nutritionEstimate: {
      type: "object",
      description: "Per serving.",
      properties: {
        calories: { type: "string" },
        protein: { type: "string" },
        carbs: { type: "string" },
        fat: { type: "string" },
      },
      required: ["calories", "protein", "carbs", "fat"],
    },
  },
  required: ["name", "description", "servings", "ingredients", "instructions"],
} as const;

export function buildCookTools(ctx: { userId: string; taskId: string }) {
  return {
    [SHOW_RECIPE]: tool({
      description:
        "[cook] Show the user a recipe card for a dish they can cook at home. Use it when cooking is the best fit. Write the complete recipe as the arguments; it must respect the user's diet and allergies. The card has Start cooking, Add to plan and Get ingredients buttons — do not repeat the recipe in text.",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: jsonSchema(RECIPE_SCHEMA as any),
      execute: async (args: unknown) => {
        const name = typeof (args as { name?: unknown })?.name === "string" ? (args as { name: string }).name : "";
        await addTaskEvent(ctx.userId, ctx.taskId, "tool_result", { tool: "cook.show_recipe", summary: "ok" });
        await updateTask(ctx.userId, ctx.taskId, { mode: "cook" }).catch(() => {});
        return {
          shown: true,
          note: `The recipe card for ${name || "the dish"} is on screen. Say one short line; if the user wants the ingredients, shop them on Instamart.`,
        };
      },
    }),
  };
}
