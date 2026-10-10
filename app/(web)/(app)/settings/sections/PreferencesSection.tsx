"use client";

/**
 * Settings → Preferences, built to w10e.
 *
 * Before this, Settings had three tabs and no way to change diet, allergies,
 * tastes or the weight goal after sign-in — the only diet control on web was
 * the pre-auth landing page. Same four cards as /welcome (they are literally
 * the same components), so the two cannot drift.
 *
 * "Changes save as you tap" is literal: every control writes through the same
 * setters the first-run uses, with no save button to forget.
 */

import { useMemo, useState } from "react";
import { useUser } from "@/app/context/UserContext";
import { AllergyCard, DietCard, GoalPicker, LocationCard, TasteCard } from "@/components/web/PreferenceControls";
import { getWeightGoal, joinDietary, setWeightGoal, splitDietary } from "@/lib/preferences";
import type { WeightGoal } from "@/lib/types";

export function PreferencesSection() {
  const { dietaryPreferences, setDietaryPreferences, favoriteCuisines, setFavoriteCuisines } = useUser();
  const { diets, allergies } = useMemo(() => splitDietary(dietaryPreferences), [dietaryPreferences]);
  // Lazy, not an effect: this only renders after hydration (a loader shows
  // until the user is known), so reading localStorage here cannot cause a
  // server/client mismatch, and it avoids a second render.
  const [goal, setGoal] = useState<WeightGoal | null>(() => getWeightGoal());

  return (
    <div className="vstack" style={{ gap: 18 }}>
      <DietCard diets={diets} onChange={(next) => setDietaryPreferences(joinDietary(next, allergies))} />
      <AllergyCard allergies={allergies} onChange={(next) => setDietaryPreferences(joinDietary(diets, next))} />
      <TasteCard tastes={favoriteCuisines} onChange={setFavoriteCuisines} />
      <div className="card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="hstack" style={{ gap: 10 }}>
          <span className="t-h1" style={{ fontSize: 18 }}>Weight goal</span>
          <span className="t-cap">Optional · tap the chosen one again to clear it</span>
        </div>
        <GoalPicker
          goal={goal}
          onChange={(g) => {
            setGoal(g);
            setWeightGoal(g);
          }}
        />
      </div>
      <LocationCard />
    </div>
  );
}
