import { createClient } from "@/lib/supabase/server";
import { partnersFrom, type Partners, LAUNCH_DEFAULTS } from "@/lib/partners";

/**
 * Server-side flag read, for route handlers that must obey the same switches
 * as the UI (the chat prompt's shopping links, billing options).
 *
 * Same source and RLS path as GET /api/flags (anon client; feature_flags is
 * world-readable config). Cached per warm instance for 60s — the same window
 * the limits cache uses — so a toggle in Admin → Flags reaches the server
 * within a minute without a query per request. A failed read falls back to
 * LAUNCH_DEFAULTS (everything switchable off), never to "on".
 */

const TTL_MS = 60_000;
let cache: { at: number; partners: Partners } | null = null;

export async function getServerPartners(): Promise<Partners> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.partners;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("feature_flags").select("id, enabled");
    if (error) throw error;
    const map: Record<string, boolean> = {};
    for (const f of data ?? []) map[f.id as string] = f.enabled === true;
    const partners = partnersFrom(map);
    cache = { at: Date.now(), partners };
    return partners;
  } catch (e) {
    console.error("feature flags (server) read failed:", e instanceof Error ? e.message : e);
    return LAUNCH_DEFAULTS;
  }
}
