/**
 * grocery-history — what was sent to a store, kept 7 days.
 *
 * ITEM 6 asked the groceries page to "maintain record of all the groceries
 * bought for at least 7 days", resetting after.
 *
 * READ THE NAMING CAREFULLY, because it is the honest part: this records what
 * was HANDED OFF to a store, not what was bought. No platform reports a
 * completed order back to this app — there is no orders table and no webhook —
 * so we know the user opened Instamart with a list, and nothing more. Every
 * label in the UI says "sent", never "bought" or "delivered". Calling it a
 * purchase history would be the same fabrication as w4a's "Bo places & tracks
 * this order for you", which /cart already declined to build.
 *
 * Retention is 7 days, pruned on read by lib/history-store.
 */

import { createLocalHistoryStore, type HistoryEntry } from "./history-store";
import type { Ingredient } from "./types";

/** Where a list was sent. Matches the three lib/deeplinks builders. */
export type GroceryStore = "instamart" | "blinkit" | "instacart" | "agent";

export const STORE_LABELS: Record<GroceryStore, string> = {
  instamart: "Swiggy Instamart",
  blinkit: "Blinkit",
  instacart: "Instacart",
  agent: "Bo (Instamart agent)",
};

export interface GroceryRun extends HistoryEntry {
  /** The recipe the list came from, when it came from one. */
  recipeName: string | null;
  items: Ingredient[];
  /** Estimated rupee total at the moment it was sent. */
  subtotal: number;
  store: GroceryStore;
}

const store = createLocalHistoryStore<GroceryRun>({
  key: "meshi_grocery_runs",
  retentionDays: 7,
  max: 40,
});

export function listGroceryRuns(): GroceryRun[] {
  return store.list();
}

export function recordGroceryRun(run: {
  recipeName: string | null;
  items: Ingredient[];
  subtotal: number;
  store: GroceryStore;
}): GroceryRun | null {
  // An empty hand-off is not a run — nothing was sent.
  if (run.items.length === 0) return null;
  return store.add(run);
}

export function clearGroceryRuns(): void {
  store.clear();
}

/** "Today" / "Yesterday" / "Tue 12 Aug" — the window is only a week. */
export function runDayLabel(at: string): string {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  if (t >= startOfToday.getTime()) return "Today";
  if (t >= startOfToday.getTime() - dayMs) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
