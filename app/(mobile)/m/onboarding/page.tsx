"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, MapPin, Check, Sparkles } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { signInWithProvider } from "@/lib/native-auth";
import { saveNutritionGoals } from "@/lib/storage";
import { defaultGoalsFromProfile } from "@/lib/nutrition";
import type { WeightGoal } from "@/lib/types";

/**
 * meshi onboarding wizard — Welcome → Location → Diet → Goals → Signup.
 * Reproduces v2-screens onboarding artboards in the --cc-* system, wired to
 * real UserContext (location, dietary prefs), the nutrition helpers (goal →
 * calorie target), and Supabase Google OAuth (auth decision: Google only,
 * no magic-link / email-OTP).
 */

type Step = "welcome" | "location" | "diet" | "goals" | "signup";
const STEPS: Step[] = ["welcome", "location", "diet", "goals", "signup"];

const DIET_OPTIONS = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Halal", "Keto", "Nut-free", "Pescatarian", "Low-carb"];
const GOAL_OPTIONS: { value: WeightGoal; label: string; sub: string }[] = [
  { value: "lose", label: "Lose weight", sub: "Gentle deficit" },
  { value: "maintain", label: "Maintain", sub: "Stay steady" },
  { value: "gain", label: "Build / gain", sub: "Lean surplus" },
];

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
      // Reasonable defaults; the tracker's Goals dialog refines later.
      const goals = defaultGoalsFromProfile({ sex: "female", age: 30, heightCm: 165, weightKg: 62, activity: "moderate", goal });
      if (goals) saveNutritionGoals(goals);
    }
    next();
  };

  // Native opens the consent screen in the system browser (Google rejects
  // embedded WebViews with `disallowed_useragent`); the return arrives via the
  // com.cravecreate.app:// deep link and NativeInit completes the session.
  const signInGoogle = async () => {
    await signInWithProvider(supabase, "google");
  };

  // ── Welcome (full-bleed) ──────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <div className="col" style={{ minHeight: "100dvh", background: "var(--m-cream)", position: "relative" }}>
        <div className="ph ph-saffron" style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 28%, rgba(0,0,0,0.85) 78%, #000 100%)" }} />
        <div className="col" style={{ position: "relative", flex: 1, padding: "60px 24px 36px", justifyContent: "flex-end", color: "#fff" }}>
          <div className="hstack" style={{ gap: 8, marginBottom: 14 }}>
            <span className="ai-orb" style={{ width: 26, height: 26 }} />
            <span className="t-cap" style={{ color: "rgba(255,255,255,0.85)" }}>MESHI</span>
          </div>
          <h1 className="t-display" style={{ marginBottom: 12, fontSize: 38 }}>
            Discover meshi.<br />Cook it. Order it.<br />Get there.
          </h1>
          <p className="t-body" style={{ opacity: 0.85, marginBottom: 24 }}>
            One craving in. Recipe, restaurants, ride and groceries out. Tell us once what you eat — we remember.
          </p>
          <div className="col" style={{ gap: 10 }}>
            <button className="pill-primary" onClick={next}>Get started</button>
            <button className="pill-secondary" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff" }} onClick={() => go("signup")}>I have an account</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Shared chrome for steps 2-5 ──────────────────────────────────────
  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--m-cream)" }}>
      <div className="hstack" style={{ padding: "calc(env(safe-area-inset-top,12px) + 8px) 22px 14px", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={back} style={{ background: "none", border: "none", color: "var(--m-ink-soft)" }} aria-label="Back">
          <ChevronLeft width={22} height={22} />
        </button>
        <div className="hstack" style={{ gap: 4 }}>
          {STEPS.slice(1).map((_, i) => (
            <div key={i} style={{ width: 22, height: 3, borderRadius: 2, background: i <= idx - 1 ? "var(--m-forest)" : "var(--m-ink-faint)" }} />
          ))}
        </div>
        {step !== "signup" ? (
          <button onClick={next} style={{ background: "none", border: "none", color: "var(--m-ink-soft)", fontSize: 13 }}>Skip</button>
        ) : (
          <span style={{ width: 36 }} />
        )}
      </div>

      {step === "location" && (
        <>
          <div className="col" style={{ flex: 1, justifyContent: "center", alignItems: "center", textAlign: "center", gap: 18, padding: "0 22px" }}>
            <div style={{ width: 100, height: 100, borderRadius: "50%", background: "var(--m-tint-green)", display: "grid", placeItems: "center", position: "relative" }}>
              <MapPin width={44} height={44} style={{ color: "var(--m-forest)" }} />
              <div style={{ position: "absolute", inset: -10, borderRadius: "50%", border: "1.5px solid var(--m-tint-green)" }} />
              <div style={{ position: "absolute", inset: -20, borderRadius: "50%", border: "1px solid var(--m-tint-green)" }} />
            </div>
            <div className="col" style={{ gap: 8, alignItems: "center" }}>
              <h1 className="t-h1">Where are you?</h1>
              <p className="t-body" style={{ color: "var(--m-ink-soft)", maxWidth: 260 }}>
                So we can find restaurants near you and estimate delivery times. We never share your location.
              </p>
            </div>
          </div>
          <div className="col" style={{ gap: 10, padding: "0 22px 20px" }}>
            <button className="pill-primary" onClick={handleUseLocation} disabled={isLoadingLocation}>
              <MapPin width={16} height={16} />{isLoadingLocation ? "Locating…" : "Use current location"}
            </button>
            <button className="pill-secondary" onClick={next}>Skip for now</button>
          </div>
        </>
      )}

      {step === "diet" && (
        <>
          <div style={{ padding: "0 22px 8px" }}>
            <h1 className="t-h1">How do you eat?</h1>
            <p className="t-body" style={{ color: "var(--m-ink-soft)", marginTop: 6 }}>Pick any that apply.</p>
          </div>
          <div className="scroll" style={{ flex: 1, padding: "14px 18px" }}>
            <div className="hstack" style={{ flexWrap: "wrap", gap: 8 }}>
              {DIET_OPTIONS.map((d) => {
                const on = diet.includes(d);
                return (
                  <button key={d} onClick={() => toggleDiet(d)} className={`chip ${on ? "on" : ""}`} style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600 }}>
                    {on && <Check width={12} height={12} />}
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ padding: "0 18px 20px" }}>
            <button className="pill-primary" onClick={saveDietAndNext}>
              Continue{diet.length > 0 ? ` · ${diet.length} selected` : ""}
            </button>
          </div>
        </>
      )}

      {step === "goals" && (
        <>
          <div style={{ padding: "0 22px 8px" }}>
            <h1 className="t-h1">What&apos;s your goal?</h1>
            <p className="t-body" style={{ color: "var(--m-ink-soft)", marginTop: 6 }}>We&apos;ll set a starting calorie target — tweak it anytime.</p>
          </div>
          <div className="col scroll" style={{ flex: 1, padding: "14px 18px", gap: 10 }}>
            {GOAL_OPTIONS.map((g) => {
              const on = goal === g.value;
              return (
                <button
                  key={g.value}
                  onClick={() => setGoal(g.value)}
                  className="card hstack"
                  style={{ padding: 16, gap: 12, justifyContent: "space-between", borderColor: on ? "var(--m-forest)" : "var(--m-ink-faint)", background: on ? "var(--m-tint-green)" : "var(--m-card)" }}
                >
                  <div className="col" style={{ gap: 2, alignItems: "flex-start" }}>
                    <span className="t-h3">{g.label}</span>
                    <span className="t-small">{g.sub}</span>
                  </div>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: on ? "none" : "1.5px solid var(--m-ink-faint)", background: on ? "var(--m-forest)" : "transparent", display: "grid", placeItems: "center" }}>
                    {on && <Check width={14} height={14} style={{ color: "#fff" }} />}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ padding: "0 18px 20px" }}>
            <button className="pill-primary" onClick={saveGoalAndNext} disabled={!goal} style={{ opacity: goal ? 1 : 0.5 }}>Continue</button>
          </div>
        </>
      )}

      {step === "signup" && (
        <div className="col" style={{ flex: 1, padding: "8px 22px 24px" }}>
          <h1 className="t-display" style={{ fontSize: 30, marginTop: 12 }}>Save your<br />preferences.</h1>
          <p className="t-body" style={{ color: "var(--m-ink-soft)", marginTop: 10, marginBottom: 28 }}>So your taste follows you across devices.</p>
          <div className="col" style={{ gap: 10 }}>
            <button className="pill-primary" onClick={signInGoogle}>
              <Sparkles width={16} height={16} /> Continue with Google
            </button>
            <button className="pill-secondary" onClick={() => router.push("/m")}>Maybe later</button>
          </div>
          <p className="t-small" style={{ marginTop: "auto", textAlign: "center", color: "var(--m-ink-soft)" }}>
            By continuing you agree to our Terms and Privacy.
          </p>
        </div>
      )}
    </div>
  );
}
