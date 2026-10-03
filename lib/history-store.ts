/**
 * history-store — short-retention, client-side histories.
 *
 * Backs three features that all want the same shape: "keep the last N days of
 * X, then forget it".
 *
 *   conversations   3 days   (w8a — the Bo history rail)
 *   groceries       7 days   (the Groceries page's recent hand-offs)
 *   recipes         none     (the saved shelf is explicit, not time-boxed)
 *
 * WHY AN INTERFACE AND NOT JUST localStorage CALLS.
 * The storage decision was "localStorage now, Supabase later". Screens talk to
 * `HistoryStore`, never to `localStorage` directly, so a Supabase-backed
 * implementation can be dropped in without touching a single component. Keep it
 * that way — the moment a screen reads `localStorage` itself, that swap stops
 * being free.
 *
 * CONSEQUENCE OF THE CURRENT BACKEND, and it is user-visible: this is
 * per-device and per-browser. It does not sync, and it is gone when site data
 * is cleared. The w8a artboard's "History synced · kept 90 days" line is
 * therefore NOT rendered — it would be two untrue claims in one sentence.
 *
 * Retention is applied ON READ, not by a timer. A background sweep cannot run
 * when the tab is closed, which is exactly when most of the ageing happens, so
 * a timer would give a false sense of deletion. Pruning on read means a stale
 * entry can sit in storage past its window but is never returned or shown —
 * and `list()` writes the pruned set back, so it self-heals on first use.
 */

export interface HistoryEntry {
  /** Stable id. Callers may supply one; `add` generates it otherwise. */
  id: string;
  /** ISO timestamp. The only field retention reads. */
  at: string;
}

export interface HistoryStore<T extends HistoryEntry> {
  /** Entries inside the retention window, newest first. Prunes as a side effect. */
  list(): T[];
  /** Prepend an entry, returning the stored record (with id/at filled in). */
  add(entry: Omit<T, "id" | "at"> & Partial<Pick<T, "id" | "at">>): T;
  /** Remove one entry by id. */
  remove(id: string): void;
  /** Drop everything under this key. */
  clear(): void;
}

export interface HistoryStoreOptions {
  /** localStorage key. */
  key: string;
  /**
   * Days to keep. Omit for "keep forever" (the saved-recipes shelf), which
   * still caps by `max`.
   */
  retentionDays?: number;
  /**
   * Hard cap on entries, applied after retention. Guards the 5MB localStorage
   * budget — conversations carry full message arrays and are the heaviest
   * thing this stores.
   */
  max?: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** True when `at` is within `retentionDays` of now. Unparseable dates are dropped. */
function withinWindow(at: string, retentionDays?: number): boolean {
  if (retentionDays === undefined) return true;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < retentionDays * 24 * 60 * 60 * 1000;
}

export function createLocalHistoryStore<T extends HistoryEntry>(
  options: HistoryStoreOptions
): HistoryStore<T> {
  const { key, retentionDays, max = 50 } = options;

  function readRaw(): T[] {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) return [];
      const parsed: unknown = JSON.parse(stored);
      // Anything could be under this key — another tab, an older build, a user
      // editing it by hand. Only keep records this store can actually reason
      // about, which means an id and a timestamp.
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (e): e is T =>
          typeof e === "object" && e !== null &&
          typeof (e as HistoryEntry).id === "string" &&
          typeof (e as HistoryEntry).at === "string"
      );
    } catch {
      return [];
    }
  }

  function writeRaw(entries: T[]): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(entries));
    } catch {
      // Quota exceeded. Same degradation ladder lib/storage.ts uses for meal
      // logs: halve and retry rather than throwing into a render.
      const trimmed = entries.slice(0, Math.max(1, Math.floor(entries.length / 2)));
      try {
        window.localStorage.setItem(key, JSON.stringify(trimmed));
      } catch {
        // Give up rather than crash the UI.
      }
    }
  }

  return {
    list(): T[] {
      const all = readRaw();
      const kept = all
        .filter((e) => withinWindow(e.at, retentionDays))
        .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
        .slice(0, max);
      // Self-heal: persist the pruned set so expired entries actually leave
      // storage rather than lingering invisibly forever.
      if (kept.length !== all.length) writeRaw(kept);
      return kept;
    },

    add(entry): T {
      const record = {
        ...entry,
        id: entry.id ?? makeId(),
        at: entry.at ?? nowIso(),
      } as T;
      // De-dupe by id so re-saving an open conversation updates in place
      // instead of stacking a new row on every keystroke-settle.
      const rest = readRaw().filter((e) => e.id !== record.id);
      const next = [record, ...rest]
        .filter((e) => withinWindow(e.at, retentionDays))
        .slice(0, max);
      writeRaw(next);
      return record;
    },

    remove(id: string): void {
      writeRaw(readRaw().filter((e) => e.id !== id));
    },

    clear(): void {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing useful to do.
      }
    },
  };
}
