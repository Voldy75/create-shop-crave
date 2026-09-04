import type { MascotName } from "@/components/mascots";

/**
 * Mascot → signature idle move.
 *
 * Artboard 1a of "Meshi Mascot Animations" gives every character ONE move, and
 * the durations differ even where the move is shared (leek sways at 2.8s,
 * onion at 3s). That variation is the point: identical timings make a row of
 * mascots read as one mechanical wave rather than a cast of characters.
 *
 * The classes live in `design/meshi-motion.css`, which both root layouts
 * import. This map exists so callers ask for "the carrot's move" instead of
 * remembering that it is a 1.6s wiggle around a 50%/88% origin — and so a
 * change to a character's personality happens in one place.
 *
 * Pairs with `lib/ingredient-mascot.ts`: resolve an ingredient to a mascot,
 * then a mascot to its move.
 */
const IDLE_CLASS: Record<MascotName, string> = {
  "bo-bowl": "mm-idle-bo-bowl",
  avocado: "mm-idle-avocado",
  beet: "mm-idle-beet",
  broccoli: "mm-idle-broccoli",
  carrot: "mm-idle-carrot",
  chili: "mm-idle-chili",
  leek: "mm-idle-leek",
  lemon: "mm-idle-lemon",
  mushroom: "mm-idle-mushroom",
  onion: "mm-idle-onion",
  pea: "mm-idle-pea",
  pineapple: "mm-idle-pineapple",
  tomato: "mm-idle-tomato",
};

/** The idle-loop class for a mascot. Safe to concatenate into `className`. */
export function mascotIdleClass(name: MascotName): string {
  return IDLE_CLASS[name];
}

/**
 * Stagger delay for a parade of mascots (artboards 1b/1d).
 *
 * The design doc offsets each sibling by 0.15s so they arrive as a sequence
 * rather than in unison. Returned as a style object because a delay is
 * per-instance data, not a class.
 */
export function mascotStagger(index: number, step = 0.15): { animationDelay: string } {
  return { animationDelay: `${(index * step).toFixed(2)}s` };
}
