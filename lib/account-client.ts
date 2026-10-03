/**
 * Client-side account actions shared by web WF11 and mobile F10, so the two
 * platforms cannot disagree about what gets exported or what gets wiped.
 *
 * LOCAL DATA. A lot of this product lives only in the browser: saved recipes,
 * the meal plan, local meal logs, goals, diet/tastes/goal, Bo conversation
 * threads and grocery-send history. The server cannot see or delete any of it,
 * so this file is the only place that can.
 *
 * KEY PREFIXES — there are TWO, and that matters. Most keys are `crave_*`, but
 * Bo's conversation threads and grocery history are `meshi_*`
 * (lib/history-store.ts). A wipe that matched only `crave_*` would leave the
 * user's own chat history behind after they "deleted their account". Matching
 * by prefix rather than a fixed list also covers keys added later.
 */

import { getFavorites, getMealLogs, getMealPlan, getNutritionGoals } from "@/lib/storage";
import { getWeightGoal } from "@/lib/preferences";
import { loggingStreak } from "@/lib/nutrition";

const PREFIXES = ["crave_", "meshi_"];
/** A device setting, not personal data — survives so the next screen isn't a flash of the wrong theme. */
const KEEP = new Set(["crave_theme"]);

function readJson(key: string): unknown {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export interface AccountSummary {
  email: string | null;
  signInProvider: string | null;
  pass: { provider: "razorpay" | "stripe"; recurring: boolean; endsAt: string | null; daysLeft: number | null } | null;
  chatDailyLimit: number | null;
  isAdmin: boolean;
  storeConnections: number;
  serverMealLogs: number;
}

export async function fetchAccountSummary(): Promise<AccountSummary | null> {
  try {
    const res = await fetch("/api/account", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AccountSummary;
  } catch {
    return null;
  }
}

/** Counts for the "what goes" list — real numbers from this device. */
export function deviceCounts() {
  const logs = getMealLogs();
  return {
    savedRecipes: getFavorites().filter((f) => f.type === "recipe").length,
    savedPlaces: getFavorites().filter((f) => f.type === "restaurant").length,
    mealLogs: logs.length,
    streak: loggingStreak(logs),
  };
}

/** Everything this browser holds for the user — never the BYOK key. */
function localPayload() {
  return {
    favorites: getFavorites(),
    mealPlan: getMealPlan(),
    mealLogs: getMealLogs(),
    nutritionGoals: getNutritionGoals(),
    weightGoal: getWeightGoal(),
    dietaryPreferences: readJson("crave_dietaryPreferences") ?? [],
    favoriteCuisines: readJson("crave_favoriteCuisines") ?? [],
    conversations: readJson("meshi_conversations") ?? [],
    groceryRuns: readJson("meshi_grocery_runs") ?? [],
    // crave_byok_key is deliberately absent: an export is not the place to
    // hand out a live API credential.
  };
}

export interface ExportFile {
  url: string;
  filename: string;
  bytes: number;
  preparedAt: Date;
}

/** Build the export in one request (see app/api/account/export for why). */
export async function requestExport(): Promise<ExportFile> {
  const res = await fetch("/api/account/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ local: localPayload() }),
  });
  if (!res.ok) throw new Error(`export_failed_${res.status}`);
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(cd)?.[1] ?? "meshi-export.zip";
  return { url: URL.createObjectURL(blob), filename, bytes: blob.size, preparedAt: new Date() };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type DeleteResult =
  | { ok: true; steps: { id: string; ok: boolean }[] }
  | { ok: false; error: string; pass?: AccountSummary["pass"] };

export async function deleteAccountRequest(acknowledgePass: boolean): Promise<DeleteResult> {
  try {
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE", acknowledgePass }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) return { ok: true, steps: body.steps ?? [] };
    return { ok: false, error: body.error ?? `http_${res.status}`, pass: body.pass };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Wipe this device's copy of the user's data. Returns how many keys went. */
export function clearLocalAccountData(): number {
  let removed = 0;
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && !KEEP.has(k) && PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
      }
      for (const k of keys) {
        storage.removeItem(k);
        removed++;
      }
    } catch {
      /* a storage the browser refuses to touch has nothing we can clear */
    }
  }
  return removed;
}

/** "ends 11 Oct 2026" style. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The "what goes" list for the confirm and progress screens — ONE source for
 * web and mobile, so the two can never describe a deletion differently.
 * `phase` is the real piece of work that removes the item: the server request
 * (and the database cascade it triggers), the local wipe, or signing out.
 * Each UI maps `key` to its own icon.
 */
export type DeletionPhase = "server" | "local" | "signout";
export interface DeletionRow {
  key: "billing" | "recipes" | "logs" | "goals" | "prefs" | "chats" | "notif" | "store" | "signout";
  label: string;
  sub?: string;
  phase: DeletionPhase;
}

export function buildDeletionRows(
  summary: AccountSummary | null,
  counts: ReturnType<typeof deviceCounts>,
  opts: { includeSignOut?: boolean } = {}
): DeletionRow[] {
  const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
  const rows: DeletionRow[] = [];
  if (summary?.pass?.recurring) {
    rows.push({ key: "billing", label: "meshi+ subscription", sub: "Cancelled — you won’t be charged again", phase: "server" });
  }
  rows.push(
    {
      key: "recipes",
      label: "Saved recipes",
      sub:
        `${counts.savedRecipes} saved here` +
        (counts.savedPlaces ? ` · ${plural(counts.savedPlaces, "saved place")}` : ""),
      phase: "local",
    },
    {
      key: "logs",
      label: "Meal logs and streak",
      sub:
        plural(Math.max(counts.mealLogs, summary?.serverMealLogs ?? 0), "logged meal") +
        (counts.streak > 0 ? ` · your ${counts.streak}-day streak ends` : ""),
      phase: "server",
    },
    { key: "goals", label: "Nutrition goals", sub: "Calorie target and weight goal", phase: "server" },
    { key: "prefs", label: "Dietary preferences", sub: "Diet, allergies and cuisine tastes", phase: "local" },
    { key: "chats", label: "Bo conversations", sub: "Chat history kept on this device", phase: "local" },
    { key: "notif", label: "Notification subscriptions", sub: "Push and WhatsApp nudges stop", phase: "server" }
  );
  if ((summary?.storeConnections ?? 0) > 0) {
    rows.push({
      key: "store",
      label: "Connected store account",
      sub: "Swiggy is disconnected from meshi. Your Swiggy account itself is not touched.",
      phase: "server",
    });
  }
  if (opts.includeSignOut) rows.push({ key: "signout", label: "Signing you out", phase: "signout" });
  return rows;
}

/**
 * Run the deletion in its three real phases, reporting each as it finishes.
 * Never wipes local data unless the server confirmed the account is gone —
 * a failed or refused delete must leave this device exactly as it was.
 */
export async function runDeletion(
  acknowledgePass: boolean,
  signOut: () => Promise<void>,
  onPhase: (done: DeletionPhase[]) => void
): Promise<DeleteResult> {
  const result = await deleteAccountRequest(acknowledgePass);
  if (!result.ok) return result;
  onPhase(["server"]);
  clearLocalAccountData();
  onPhase(["server", "local"]);
  try {
    await signOut();
  } catch {
    // The auth user no longer exists, so the server may refuse the sign-out
    // call. The local session and data are already gone; carry on.
  }
  onPhase(["server", "local", "signout"]);
  return result;
}

/** User-facing copy for a failed delete. Says plainly whether anything changed. */
export function deletionErrorCopy(error: string): string {
  if (error === "billing_not_stopped")
    return "We couldn’t cancel your meshi+ subscription, so nothing was deleted and you are still subscribed. Please try again in a minute.";
  if (error === "network")
    return "Couldn’t reach meshi. Nothing was confirmed as deleted — check your connection and try again.";
  return "Something went wrong and your account was not fully deleted. Please try again.";
}
