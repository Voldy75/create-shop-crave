/**
 * conversation-history — the Bo thread list behind the w8a rail.
 *
 * RETENTION IS 3 DAYS, by product decision. Note this contradicts the w8a
 * artboard, which prints "History synced · kept 90 days" in the rail footer.
 * Neither half of that line is rendered: the window is 3 days, and the backing
 * store is localStorage, so nothing syncs. Do not copy the artboard's string
 * back in — it would be two false claims in one sentence, which is the exact
 * bug class the paywall shipped twice (see handoff.md).
 *
 * This supersedes the ChatSession block in lib/storage.ts, which defined
 * getChatSessions/saveChatSession/deleteChatSession and had ZERO callers — the
 * web chat never persisted anything. That dead code is now removed; this is
 * the live path.
 */

import { createLocalHistoryStore, type HistoryEntry } from "./history-store";

/** One stored message. Deliberately the minimum useChat needs to rehydrate. */
export interface StoredMessage {
  id: string;
  role: string;
  content: string;
}

export interface Conversation extends HistoryEntry {
  /** First user message, trimmed — what the rail row shows as its title. */
  title: string;
  /** One-line preview under the title in the rail. */
  snippet: string;
  messages: StoredMessage[];
  /** True when the thread ran in Swiggy-agent mode, so resuming restores it. */
  agentMode?: boolean;
}

/**
 * `max` is 30 rather than history-store's default 50. Conversations carry full
 * message arrays including the assistant's fenced JSON artifacts, which are by
 * far the heaviest thing in localStorage — a single recipe reply can be several
 * KB. 3-day retention usually keeps this well under the cap anyway; the cap is
 * the backstop for a heavy day.
 */
const store = createLocalHistoryStore<Conversation>({
  key: "meshi_conversations",
  retentionDays: 3,
  max: 30,
});

const MAX_TITLE = 60;
const MAX_SNIPPET = 80;

function tidy(s: string, max: number): string {
  // Strip the fenced JSON artifact before it can leak into a title or preview —
  // otherwise a recipe reply's snippet reads as a wall of `{"type":"recipe"...`.
  const withoutJson = s.replace(/```json\n[\s\S]*?\n```/g, " ").replace(/```[\s\S]*?```/g, " ");
  const flat = withoutJson.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export function listConversations(): Conversation[] {
  return store.list();
}

export function deleteConversation(id: string): void {
  store.remove(id);
}

export function clearConversations(): void {
  store.clear();
}

/**
 * Write the current thread. Called on settle, not per token — `id` is stable
 * for the life of a thread so this updates in place rather than stacking rows.
 * Returns null (and writes nothing) for a thread with no user turn yet, so an
 * empty chat never appears in the rail.
 */
export function saveConversation(input: {
  id: string;
  messages: StoredMessage[];
  agentMode?: boolean;
}): Conversation | null {
  const firstUser = input.messages.find((m) => m.role === "user");
  if (!firstUser) return null;

  const lastAssistant = [...input.messages].reverse().find((m) => m.role === "assistant");

  return store.add({
    id: input.id,
    title: tidy(firstUser.content, MAX_TITLE) || "New chat",
    snippet: lastAssistant ? tidy(lastAssistant.content, MAX_SNIPPET) : "",
    messages: input.messages,
    agentMode: input.agentMode,
  });
}

/**
 * Rail grouping. The artboard groups Pinned / Today / Earlier this week;
 * pinning is not built (nothing stores a pin flag), and with a 3-day window
 * "earlier this week" is the whole remainder — so two honest buckets.
 */
export function groupConversations(items: Conversation[]): Array<{
  label: string;
  items: Conversation[];
}> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today: Conversation[] = [];
  const earlier: Conversation[] = [];
  for (const c of items) {
    (Date.parse(c.at) >= startOfToday.getTime() ? today : earlier).push(c);
  }
  return [
    { label: "Today", items: today },
    { label: "Earlier", items: earlier },
  ].filter((g) => g.items.length > 0);
}

/** "2m" / "4h" today, weekday name ("Tue") once older — the artboard's scheme. */
export function relativeStamp(at: string): string {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (t >= startOfToday.getTime()) return `${Math.floor(mins / 60)}h`;
  return new Date(t).toLocaleDateString(undefined, { weekday: "short" });
}
