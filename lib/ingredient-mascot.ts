import { MASCOTS, type MascotName } from "@/components/mascots";

/**
 * Ingredient → mascot mapping.
 *
 * The recipe artboard renders ingredients as a grid of mascot tiles rather
 * than a text list, so every ingredient string has to resolve to one of the 12
 * produce mascots (Bo is the AI presence, never an ingredient).
 *
 * Matching is synchronous and keyword-based, most-specific first, so tiles are
 * correct on the first paint. Anything unmatched falls back to a deterministic
 * hash — the same ingredient always draws the same mascot, which matters
 * because a recipe re-render must not reshuffle the grid.
 */

const PRODUCE: readonly MascotName[] = [
  "avocado",
  "beet",
  "broccoli",
  "carrot",
  "chili",
  "leek",
  "lemon",
  "mushroom",
  "onion",
  "pea",
  "pineapple",
  "tomato",
];

/** Ordered most-specific → most-generic; the first keyword found wins. */
const KEYWORDS: readonly (readonly [string, MascotName])[] = [
  ["spring onion", "leek"],
  ["scallion", "leek"],
  ["shallot", "onion"],
  ["red onion", "onion"],
  ["onion", "onion"],
  ["leek", "leek"],
  ["garlic", "onion"],
  ["shiitake", "mushroom"],
  ["portobello", "mushroom"],
  ["mushroom", "mushroom"],
  ["passata", "tomato"],
  ["ketchup", "tomato"],
  ["tomato", "tomato"],
  ["carrot", "carrot"],
  ["beetroot", "beet"],
  ["beet", "beet"],
  ["broccoli", "broccoli"],
  ["cauliflower", "broccoli"],
  ["cabbage", "broccoli"],
  ["spinach", "broccoli"],
  ["kale", "broccoli"],
  ["avocado", "avocado"],
  ["guacamole", "avocado"],
  ["lime", "lemon"],
  ["lemon", "lemon"],
  ["citrus", "lemon"],
  ["pineapple", "pineapple"],
  ["chilli", "chili"],
  ["chili", "chili"],
  ["chile", "chili"],
  ["jalape", "chili"],
  ["paprika", "chili"],
  ["cayenne", "chili"],
  ["pepper", "chili"],
  ["pea", "pea"],
  ["bean", "pea"],
  ["lentil", "pea"],
  ["chickpea", "pea"],
  ["edamame", "pea"],
];

/** Stable across renders: same string in, same mascot out. */
function hashPick(s: string): MascotName {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PRODUCE[h % PRODUCE.length];
}

export function mascotForIngredient(item: string): MascotName {
  const s = item.toLowerCase();
  for (const [kw, name] of KEYWORDS) {
    if (s.includes(kw)) return name;
  }
  return hashPick(s);
}

/** Convenience: the component itself, ready to render. */
export function mascotComponentFor(item: string) {
  return MASCOTS[mascotForIngredient(item)];
}

/**
 * The artboard cycles tile backgrounds through the four pastel section tints
 * rather than tinting by ingredient type — the rhythm is decorative.
 */
const TINTS = ["tint-green", "tint-peach", "tint-lav", "tint-cream"] as const;

export function tileTint(index: number): string {
  return TINTS[index % TINTS.length];
}
