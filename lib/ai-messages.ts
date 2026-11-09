import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";

/**
 * Chat request messages → model messages, for the AI SDK 7 routes.
 *
 * Clients on AI SDK 7 send UIMessages (`parts: [{ type: "text", text }]`).
 * During a deploy an already-open tab can still send the AI SDK 3 shape
 * (`{ role, content: string }`), so both are accepted. Only user and
 * assistant turns are forwarded — a client cannot inject a system message.
 */
export async function toModelMessages(raw: unknown): Promise<ModelMessage[]> {
  if (!Array.isArray(raw)) return [];
  const turns = raw.filter(
    (m): m is { role: "user" | "assistant" } & Record<string, unknown> =>
      !!m && typeof m === "object" && ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant")
  );

  const ui: Array<Omit<UIMessage, "id">> = turns.map((m) => {
    if (Array.isArray(m.parts)) return { role: m.role, parts: m.parts as UIMessage["parts"] };
    const text = typeof m.content === "string" ? m.content : "";
    return { role: m.role, parts: [{ type: "text", text }] };
  });

  return convertToModelMessages(ui, { ignoreIncompleteToolCalls: true });
}

/** Plain text of a UIMessage (its text parts joined), for screens that render text. */
export function messageText(m: { parts?: ReadonlyArray<{ type: string; text?: string }>; content?: unknown }): string {
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
  }
  return typeof m.content === "string" ? m.content : "";
}

/**
 * Human text for a chat failure. The SDK puts the response body in
 * err.message: our routes send {error, message} JSON, an in-stream failure
 * carries our own friendly sentence, and anything else (HTML error pages,
 * raw JSON without a message) gets generic copy — never shown verbatim.
 */
export function chatErrorText(raw: string): string {
  const msg = (raw || "").trim();
  try {
    const parsed = JSON.parse(msg) as { error?: unknown; message?: unknown };
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.message === "string" && parsed.message) return parsed.message;
      if (parsed.error === "Unauthorized") return "Sign in to chat with Bo.";
      return "Something went wrong. Please try again.";
    }
  } catch {
    // not JSON
  }
  if (msg && msg.length < 200 && !msg.startsWith("<") && !msg.startsWith("{") && !msg.startsWith("[")) return msg;
  return "Something went wrong. Please try again.";
}
