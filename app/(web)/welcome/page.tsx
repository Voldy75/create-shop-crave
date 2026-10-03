"use client";

/**
 * /welcome — web first-run, built to WF10 (w10a–w10d).
 *
 * Mobile has a ten-step onboarding; web had nothing but a sign-in modal, so a
 * web-only user's tastes were permanently empty (read in four files, written
 * in none), diet was settable only from the pre-auth landing chips, and the
 * weight goal was unreachable. This is three steps instead of ten, every one
 * skippable, with "Skip to app" always in reach.
 *
 * Lives OUTSIDE the (app) route group on purpose: the board draws a top bar
 * with a step rail and no sidebar, and (app)'s layout is the sidebar shell.
 *
 * Choices save as you tap (same as Settings → Preferences), so leaving halfway
 * keeps whatever was picked. "Skip this step" and "Nothing applies" are
 * different answers and are recorded differently: skipping marks the step as
 * skipped and step 2 then says plainly that nothing will be filtered; "Nothing
 * applies" is a real answer and the step counts as done.
 *
 * Drawn on the board but deliberately not built (decided 2026-10-03):
 *   - a city name for the location and a "Type a city" field — location is raw
 *     lat/lng and nothing in the product geocodes. See LocationCard.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Info, Loader2 } from "lucide-react";
import { BoBowl } from "@/components/mascots";
import { useUser } from "@/app/context/UserContext";
import { AllergyCard, DietCard, GoalPicker, LocationCard, TasteCard } from "@/components/web/PreferenceControls";
import { getWeightGoal, joinDietary, markWebFirstRunDone, setWeightGoal, splitDietary } from "@/lib/preferences";
import type { WeightGoal } from "@/lib/types";

type Step = 1 | 2 | 3;
const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Diet & allergies" },
  { n: 2, label: "Tastes" },
  { n: 3, label: "Goal & location" },
];

export default function WelcomePage() {
  const router = useRouter();
  const { user, hydrated, dietaryPreferences, setDietaryPreferences, favoriteCuisines, setFavoriteCuisines, location } =
    useUser();

  const [step, setStep] = useState<Step>(1);
  const [skipped, setSkipped] = useState<Set<Step>>(new Set());
  const [done, setDone] = useState<Set<Step>>(new Set());
  // Lazy, not an effect: this only renders after hydration (a loader shows
  // until the user is known), so reading localStorage here cannot cause a
  // server/client mismatch, and it avoids a second render.
  const [goal, setGoal] = useState<WeightGoal | null>(() => getWeightGoal());
  useEffect(() => {
    if (hydrated && !user) router.replace("/");
  }, [hydrated, user, router]);

  const { diets, allergies } = useMemo(() => splitDietary(dietaryPreferences), [dietaryPreferences]);

  const finish = () => {
    markWebFirstRunDone();
    router.replace("/home");
  };

  const advance = (how: "done" | "skipped") => {
    const mark = (set: Set<Step>) => new Set(set).add(step);
    const unmark = (set: Set<Step>) => {
      const next = new Set(set);
      next.delete(step);
      return next;
    };
    if (how === "done") {
      setDone(mark);
      setSkipped(unmark);
    } else {
      setSkipped(mark);
      setDone(unmark);
    }
    if (step === 3) finish();
    else setStep((step + 1) as Step);
  };

  if (!hydrated || !user) {
    return (
      <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--m-cream)" }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--m-ink-soft)" }} />
      </main>
    );
  }

  const stepEmpty =
    step === 1 ? diets.length + allergies.length === 0 : step === 2 ? favoriteCuisines.length === 0 : !goal && !location;

  return (
    <main style={{ minHeight: "100dvh", background: "var(--m-cream)", color: "var(--m-ink)" }}>
      {/* Top bar: logo · step rail · Skip to app */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "20px 34px",
          borderBottom: "1px solid var(--m-ink-faint)",
          background: "var(--m-card)",
          flexWrap: "wrap",
        }}
      >
        <div className="side-logo" style={{ padding: 0, margin: 0 }}>
          <BoBowl width={36} height={36} aria-hidden />
          meshi
        </div>
        <ol
          aria-label="First-run steps"
          style={{ flex: 1, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", listStyle: "none", margin: 0, padding: 0 }}
        >
          {STEPS.map(({ n, label }) => {
            const state =
              n === step ? "is-current" : skipped.has(n) ? "is-skipped" : done.has(n) ? "is-done" : "";
            return (
              <li key={n} className={`ob-step ${state}`} aria-current={n === step ? "step" : undefined}>
                <span className="ob-stepn">
                  {state === "is-done" ? <Check width={12} height={12} aria-hidden /> : n}
                </span>
                {label}
                {state === "is-skipped" && <span className="ob-stepnote">· skipped</span>}
              </li>
            );
          })}
        </ol>
        <button type="button" className="wlink" onClick={finish} style={{ fontSize: 13.5, background: "none", border: "none", cursor: "pointer" }}>
          Skip to app
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 34px 44px", display: "flex", flexDirection: "column", gap: 22 }}>
        {step === 2 && skipped.has(1) && (
          <div className="hstack" role="status" style={{ gap: 13, padding: "14px 18px", borderRadius: 16, background: "var(--m-cream-2)", flexWrap: "wrap" }}>
            <Info width={18} height={18} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
            <span className="t-body grow" style={{ minWidth: 240 }}>
              Diet and allergies skipped — nothing will be filtered out until you add them.
            </span>
            <button type="button" className="wlink" onClick={() => setStep(1)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              Add now
            </button>
          </div>
        )}

        {step === 1 && (
          <>
            <Heading title="Anything you don’t eat?" sub="Bo reads this before every suggestion. Change it any time in Settings → Preferences." />
            <DietCard diets={diets} onChange={(next) => setDietaryPreferences(joinDietary(next, allergies))} />
            <AllergyCard allergies={allergies} onChange={(next) => setDietaryPreferences(joinDietary(diets, next))} />
          </>
        )}

        {step === 2 && (
          <>
            <Heading
              title="What do you like to eat?"
              sub="Pick as many as you want. Tastes decide what Bo shows first; they never remove a recipe from your results."
            />
            <TasteCard tastes={favoriteCuisines} onChange={setFavoriteCuisines} />
          </>
        )}

        {step === 3 && (
          <>
            <Heading
              title="Last one, both optional"
              sub="A goal changes how Bo balances portions and protein. Leave it blank and suggestions stay neutral."
            />
            <div className="vstack" style={{ gap: 10 }}>
              <span className="t-micro">Weight goal</span>
              <GoalPicker
                goal={goal}
                onChange={(g) => {
                  setGoal(g);
                  setWeightGoal(g);
                }}
              />
            </div>
            <LocationCard />
          </>
        )}

        {/* Footer: Back · Skip this step · primary */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 6, flexWrap: "wrap" }}>
          {step > 1 && (
            <button type="button" className="wlink" onClick={() => setStep((step - 1) as Step)} style={{ background: "none", border: "none", cursor: "pointer" }}>
              <ArrowLeft width={15} height={15} aria-hidden />
              Back
            </button>
          )}
          <div className="grow" />
          {stepEmpty && (
            <button
              type="button"
              className="wlink"
              onClick={() => advance("skipped")}
              style={{ color: "var(--m-ink-soft)", background: "none", border: "none", cursor: "pointer" }}
            >
              Skip this step
            </button>
          )}
          <button type="button" className="xbtn xbtn-f" onClick={() => advance("done")}>
            {step === 3 ? "Go to meshi" : stepEmpty ? (step === 1 ? "Nothing applies" : "No favourites") : "Continue"}
            <ArrowRight width={16} height={16} aria-hidden />
          </button>
        </div>
      </div>
    </main>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="vstack" style={{ gap: 8 }}>
      <h1 className="t-d1" style={{ fontSize: 34, margin: 0 }}>{title}</h1>
      <span className="t-body-soft" style={{ maxWidth: 600 }}>{sub}</span>
    </div>
  );
}
