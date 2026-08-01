"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, MapPin, Check } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { signInWithProvider } from "@/lib/native-auth";
import { saveNutritionGoals } from "@/lib/storage";
import { defaultGoalsFromProfile } from "@/lib/nutrition";
import type { WeightGoal } from "@/lib/types";
import { BoBowl, Carrot, Broccoli, Tomato, Mushroom, Avocado, Pea } from "@/components/mascots";

/**
 * meshi onboarding — built to the Flow 1 artboards in
 * "Meshi Redesign B -Montserrat-.dc.html" (Onboarding → location → diet →
 * goal), not adapted from the previous dark-first screens.
 *
 * The design's throughline is that a MASCOT fronts every step and speaks in
 * character ("Tomato has already scoped the block"). That is the point of the
 * screen, so the mascots are load-bearing here, not decoration.
 *
 * Wiring is unchanged: requestLocation, setDietaryPreferences,
 * defaultGoalsFromProfile/saveNutritionGoals, and signInWithProvider (which
 * routes native OAuth through the system browser).
 */

type Step = "welcome" | "location" | "diet" | "goals" | "signup";
const STEPS: Step[] = ["welcome", "location", "diet", "goals", "signup"];

const DIET_OPTIONS = [
  "Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Halal",
  "Keto", "Nut-free", "Pescatarian", "Low-carb",
];

const GOAL_OPTIONS: {
  value: WeightGoal;
  label: string;
  sub: string;
  Mascot: typeof Broccoli;
}[] = [
  { value: "lose", label: "Lose weight", sub: "Gentle deficit", Mascot: Broccoli },
  { value: "maintain", label: "Maintain", sub: "Stay steady", Mascot: Avocado },
  { value: "gain", label: "Build / gain", sub: "Lean surplus", Mascot: Pea },
];

/** 4-segment pager: lime behind you, forest where you are, faint ahead. */
function StepBar({ current }: { current: number }) {
  return (
    <div className="step-bar">
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={`step-seg ${i < current ? "done" : i === current ? "now" : ""}`} />
      ))}
    </div>
  );
}

/** Shared top row for steps 2–5: back, progress, skip. */
function StepHeader({
  current,
  onBack,
  onSkip,
}: {
  current: number;
  onBack: () => void;
  onSkip?: () => void;
}) {
  return (
    <div className="hstack">
      <button className="icon-btn" onClick={onBack} aria-label="Back">
        <ArrowLeft width={20} height={20} />
      </button>
      <StepBar current={current} />
      {onSkip ? (
        <button className="t-cap" onClick={onSkip} style={{ background: "none", border: "none" }}>
          Skip
        </button>
      ) : (
        <span style={{ width: 36 }} />
      )}
    </div>
  );
}

const SHELL: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  padding: "calc(env(safe-area-inset-top, 12px) + 8px) 28px calc(env(safe-area-inset-bottom, 0px) + 34px)",
  gap: 0,
};

export default function Onboarding() {
  const router = useRouter();
  const supabase = createClient();
  const { requestLocation, isLoadingLocation, setDietaryPreferences } = useUser();

  const [step, setStep] = useState<Step>("welcome");
  const [diet, setDiet] = useState<string[]>([]);
  const [goal, setGoal] = useState<WeightGoal | null>(null);

  const idx = STEPS.indexOf(step);
  const go = (s: Step) => setStep(s);
  const next = () => go(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  const back = () => (idx <= 0 ? router.push("/m") : go(STEPS[idx - 1]));

  const toggleDiet = (d: string) =>
    setDiet((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const handleUseLocation = async () => {
    await requestLocation();
    next();
  };

  const saveDietAndNext = () => {
    setDietaryPreferences(diet.map((d) => d.toLowerCase()));
    next();
  };

  const saveGoalAndNext = () => {
    if (goal) {
      const goals = defaultGoalsFromProfile({
        sex: "female", age: 30, heightCm: 165, weightKg: 62, activity: "moderate", goal,
      });
      if (goals) saveNutritionGoals(goals);
    }
    next();
  };

  const signInGoogle = async () => {
    await signInWithProvider(supabase, "google");
  };

  // ── Welcome — Bo and the crew ────────────────────────────────────────
  if (step === "welcome") {
    return (
      <div style={SHELL}>
        <div className="hstack" style={{ justifyContent: "flex-end" }}>
          <button className="t-cap" onClick={() => go("signup")} style={{ background: "none", border: "none" }}>
            Skip
          </button>
        </div>

        {/* Bo centred, the crew rotated around him — this composition is the
            screen's whole idea. */}
        <div
          className="tint-green"
          style={{
            marginTop: 14, borderRadius: 30, padding: "34px 20px 26px",
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 6, position: "relative",
          }}
        >
          <BoBowl width={150} height={150} />
          <div style={{ position: "absolute", top: 22, left: 26, transform: "rotate(-10deg)" }}>
            <Carrot width={52} height={52} />
          </div>
          <div style={{ position: "absolute", top: 30, right: 24, transform: "rotate(9deg)" }}>
            <Broccoli width={48} height={48} />
          </div>
          <div style={{ position: "absolute", bottom: 20, left: 34, transform: "rotate(7deg)" }}>
            <Tomato width={40} height={40} />
          </div>
          <div style={{ position: "absolute", bottom: 24, right: 36, transform: "rotate(-8deg)" }}>
            <Mushroom width={42} height={42} />
          </div>
        </div>

        <div className="vstack" style={{ marginTop: 28, textAlign: "center" }}>
          <span className="t-d1">
            Meet your new
            <br />
            kitchen crew
          </span>
          <span className="t-body-soft" style={{ padding: "0 14px" }}>
            Chat with Bo for recipes, track what you eat, and unlock the whole veggie gang as you go.
          </span>
        </div>

        <div className="hstack" style={{ justifyContent: "center", gap: 7, marginTop: 18 }}>
          <i style={{ width: 22, height: 8, borderRadius: 9, background: "var(--m-forest)" }} />
          <i style={{ width: 8, height: 8, borderRadius: 9, background: "var(--m-ink-faint)" }} />
          <i style={{ width: 8, height: 8, borderRadius: 9, background: "var(--m-ink-faint)" }} />
        </div>

        <div className="grow" />
        <button className="pill-primary" style={{ width: "100%" }} onClick={next}>
          I&rsquo;m hungry, let&rsquo;s go
        </button>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <span className="t-cap">
            Already have an account?{" "}
            <button onClick={() => go("signup")} style={{ background: "none", border: "none", color: "var(--m-forest)", fontWeight: 700 }}>
              Sign in
            </button>
          </span>
        </div>
      </div>
    );
  }

  // ── Location — Tomato scouts the block ───────────────────────────────
  if (step === "location") {
    return (
      <div style={SHELL} className="vstack">
        <StepHeader current={1} onBack={back} onSkip={next} />

        <div
          className="tint-green"
          style={{
            marginTop: 12, borderRadius: 30, padding: "30px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}
        >
          <div style={{ position: "relative", width: 130, height: 130 }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(30,90,52,.1)", animation: "mm-ring 2.4s ease-out infinite" }} />
            <span style={{ position: "absolute", inset: 18, borderRadius: "50%", background: "rgba(30,90,52,.14)" }} />
            <span style={{ position: "absolute", inset: 36, borderRadius: "50%", background: "var(--m-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Tomato width={42} height={42} style={{ animation: "mm-bob 2.4s ease-in-out infinite" }} />
            </span>
            <MapPin width={26} height={26} style={{ position: "absolute", top: 2, right: 8, color: "var(--m-forest)" }} />
          </div>
          <span className="t-cap" style={{ color: "var(--m-forest)" }}>
            Tomato has already scoped the block.
          </span>
        </div>

        <div className="vstack" style={{ gap: 6, marginTop: 14, textAlign: "center" }}>
          <span className="t-d2">
            Where&rsquo;s the food
            <br />
            coming from?
          </span>
          <span className="t-body-soft" style={{ padding: "0 10px" }}>
            Nearby restaurants, delivery ETAs and grocery runs all key off your location.
          </span>
        </div>

        <div className="grow" />
        <button className="pill-primary" style={{ width: "100%", gap: 10 }} onClick={handleUseLocation} disabled={isLoadingLocation}>
          <MapPin width={18} height={18} />
          {isLoadingLocation ? "Locating…" : "Use my location"}
        </button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="t-cap" onClick={next} style={{ background: "none", border: "none" }}>
            Enter address manually
          </button>
        </div>
      </div>
    );
  }

  // ── Diet — Mushroom reacts to your picks ─────────────────────────────
  if (step === "diet") {
    const summary = diet.length
      ? `${diet.slice(0, 2).join(" + ")}${diet.length > 2 ? ` +${diet.length - 2}` : ""} noted. Mushroom volunteers as tribute.`
      : "Pick what applies — Mushroom will hold the notes.";

    return (
      <div style={SHELL} className="vstack">
        <StepHeader current={2} onBack={back} onSkip={next} />

        <div className="vstack" style={{ gap: 6, marginTop: 8 }}>
          <span className="t-d2">How do you eat?</span>
          <span className="t-body-soft">
            Bo filters every recipe, restaurant and grocery list through these. Tell us once — we remember.
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 4 }}>
          {DIET_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDiet(d)}
              className={`chip ${diet.includes(d) ? "chip-active" : ""}`}
              aria-pressed={diet.includes(d)}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Mascot reaction card — lavender tint, plum ink, per the artboard. */}
        <div
          className="card tint-lav"
          style={{ boxShadow: "none", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}
        >
          <Mushroom width={40} height={40} style={{ flex: "none" }} />
          <span className="t-body" style={{ color: "var(--m-plum)" }}>{summary}</span>
        </div>

        <div className="grow" />
        <button className="pill-primary" style={{ width: "100%" }} onClick={saveDietAndNext}>
          Next
        </button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button
            className="t-cap"
            onClick={() => { setDiet([]); saveDietAndNext(); }}
            style={{ background: "none", border: "none" }}
          >
            No restrictions — feed me anything
          </button>
        </div>
      </div>
    );
  }

  // ── Goal — a mascot per goal, as list rows ───────────────────────────
  if (step === "goals") {
    return (
      <div style={SHELL} className="vstack">
        <StepHeader current={3} onBack={back} onSkip={next} />

        <div className="vstack" style={{ gap: 6, marginTop: 8 }}>
          <span className="t-d2">What&rsquo;s the goal?</span>
        </div>

        {/* `.row` here is meshi-b's genuine LIST ROW card — the one case in the
            mobile tree where that class is used as designed. */}
        {GOAL_OPTIONS.map(({ value, label, sub, Mascot }) => {
          const on = goal === value;
          return (
            <button
              key={value}
              className="row"
              onClick={() => setGoal(value)}
              aria-pressed={on}
              style={{
                width: "100%",
                textAlign: "left",
                border: "none",
                boxShadow: on ? "inset 0 0 0 2.5px var(--m-forest)" : undefined,
              }}
            >
              <Mascot width={38} height={38} style={{ flex: "none" }} />
              <div className="vstack grow" style={{ gap: 1 }}>
                <span className="t-h2">{label}</span>
                <span className="t-cap">{sub}</span>
              </div>
              {on && <Check width={20} height={20} style={{ color: "var(--m-forest)" }} />}
            </button>
          );
        })}

        <div className="grow" />
        <button
          className="pill-primary"
          style={{ width: "100%", opacity: goal ? 1 : 0.5 }}
          onClick={saveGoalAndNext}
          disabled={!goal}
        >
          Next
        </button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span className="t-cap">Bo will fine-tune this as you log</span>
        </div>
      </div>
    );
  }

  // ── Sign in ──────────────────────────────────────────────────────────
  return (
    <div style={SHELL} className="vstack">
      <StepHeader current={3} onBack={back} />

      <div
        className="tint-green"
        style={{
          marginTop: 12, borderRadius: 30, padding: "30px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}
      >
        <BoBowl width={96} height={96} style={{ animation: "mm-bob 3s ease-in-out infinite" }} />
        <span className="t-cap" style={{ color: "var(--m-forest)" }}>
          Bo remembers your taste across devices.
        </span>
      </div>

      <div className="vstack" style={{ gap: 6, marginTop: 16, textAlign: "center" }}>
        <span className="t-d2">Save your preferences</span>
        <span className="t-body-soft" style={{ padding: "0 10px" }}>
          So your diet, goals and saved recipes follow you everywhere.
        </span>
      </div>

      <div className="grow" />
      <button className="pill-primary" style={{ width: "100%" }} onClick={signInGoogle}>
        Continue with Google
      </button>
      <button className="pill-secondary" style={{ width: "100%", marginTop: 10 }} onClick={() => router.push("/m")}>
        Maybe later
      </button>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <span className="t-cap">By continuing you agree to our Terms and Privacy.</span>
      </div>
    </div>
  );
}
