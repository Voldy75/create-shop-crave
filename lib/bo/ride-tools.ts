/**
 * Bo's ride hand-off: one internal tool, `meshi_ride__show_ride`.
 *
 * The chat renders the tool's output as a ride card
 * (components/bo/BoRideCard.tsx) whose button opens Uber with the destination
 * pre-filled. The user chooses the ride, confirms it and pays inside Uber. Bo
 * never requests a ride: Uber's Ride Request API needs Uber's approval and
 * this is a link, so nothing here touches money and no approval is needed
 * (see "Uber Ride Request" in handoff.md).
 *
 * The model never supplies a URL: the card builds it from these fields with
 * lib/deeplinks.ts. Coordinates are only passed on when they appear in a
 * tool result of this conversation (Swiggy's, in practice), so a pin the model
 * made up cannot reach Uber. Without them the card links by name and address.
 */

import { jsonSchema, tool } from "ai";
import { addTaskEvent } from "@/lib/bo/tasks";

export const SHOW_RIDE = "meshi_ride__show_ride";

export interface RideDestination {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

/** Added to a successful book_table result: a prompt line alone was not
 *  enough, Gemini offered a ride in text instead of showing the card. */
export const AFTER_BOOKING = `If the table is confirmed, call ${SHOW_RIDE} now with the restaurant's name and address. Do not ask first.`;

/** Gemini-safe: plain types, no unions, no formats. */
const RIDE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "The place, e.g. the restaurant's name." },
    address: { type: "string", description: "Its full address with area and city, exactly as a tool result or the user gave it." },
    latitude: { type: "number", description: "Only when a Swiggy result gives it. Never guess." },
    longitude: { type: "number", description: "Only when a Swiggy result gives it. Never guess." },
  },
  required: ["name"],
} as const;

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** A precise coordinate that sits inside the conversation's tool results. */
function seen(v: unknown, min: number, max: number, results: string): v is number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) return false;
  const s = String(v);
  return /\.\d{3}/.test(s) && results.includes(s);
}

/** The tool's arguments as a destination, or null with no place to go to. */
export function rideDestination(args: unknown, messages: ReadonlyArray<{ role: string }>): RideDestination | null {
  const a = (args ?? {}) as Record<string, unknown>;
  const name = text(a.name, 120);
  if (!name) return null;
  const address = text(a.address, 300);
  const results = JSON.stringify(messages.filter((m) => m.role === "tool"));
  const pinned = seen(a.latitude, -90, 90, results) && seen(a.longitude, -180, 180, results);
  return {
    name,
    ...(address ? { address } : {}),
    ...(pinned ? { lat: a.latitude as number, lng: a.longitude as number } : {}),
  };
}

export function buildRideTools(ctx: { userId: string; taskId: string }) {
  return {
    [SHOW_RIDE]: tool({
      description:
        "[ride] Show the user a card that opens Uber with this destination pre-filled. Use it after a Dineout booking and whenever the user asks for a ride, cab or taxi. The user confirms the ride and pays inside Uber; this does not book a ride.",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: jsonSchema(RIDE_SCHEMA as any),
      execute: async (args: unknown, { messages }) => {
        const destination = rideDestination(args, messages);
        if (!destination) return { shown: false, note: "No destination. Ask the user where they want to go." };
        await addTaskEvent(ctx.userId, ctx.taskId, "tool_result", { tool: "ride.show_ride", summary: "ok" });
        return {
          shown: true,
          destination,
          note: `The ride card for ${destination.name} is on screen. No ride is booked: the user confirms and pays in Uber. Say one short line.`,
        };
      },
    }),
  };
}
