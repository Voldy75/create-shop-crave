"use client";

/**
 * /m/settings/preferences — edit diet, hard no's, cravings, weight goal and
 * location after onboarding. F10's 10a drew a "Preferences" row with nothing
 * behind it; before this, the only way to change any of these on mobile was to
 * re-run onboarding from the start.
 *
 * Same model as web Settings → Preferences (lib/preferences.ts), and the same
 * chips as mobile onboarding (the MOBILE_* lists), so:
 *   - diet + hard no's share the strict `dietaryPreferences` array, hard no's
 *     as "avoid <x>" tags; cravings go to the soft `favoriteCuisines`;
 *   - anything this screen doesn't offer as a chip (set on web, or typed in)
 *     is shown as an extra picked chip and survives every save — never
 *     silently dropped;
 *   - changes save as you tap, like web. There is no Save button to forget.
 *
 * Preferences live on the device, so this works signed in or not.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, MapPin, Plus } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { Avocado, Broccoli, Pea } from "@/components/mascots";
import {
  MOBILE_AVOID_OPTIONS,
  MOBILE_DIET_OPTIONS,
  MOBILE_TASTE_OPTIONS,
  extras,
  getWeightGoal,
  has,
  joinDietary,
  labelFor,
  setWeightGoal,
  splitDietary,
  toggle,
} from "@/lib/preferences";
import type { WeightGoal } from "@/lib/types";

const shell: React.CSSProperties = {
  minHeight: "100dvh",
  background: "var(--m-cream)",
  padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px calc(env(safe-area-inset-bottom, 0px) + 28px)",
  gap: 22,
};

// Same rows and mascots as the onboarding goal step.
const GOALS: { value: WeightGoal; label: string; sub: string; Mascot: typeof Broccoli }[] = [
  { value: "lose", label: "Lose weight", sub: "Gentle deficit", Mascot: Broccoli },
  { value: "maintain", label: "Maintain", sub: "Stay steady", Mascot: Avocado },
  { value: "gain", label: "Build / gain", sub: "Lean surplus", Mascot: Pea },
];

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="vstack" style={{ gap: 10 }} aria-label={title}>
      <div className="vstack" style={{ gap: 2 }}>
        <h2 className="t-h1" style={{ margin: 0 }}>{title}</h2>
        <span className="t-cap">{sub}</span>
      </div>
      {children}
    </section>
  );
}

/** Chips for the offered options, then any stored extras (already picked). */
function ChipSet({
  options,
  picked,
  onToggle,
  avoid = false,
}: {
  options: readonly string[];
  picked: string[];
  onToggle: (v: string) => void;
  avoid?: boolean;
}) {
  const all = [...options, ...extras(picked, options)];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
      {all.map((o) => {
        const on = has(picked, o);
        const cls = avoid ? `chip chip-avoid${on ? " is-on" : ""}` : `chip${on ? " chip-active" : ""}`;
        return (
          <button key={o} type="button" className={cls} aria-pressed={on} onClick={() => onToggle(o)}>
            {labelFor(o, options)}
            {avoid && on ? <span aria-hidden> ✕</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default function MobilePreferencesPage() {
  const router = useRouter();
  const {
    hydrated,
    dietaryPreferences,
    setDietaryPreferences,
    favoriteCuisines,
    setFavoriteCuisines,
    location,
    setLocation,
    requestLocation,
    isLoadingLocation,
    locationError,
  } = useUser();
  const { diets, allergies } = useMemo(() => splitDietary(dietaryPreferences), [dietaryPreferences]);
  // Lazy initialiser: this is a client-only route, so reading localStorage on
  // first render cannot mismatch a server render.
  const [goal, setGoal] = useState<WeightGoal | null>(() => getWeightGoal());
  const [newAvoid, setNewAvoid] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const note = (msg: string) => setSaved(msg);

  const addAvoid = () => {
    const v = newAvoid.trim();
    if (!v) return;
    if (!has(allergies, v)) setDietaryPreferences(joinDietary(diets, [...allergies, v]));
    setNewAvoid("");
    note(`Bo won’t suggest ${v}.`);
  };

  return (
    <div className="vstack" style={shell}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft width={20} height={20} />
        </button>
        <h1 className="t-h1 grow" style={{ marginLeft: 10, marginBlock: 0 }}>Preferences</h1>
      </div>
      <span className="t-body-soft" style={{ marginTop: -10 }}>
        Bo uses these for every suggestion. Changes save as you tap.
      </span>

      {!hydrated ? (
        <div className="hstack" role="status" style={{ gap: 10 }}>
          <span className="dlsp" aria-hidden />
          <span className="t-cap">Loading your preferences…</span>
        </div>
      ) : (
        <>
          <Section title="Diet" sub="Bo only suggests food that fits.">
            <ChipSet
              options={MOBILE_DIET_OPTIONS}
              picked={diets}
              onToggle={(d) => {
                setDietaryPreferences(joinDietary(toggle(diets, d), allergies));
                note("Diet saved.");
              }}
            />
          </Section>

          <Section title="Hard no’s" sub="Allergies and never-evers. Bo never suggests these.">
            <ChipSet
              avoid
              options={MOBILE_AVOID_OPTIONS}
              picked={allergies}
              onToggle={(a) => {
                setDietaryPreferences(joinDietary(diets, toggle(allergies, a)));
                note("Hard no’s saved.");
              }}
            />
            <form
              className="hstack"
              style={{ gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                addAvoid();
              }}
            >
              <label htmlFor="pf-avoid" className="sr-only">Add another hard no</label>
              <input
                id="pf-avoid"
                className="pf-in"
                value={newAvoid}
                onChange={(e) => setNewAvoid(e.target.value)}
                placeholder="Add another, e.g. mushrooms"
                autoComplete="off"
                enterKeyHint="done"
              />
              <button type="submit" className="icon-btn" aria-label="Add hard no" disabled={!newAvoid.trim()} style={{ opacity: newAvoid.trim() ? 1 : 0.45 }}>
                <Plus width={18} height={18} />
              </button>
            </form>
          </Section>

          <Section title="Cravings" sub="What makes you drool. A nudge for Bo, not a filter.">
            <ChipSet
              options={MOBILE_TASTE_OPTIONS}
              picked={favoriteCuisines}
              onToggle={(t) => {
                setFavoriteCuisines(toggle(favoriteCuisines, t));
                note("Cravings saved.");
              }}
            />
          </Section>

          <Section title="Goal" sub="Optional. Tap the chosen one again to clear it.">
            <div className="vstack" style={{ gap: 10 }}>
              {GOALS.map(({ value, label, sub, Mascot }) => {
                const on = goal === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`row pf-goal${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    onClick={() => {
                      const next = on ? null : value;
                      setGoal(next);
                      setWeightGoal(next);
                      note(next ? "Goal saved." : "Goal cleared.");
                    }}
                  >
                    <Mascot width={36} height={36} style={{ flex: "none" }} aria-hidden />
                    <div className="vstack grow" style={{ gap: 1 }}>
                      <span className="t-h2">{label}</span>
                      <span className="t-cap">{sub}</span>
                    </div>
                    {on && <Check width={20} height={20} style={{ color: "var(--figure-accent)", flex: "none" }} aria-hidden />}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Location" sub="For nearby restaurants, delivery and grocery prices.">
            <div className="row" style={{ gap: 12 }}>
              <span className="icon-btn tint-green" style={{ boxShadow: "none", color: "var(--figure-accent)", flex: "none" }} aria-hidden>
                <MapPin width={19} height={19} />
              </span>
              <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                <span className="t-h2">{location ? "Using your location" : "Location off"}</span>
                <span className="t-cap">{location ? "From this device" : "Bo can’t look nearby"}</span>
              </div>
              {location ? (
                <button type="button" className="chip" onClick={() => { setLocation(null); note("Location turned off."); }}>
                  Stop using
                </button>
              ) : (
                <button
                  type="button"
                  className="chip chip-active"
                  onClick={async () => {
                    if (await requestLocation()) note("Location on.");
                  }}
                  disabled={isLoadingLocation}
                  aria-busy={isLoadingLocation}
                >
                  {isLoadingLocation ? "Locating…" : "Use my location"}
                </button>
              )}
            </div>
            {locationError && (
              <span className="t-cap" role="alert" style={{ color: "var(--text-red)" }}>
                {locationError}
              </span>
            )}
          </Section>

          <span className="sr-only" role="status" aria-live="polite">{saved}</span>
        </>
      )}
    </div>
  );
}
