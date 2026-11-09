import { createClient } from "@/lib/supabase/server";
import { partnersFrom, type Partners, LAUNCH_DEFAULTS } from "@/lib/partners";

/**
 * Server-side flag read, for route handlers that must obey the same switches
 * as the UI (the chat prompt's shopping links, billing options, bo_agent).
 *
 * Same source and RLS path as GET /api/flags (anon client; feature_flags is
 * world-readable config). Cached per warm instance for 60s — the same window
 * the limits cache uses — so a toggle in Admin → Flags reaches the server
 * within a minute without a query per request. A failed read falls back to
 * LAUNCH_DEFAULTS / "off" (everything switchable off), never to "on".
 */

const TTL_MS = 60_000;
let cache: { at: number; flags: Record<string, boolean> } | null = null;

async function loadServerFlags(): Promise<Record<string, boolean> | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.flags;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("feature_flags").select("id, enabled");
    if (error) throw error;
    const map: Record<string, boolean> = {};
    for (const f of data ?? []) map[f.id as string] = f.enabled === true;
    cache = { at: Date.now(), flags: map };
    return map;
  } catch (e) {
    console.error("feature flags (server) read failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function getServerPartners(): Promise<Partners> {
  const flags = await loadServerFlags();
  return flags ? partnersFrom(flags) : LAUNCH_DEFAULTS;
}

/** One flag, fail-closed: a missing row or a failed read is "off". */
export async function getServerFlag(id: string): Promise<boolean> {
  const flags = await loadServerFlags();
  return flags?.[id] === true;
}
