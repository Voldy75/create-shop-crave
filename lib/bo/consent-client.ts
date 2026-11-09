"use client";

/**
 * Client side of Bo's consent + food profile (server: app/api/bo/*).
 *
 * ONE SHARED STATE per tab, not per component: the consent card in Settings,
 * and the preference setters anywhere in the app, must agree on whether the
 * user has opted in. A tiny module store with useSyncExternalStore does that
 * without a new React context in both root layouts.
 *
 * WRITE-THROUGH. Preferences stay device-first (localStorage, lib/preferences).
 * When — and only when — the server says this user has a current consent,
 * every preference change is mirrored to the server profile, debounced. The
 * snapshot is always read back from localStorage, so whichever screen changed
 * a value, the server gets the whole current picture. Without consent nothing
 * is sent: that is the DPDP line, enforced here AND by the server (409).
 *
 * Flag off → GET /api/bo/profile 404s → state "off" for the session, and the
 * card renders nothing. No other request is ever made.
 */

import { useSyncExternalStore } from "react";
import { nativePlatform } from "@/lib/native-bridge";
import { getWeightGoal, splitDietary } from "@/lib/preferences";
import { BO_NOTICE_VERSION } from "@/lib/bo/notice";

export interface BoConsent {
  profile: boolean;
  nudges: boolean;
  version: string | null;
  stale: boolean;
  consentedAt: string | null;
}

export type BoConsentState =
  | { status: "idle" | "loading" | "off" | "signed_out" | "error" }
  | { status: "ready"; consent: BoConsent };

let state: BoConsentState = { status: "idle" };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: BoConsentState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => state;
const getServerSnapshot = (): BoConsentState => ({ status: "idle" });

export function useBoConsent(): BoConsentState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True only for a current (non-stale) profile consent. */
function consented(): boolean {
  return state.status === "ready" && state.consent.profile && !state.consent.stale;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function applyResponse(res: Response, body: Record<string, unknown>) {
  if (res.status === 404) return set({ status: "off" });
  if (res.status === 401) return set({ status: "signed_out" });
  if (!res.ok || !body.consent) return set({ status: "error" });
  set({ status: "ready", consent: body.consent as BoConsent });
}

/** Load once per tab (pass force to refetch, e.g. after sign-in). */
export function loadBoConsent(force = false): Promise<void> {
  if (!force && (state.status === "ready" || state.status === "off")) return Promise.resolve();
  if (inflight) return inflight;
  if (state.status !== "ready") set({ status: "loading" });
  inflight = fetch("/api/bo/profile", { cache: "no-store" })
    .then(async (res) => applyResponse(res, await readJson(res)))
    .catch(() => set({ status: "error" }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Forget the cached state — on sign-out, so the next user starts clean. */
export function resetBoConsent() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  set({ status: "idle" });
}

function platform() {
  return typeof window === "undefined" ? null : nativePlatform();
}

/** The preferences on this device, in the server's field names. */
export function deviceProfile(): Record<string, unknown> {
  let strict: string[] = [];
  let tastes: string[] = [];
  try {
    strict = JSON.parse(localStorage.getItem("crave_dietaryPreferences") ?? "[]");
    tastes = JSON.parse(localStorage.getItem("crave_favoriteCuisines") ?? "[]");
  } catch {
    /* unreadable storage: send empty lists rather than nothing */
  }
  const { diets, allergies } = splitDietary(Array.isArray(strict) ? strict : []);
  return { diets, allergies, tastes: Array.isArray(tastes) ? tastes : [], goal: getWeightGoal() };
}

type Result = { ok: true } | { ok: false; error: string };

async function postConsent(payload: Record<string, unknown>): Promise<Result> {
  try {
    const res = await fetch("/api/bo/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, platform: platform() }),
    });
    const body = await readJson(res);
    if (res.ok) {
      applyResponse(res, body);
      return { ok: true };
    }
    if (res.status === 409 && body.error === "notice_changed") void loadBoConsent(true);
    return { ok: false, error: typeof body.error === "string" ? body.error : "server_error" };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Opt in to the notice the user is looking at, seeding from this device. */
export function grantBoConsent(ageConfirmed: boolean): Promise<Result> {
  return postConsent({
    purpose: "bo_profile",
    grant: true,
    ageConfirmed,
    noticeVersion: BO_NOTICE_VERSION,
    seed: deviceProfile(),
  });
}

/** Withdraw: the server deletes the profile and Bo's task history. */
export function withdrawBoConsent(): Promise<Result> {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  return postConsent({ purpose: "bo_profile", grant: false });
}

export function setBoNudges(grant: boolean): Promise<Result> {
  return postConsent({ purpose: "bo_nudges", grant });
}

// ─── Write-through ──────────────────────────────────────────────────────────

const SYNC_DELAY_MS = 800;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

async function pushProfile() {
  syncTimer = null;
  if (!consented()) return;
  try {
    const res = await fetch("/api/bo/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deviceProfile()),
    });
    // Consent withdrawn elsewhere, or the notice changed: refresh, stop syncing.
    if (res.status === 409 || res.status === 404) void loadBoConsent(true);
  } catch {
    /* device copy is the source of truth; the next change retries */
  }
}

/**
 * Call after any preference change. Debounced; sends nothing unless this user
 * has a current consent. If consent is not known yet in this tab, it is
 * loaded first (one GET), then the decision is made.
 */
export function queueBoProfileSync() {
  if (typeof window === "undefined") return;
  if (state.status === "off" || state.status === "signed_out") return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void (state.status === "ready" ? pushProfile() : loadBoConsent().then(pushProfile));
  }, SYNC_DELAY_MS);
}

// setWeightGoal (lib/preferences) announces itself with this event rather than
// importing this module, which would make the two import each other.
if (typeof window !== "undefined") {
  window.addEventListener("crave:prefs-changed", queueBoProfileSync);
}
