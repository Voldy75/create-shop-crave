/**
 * Pantry-staple heuristic.
 *
 * Shared by the mobile pre-check (`/m/buy`) and the web cart (`/cart`) so the
 * two surfaces cannot quietly disagree about what counts as a staple — a user
 * who deselects "butter" on their phone and sees it re-selected on the desktop
 * would reasonably read that as a bug.
 *
 * **There is no pantry table.** This is a keyword guess over common staples,
 * which is exactly why every caller must keep the row togglable and why the
 * copy around it says "probably". Do not let this grow into something that
 * silently drops items from a shopping list.
 */
const PANTRY_STAPLES = [
  "butter",
  "garam masala",
  "salt",
  "oil",
  "sugar",
  "pepper",
  "ginger-garlic",
  "flour",
];

export function looksPantry(name: string): boolean {
  const n = name.toLowerCase();
  return PANTRY_STAPLES.some((s) => n.includes(s));
}
