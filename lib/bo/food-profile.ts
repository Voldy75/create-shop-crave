/**
 * Bo's server-side food profile, and the consent that gates it (DPDP Act 2023
 * + Rules 2025). Tables: scripts/sql/food-profile.sql.
 *
 * THE RULE: nothing is stored server-side until the user has opted in to the
 * current notice and confirmed they are 18 or over. The profile row IS the
 * consent — it cannot exist without consent_version and age_confirmed — so a
 * write without consent has nowhere to go. Withdrawal deletes the profile and
 * the user's task history in the same call; Bo keeps working statelessly from
 * this browser's own preferences.
 *
 * Every grant and withdrawal is appended to consent_events, so we can show
 * what a user agreed to and when.
 *
 * Service-role only. Callers (app/api/bo/*) authenticate the user first.
 */

import { createServiceClient } from "@/lib/supabase/server";
import type { WeightGoal } from "@/lib/types";

/** Bump when the notice text changes; users on an older version are asked again. */
export const BO_NOTICE_VERSION = "2026-10-25";

export type ConsentPurpose = "bo_profile" | "bo_nudges";
export type Platform = "web" | "ios" | "android";
export type BudgetBand = "low" | "mid" | "high";

export interface FoodProfile {
  diets: string[];
  allergies: string[];
  tastes: string[];
  goal: WeightGoal | null;
  householdSize: number | null;
  budgetBand: BudgetBand | null;
  swiggyAddressId: string | null;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  timezone: string;
}

export interface ConsentState {
  profile: boolean;
  nudges: boolean;
  /** The notice version the user agreed to, or null. */
  version: string | null;
  /** True when they agreed to an older notice and must be asked again. */
  stale: boolean;
  consentedAt: string | null;
}

interface ProfileRow {
  diets: string[];
  allergies: string[];
  tastes: string[];
  goal: WeightGoal | null;
  household_size: number | null;
  budget_band: BudgetBand | null;
  swiggy_address_id: string | null;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  timezone: string;
  consent_version: string;
  consented_at: string;
  nudges_consented_at: string | null;
}

const COLUMNS =
  "diets, allergies, tastes, goal, household_size, budget_band, swiggy_address_id, quiet_hours_start, quiet_hours_end, timezone, consent_version, consented_at, nudges_consented_at";

function rowToProfile(r: ProfileRow): FoodProfile {
  return {
    diets: r.diets ?? [],
    allergies: r.allergies ?? [],
    tastes: r.tastes ?? [],
    goal: r.goal,
    householdSize: r.household_size,
    budgetBand: r.budget_band,
    swiggyAddressId: r.swiggy_address_id,
    quietHoursStart: r.quiet_hours_start,
    quietHoursEnd: r.quiet_hours_end,
    timezone: r.timezone,
  };
}

const NO_CONSENT: ConsentState = { profile: false, nudges: false, version: null, stale: false, consentedAt: null };

export async function getFoodProfile(userId: string): Promise<{ consent: ConsentState; profile: FoodProfile | null }> {
  const sb = await createServiceClient();
  const { data, error } = await sb.from("user_food_profile").select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`food profile read failed: ${error.message}`);
  if (!data) return { consent: NO_CONSENT, profile: null };
  const row = data as ProfileRow;
  return {
    consent: {
      profile: true,
      nudges: row.nudges_consented_at !== null,
      version: row.consent_version,
      stale: row.consent_version !== BO_NOTICE_VERSION,
      consentedAt: row.consented_at,
    },
    profile: rowToProfile(row),
  };
}

// ─── Validation ─────────────────────────────────────────────────────────────
//
// Purpose limitation: only the fields Bo plans with are accepted, each bounded.
// Unknown keys are ignored rather than stored.

const LIST_LIMITS = { diets: 20, allergies: 30, tastes: 40 } as const;
const ITEM_MAX = 60;
const GOALS: WeightGoal[] = ["lose", "maintain", "gain"];
const BUDGETS: BudgetBand[] = ["low", "mid", "high"];

function cleanList(v: unknown, max: number): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) throw new ProfileInputError("expected a list");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item !== "string") continue;
    const s = item.trim().toLowerCase().slice(0, ITEM_MAX);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  if (out.length > max) throw new ProfileInputError(`at most ${max} entries`);
  return out;
}

function cleanHour(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 23) throw new ProfileInputError("hour must be 0–23");
  return v;
}

export class ProfileInputError extends Error {}

/** Body → column updates. Throws ProfileInputError on a bad value. */
export function parseProfileInput(body: Record<string, unknown>): Partial<ProfileRow> {
  const out: Partial<ProfileRow> = {};
  const diets = cleanList(body.diets, LIST_LIMITS.diets);
  if (diets) out.diets = diets;
  const allergies = cleanList(body.allergies, LIST_LIMITS.allergies);
  if (allergies) out.allergies = allergies;
  const tastes = cleanList(body.tastes, LIST_LIMITS.tastes);
  if (tastes) out.tastes = tastes;

  if (body.goal !== undefined) {
    if (body.goal !== null && !GOALS.includes(body.goal as WeightGoal)) throw new ProfileInputError("bad goal");
    out.goal = (body.goal as WeightGoal | null) ?? null;
  }
  if (body.householdSize !== undefined) {
    const n = body.householdSize;
    if (n !== null && (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 20)) {
      throw new ProfileInputError("household size must be 1–20");
    }
    out.household_size = n as number | null;
  }
  if (body.budgetBand !== undefined) {
    if (body.budgetBand !== null && !BUDGETS.includes(body.budgetBand as BudgetBand)) throw new ProfileInputError("bad budget");
    out.budget_band = (body.budgetBand as BudgetBand | null) ?? null;
  }
  if (body.swiggyAddressId !== undefined) {
    const a = body.swiggyAddressId;
    if (a !== null && (typeof a !== "string" || a.length > 100)) throw new ProfileInputError("bad address id");
    out.swiggy_address_id = (a as string | null) || null;
  }
  const qs = cleanHour(body.quietHoursStart);
  if (qs !== undefined) out.quiet_hours_start = qs;
  const qe = cleanHour(body.quietHoursEnd);
  if (qe !== undefined) out.quiet_hours_end = qe;
  if (body.timezone !== undefined) {
    const tz = body.timezone;
    if (typeof tz !== "string" || !isTimeZone(tz)) throw new ProfileInputError("bad timezone");
    out.timezone = tz;
  }
  return out;
}

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export class ConsentRequiredError extends Error {
  constructor() {
    super("consent_required");
  }
}

async function logConsent(userId: string, purpose: ConsentPurpose, action: "granted" | "withdrawn", platform: Platform | null) {
  const sb = await createServiceClient();
  const { error } = await sb.from("consent_events").insert({
    user_id: userId,
    purpose,
    action,
    notice_version: BO_NOTICE_VERSION,
    platform,
  });
  // The ledger is evidence, not a gate: a failed insert is logged loudly but
  // does not undo the user's choice (a withdrawal must always go through).
  if (error) console.error("consent_events insert failed:", error.message);
}

/**
 * Opt in to the profile purpose (creates or refreshes the row), optionally
 * seeding it with the preferences the user already has on this device.
 */
export async function grantProfileConsent(
  userId: string,
  opts: { ageConfirmed: boolean; platform: Platform | null; seed?: Partial<ProfileRow> }
): Promise<void> {
  if (!opts.ageConfirmed) throw new ProfileInputError("age confirmation required");
  const sb = await createServiceClient();
  const now = new Date().toISOString();
  const { error } = await sb.from("user_food_profile").upsert(
    {
      user_id: userId,
      ...(opts.seed ?? {}),
      consent_version: BO_NOTICE_VERSION,
      consented_at: now,
      age_confirmed: true,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`consent grant failed: ${error.message}`);
  await logConsent(userId, "bo_profile", "granted", opts.platform);
}

/**
 * Withdraw profile consent: deletes the profile (and with it the nudges
 * consent) and every Bo task + event. As easy as giving it — one call.
 */
export async function withdrawProfileConsent(userId: string, platform: Platform | null): Promise<void> {
  const sb = await createServiceClient();
  const [profile, tasks] = await Promise.all([
    sb.from("user_food_profile").delete().eq("user_id", userId),
    sb.from("agent_tasks").delete().eq("user_id", userId),
  ]);
  const err = profile.error ?? tasks.error;
  if (err) throw new Error(`consent withdrawal failed: ${err.message}`);
  await logConsent(userId, "bo_profile", "withdrawn", platform);
}

/** Nudges are a separate, optional purpose layered on the profile consent. */
export async function setNudgesConsent(userId: string, grant: boolean, platform: Platform | null): Promise<void> {
  const sb = await createServiceClient();
  const { data, error } = await sb
    .from("user_food_profile")
    .update({ nudges_consented_at: grant ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw new Error(`nudges consent failed: ${error.message}`);
  if (!data?.length) {
    if (grant) throw new ConsentRequiredError();
    return; // withdrawing with no profile: nothing stored, nothing to do
  }
  await logConsent(userId, "bo_nudges", grant ? "granted" : "withdrawn", platform);
}

/** Update profile fields. Refuses (ConsentRequiredError) without a current consent. */
export async function updateFoodProfile(userId: string, fields: Partial<ProfileRow>): Promise<FoodProfile> {
  const sb = await createServiceClient();
  const { data, error } = await sb
    .from("user_food_profile")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("consent_version", BO_NOTICE_VERSION)
    .select(COLUMNS);
  if (error) throw new Error(`food profile update failed: ${error.message}`);
  if (!data?.length) throw new ConsentRequiredError();
  return rowToProfile(data[0] as ProfileRow);
}
