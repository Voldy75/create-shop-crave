"use client";

/**
 * "Bo can order" — whether the chat runs as Bo the food agent (/api/bo:
 * Swiggy carts, bookings, Approval cards) or as plain chat (/api/chat:
 * recipes and ideas). One switch under the message box, shared by web and
 * mobile.
 *
 * Remembered per device in localStorage — a convenience, not a permission:
 * every order and booking still waits for the user's tap on an Approval
 * card, and the server gates Bo on the `bo_agent` flag and a Swiggy
 * connection regardless. A `?agent=1` link (CTA hand-offs) turns it on for
 * that visit until the user flips the switch.
 */

import { useCallback, useState, useSyncExternalStore } from "react";

const MODE_KEY = "meshi.boAgent";
const INTRO_KEY = "meshi.boAgentIntroSeen";
const EVENT = "meshi:bo-agent-pref";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage: the choice lasts for this visit only */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * @param fromUrl   the page was opened with `?agent=1`
 * @param available Bo is switched on for this user (`bo_agent` flag loaded and on).
 *                  When not, the switch is hidden and only `?agent=1` applies,
 *                  exactly as before (the legacy /api/agent path).
 */
export function useBoAgentMode(fromUrl: boolean, available: boolean) {
  const stored = useSyncExternalStore(subscribe, () => read(MODE_KEY), () => null);
  const introSeen = useSyncExternalStore(subscribe, () => read(INTRO_KEY) === "1", () => true);
  // The user's flip in this visit beats the URL and the stored value.
  const [choice, setChoice] = useState<boolean | null>(null);

  const on = available ? choice ?? (fromUrl || stored === "1") : fromUrl;

  const set = useCallback((next: boolean) => {
    setChoice(next);
    write(MODE_KEY, next ? "1" : "0");
    // Keep the URL honest so a refresh shows the same mode.
    const url = new URL(window.location.href);
    url.searchParams.delete("agent");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, []);

  const markIntroSeen = useCallback(() => write(INTRO_KEY, "1"), []);

  return { on, set, introSeen, markIntroSeen };
}
