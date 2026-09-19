/**
 * taste-prompt — how `favoriteCuisines` is phrased for a model.
 *
 * WHY THIS IS ITS OWN FILE, and why the wording is defensive.
 *
 * Onboarding's tastes step (artboard 2b) has captured and persisted
 * `favoriteCuisines` since it was built, and until now NOTHING consumed it —
 * the field appeared only in UserContext. Answering that step changed no AI
 * output whatsoever.
 *
 * The obvious fix is the wrong one, and handoff.md says so explicitly: do NOT
 * merge tastes into `dietaryPreferences`. That array is threaded into every AI
 * path as a strict "must respect" filter (chat, coach, ingredients,
 * diet-chart). Putting "loves ramen" into a strict-filter array corrupts it —
 * hard-no allergies live there, and a model told to strictly respect "ramen"
 * alongside "avoid peanuts" may start treating the cuisine list as an
 * allowlist and refuse everything outside it.
 *
 * So tastes are a SEPARATE, explicitly SOFT signal, and the sentence below
 * spends most of its words saying what the model must not do with it. That is
 * deliberate: the failure mode is not the model ignoring a preference, it is
 * the model over-applying it and narrowing every suggestion to four cuisines.
 *
 * Keep this as the single source of the phrasing — four prompts consume it, and
 * they should not drift apart.
 */

/** Cap the list so a long taste selection cannot crowd out the real prompt. */
const MAX_CUISINES = 6;

/**
 * A soft-preference sentence, or "" when there is nothing to say.
 * Empty string (not a placeholder) so callers can drop it into a template
 * without producing a stray blank claim.
 */
export function tastesLine(favoriteCuisines: string[] | undefined | null): string {
  if (!favoriteCuisines?.length) return "";
  const list = favoriteCuisines.slice(0, MAX_CUISINES).join(", ");
  return (
    `Tastes (soft preference, NOT a restriction): the user tends to enjoy ${list}. ` +
    `Lean this way when two options are otherwise equal, but never refuse, exclude ` +
    `or apologise for a suggestion because it falls outside this list, and never ` +
    `treat it as dietary.`
  );
}

/** The compact form for prompts that already have a "Cuisine context:" slot. */
export function cuisinesHintFrom(favoriteCuisines: string[] | undefined | null): string | undefined {
  if (!favoriteCuisines?.length) return undefined;
  return favoriteCuisines.slice(0, MAX_CUISINES).join(", ");
}
