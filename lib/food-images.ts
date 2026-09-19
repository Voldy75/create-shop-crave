/**
 * Keyless food imagery — maps a dish/craving/restaurant name to a real food
 * photo by keyword. Photos are verified TheMealDB CDN URLs (public, hotlinkable,
 * no API key). Matching is synchronous so screens render the right image on the
 * first paint with no loading flicker. No match → null, and the caller keeps its
 * gradient placeholder (graceful fallback).
 *
 * Ordered most-specific → most-generic; the first keyword found in the name wins.
 * To swap in higher-fidelity art later, replace the URLs here only.
 */

const M = "https://www.themealdb.com/images/media/meals";

// Verified 200 image/jpeg as of 2026-05 (see scripts harvest in PR notes).
const IMG = {
  biryani: `${M}/xrttsx1487339558.jpg`,
  chicken: `${M}/pk8wtn1763758591.jpg`,
  curry: `${M}/0dhtwr1763371444.jpg`,
  salad: `${M}/0iryz91763778419.jpg`,
  pasta: `${M}/qvrwpt1511181864.jpg`,
  noodle: `${M}/ntafxw1763586291.jpg`,
  pizza: `${M}/x0lk931587671540.jpg`,
  dessert: `${M}/qawvoy1777627952.jpg`,
  pancake: `${M}/58bkyo1593350017.jpg`,
  soup: `${M}/p9tebp1764118792.jpg`,
  seafood: `${M}/9r2xrg1763771238.jpg`,
  breakfast: `${M}/30s7vf1763741844.jpg`,
  lamb: `${M}/7xte3u1763757761.jpg`,
  beef: `${M}/mq27gf1764436795.jpg`,
  vegetarian: `${M}/wrustq1511475474.jpg`,
  starter: `${M}/h5qmn31763304965.jpg`,
} as const;

// Each rule: a list of substrings → the image bucket. First match wins.
const RULES: Array<[string[], keyof typeof IMG]> = [
  [["biryani", "pulao", "fried rice", "jeera rice"], "biryani"],
  [["butter chicken", "tikka", "tandoori", "chicken", "wings", "nugget"], "chicken"],
  [["paneer", "curry", "masala", "korma", "dal", "tofu", "chana", "rajma", "gravy"], "curry"],
  [["buddha bowl", "salad", "bowl", "greens", "kale", "quinoa"], "salad"],
  [["pasta", "spaghetti", "lasagne", "lasagna", "penne", "mac and cheese", "risotto"], "pasta"],
  [["maggi", "noodle", "ramen", "chow", "hakka", "stir fry", "stir-fry"], "noodle"],
  [["pizza", "calzone", "focaccia"], "pizza"],
  [["pavlova", "cake", "dessert", "sweet", "ice cream", "brownie", "halwa", "kheer", "pudding", "tart", "cookie", "chocolate"], "dessert"],
  [["pancake", "waffle", "crepe", "french toast"], "pancake"],
  [["soup", "broth", "rasam", "stew", "chowder"], "soup"],
  [["fish", "prawn", "shrimp", "seafood", "salmon", "tuna", "crab"], "seafood"],
  [["breakfast", "omelette", "omelet", "egg", "toast", "poha", "idli", "dosa", "upma"], "breakfast"],
  [["lamb", "mutton", "goat", "keema"], "lamb"],
  [["beef", "steak", "burger", "soul food", "bbq", "barbecue", "brisket"], "beef"],
  [["veg", "vegetable", "vegan", "sabzi", "stir"], "vegetarian"],
  [["samosa", "pakora", "starter", "appetiz", "snack", "tikki", "roll"], "starter"],
];

/**
 * Returns a real food photo URL for a dish/craving/restaurant name, or null if
 * nothing matches (caller should keep its gradient). Case-insensitive substring
 * match against the rules above.
 */
export function foodImage(name: string | undefined | null): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  for (const [keys, bucket] of RULES) {
    if (keys.some((k) => n.includes(k))) return IMG[bucket];
  }
  return null;
}
