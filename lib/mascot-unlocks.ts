import { MASCOTS, type MascotName } from "@/components/mascots";

/**
 * The mascot-unlock ladder behind artboard 1l ("Mascot shelf · 5 of 12").
 *
 * This was the open `.mascot-locked` product question the handoff parked. It
 * is answered here in the narrowest way that keeps the screen HONEST: unlocks
 * are derived purely from `loggingStreak`, which already exists and already
 * feeds the Plan tab's flame chip. Nothing new is persisted, so there is no
 * unlock state to get out of sync with the logs, and clearing your logs
 * correctly re-locks the shelf.
 *
 * Bo is deliberately not on the ladder — he is the app's face, present from
 * the first launch, so "unlocking" him would be nonsense. That leaves exactly
 * the 12 produce mascots the artboard's "of 12" counts.
 *
 * The day thresholds are the artboard's own for the first eight
 * (1/3/5/7/10/14/21/30); the last four extend the same widening curve. If
 * these change, the shelf and the Day-N captions both follow automatically.
 */
export interface MascotUnlock {
  name: MascotName;
  day: number;
}

export const UNLOCK_LADDER: MascotUnlock[] = [
  { name: "carrot", day: 1 },
  { name: "leek", day: 3 },
  { name: "beet", day: 5 },
  { name: "tomato", day: 7 },
  { name: "broccoli", day: 10 },
  { name: "mushroom", day: 14 },
  { name: "avocado", day: 21 },
  { name: "pineapple", day: 30 },
  { name: "onion", day: 45 },
  { name: "pea", day: 60 },
  { name: "chili", day: 90 },
  { name: "lemon", day: 120 },
];

export interface ShelfEntry extends MascotUnlock {
  unlocked: boolean;
  Component: (typeof MASCOTS)[MascotName];
}

export function shelfFor(streak: number): ShelfEntry[] {
  return UNLOCK_LADDER.map((u) => ({
    ...u,
    unlocked: streak >= u.day,
    Component: MASCOTS[u.name],
  }));
}

export function unlockedCount(streak: number): number {
  return UNLOCK_LADDER.filter((u) => streak >= u.day).length;
}

/** The next mascot to earn, plus how far off it is. Null once all 12 are out. */
export function nextUnlock(streak: number): { entry: MascotUnlock; daysAway: number; progress: number } | null {
  const idx = UNLOCK_LADDER.findIndex((u) => streak < u.day);
  if (idx === -1) return null;
  const entry = UNLOCK_LADDER[idx];
  const prevDay = idx === 0 ? 0 : UNLOCK_LADDER[idx - 1].day;
  const span = entry.day - prevDay;
  return {
    entry,
    daysAway: entry.day - streak,
    // Progress across THIS rung only, so the bar restarts each time something
    // unlocks rather than creeping imperceptibly toward day 120.
    progress: span <= 0 ? 0 : Math.max(0, Math.min(1, (streak - prevDay) / span)),
  };
}

/** Title-cased mascot name for display ("bo-bowl" never reaches here). */
export function mascotLabel(name: MascotName): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
