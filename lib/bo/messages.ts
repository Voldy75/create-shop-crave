/**
 * Client UIMessages → model messages for Bo, keeping tool approvals intact.
 *
 * lib/ai-messages.ts (chat, /api/agent) converts with
 * ignoreIncompleteToolCalls, which would also drop the approved-but-not-yet-
 * run tool call Bo needs to continue after the user's tap. Here instead:
 *   - only user/assistant turns pass (no injected system messages);
 *   - an approval the user ANSWERED is kept, wherever it is;
 *   - an approval left unanswered in an earlier turn (the user typed
 *     something else instead of tapping) is dropped — it can no longer run;
 *   - half-streamed tool inputs are dropped.
 * The SDK then verifies each kept approval's signature before running it.
 */

import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";

const MAX_MESSAGES = 60;
const DROP_STATES = new Set(["input-streaming", "input-available"]);

type Part = UIMessage["parts"][number] & { state?: string };

export function lastUserText(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  for (let i = raw.length - 1; i >= 0; i--) {
    const m = raw[i] as { role?: unknown; parts?: unknown };
    if (m?.role !== "user" || !Array.isArray(m.parts)) continue;
    return (m.parts as Part[])
      .filter((p): p is Part & { type: "text"; text: string } => p.type === "text" && typeof (p as { text?: unknown }).text === "string")
      .map((p) => p.text)
      .join(" ")
      .trim();
  }
  return "";
}

/**
 * Tool call ids the user just rejected on an Approval card, for the task
 * timeline. Only the last message: earlier answers were logged on their turn.
 */
export function rejectedApprovals(raw: unknown): { toolCallId: string; tool: string | null }[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const last = raw[raw.length - 1] as { role?: unknown; parts?: unknown };
  if (last?.role !== "assistant" || !Array.isArray(last.parts)) return [];
  return (last.parts as Array<Part & { toolCallId?: string; toolName?: string; approval?: { approved?: boolean } }>)
    .filter((p) => p.state === "approval-responded" && p.approval?.approved === false && !!p.toolCallId)
    .map((p) => {
      // "tool-swiggy_im__checkout" → "im.checkout", the key events use.
      const full = p.type === "dynamic-tool" ? p.toolName ?? "" : p.type.startsWith("tool-") ? p.type.slice(5) : "";
      const m = full.match(/^swiggy_(\w+?)__(\w+)$/);
      return { toolCallId: p.toolCallId as string, tool: m ? `${m[1]}.${m[2]}` : null };
    });
}

/** The most recent tool Bo called in this thread ("swiggy_food__search_menu"),
 *  so a new turn starts in the service the task is already working in. */
export function lastToolName(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (let i = raw.length - 1; i >= 0; i--) {
    const parts = (raw[i] as { parts?: unknown })?.parts;
    if (!Array.isArray(parts)) continue;
    for (let j = parts.length - 1; j >= 0; j--) {
      const p = parts[j] as { type?: unknown; toolName?: unknown };
      if (typeof p?.type !== "string") continue;
      if (p.type === "dynamic-tool" && typeof p.toolName === "string") return p.toolName;
      if (p.type.startsWith("tool-")) return p.type.slice(5);
    }
  }
  return null;
}

export async function boModelMessages(raw: unknown): Promise<ModelMessage[]> {
  if (!Array.isArray(raw)) return [];
  const turns = raw
    .filter(
      (m): m is { role: "user" | "assistant"; parts: Part[] } =>
        !!m &&
        typeof m === "object" &&
        ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant") &&
        Array.isArray((m as { parts?: unknown }).parts)
    )
    .slice(-MAX_MESSAGES);

  const ui: Array<Omit<UIMessage, "id">> = turns.map((m, i) => {
    const last = i === turns.length - 1;
    const parts = m.parts.filter((p) => {
      if (p.state && DROP_STATES.has(p.state)) return false;
      if (p.state === "approval-requested" && !last) return false;
      return true;
    });
    return { role: m.role, parts };
  });

  return convertToModelMessages(ui.filter((m) => m.parts.length > 0));
}
