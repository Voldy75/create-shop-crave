"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, MapPin, Check, Bell, Camera, Lock } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import { signInWithProvider } from "@/lib/native-auth";
import { saveNutritionGoals } from "@/lib/storage";
import { defaultGoalsFromProfile } from "@/lib/nutrition";
import type { WeightGoal } from "@/lib/types";
import { BoBowl, Carrot, Broccoli, Tomato, Mushroom, Avocado, Pea, Leek } from "@/components/mascots";
import { Switch } from "@/components/mobile/Switch";

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
 *
 * tastes / calories / streak / loading (2b, 2a, 2c, 6b) were added on top of
 * the original 5-step flow. The design doc marks 2a/2b/2d "superseded by
 * 4c/4b" — but 2b's cuisine tastes + hard-no's and 2a's calorie-target
 * feedback are content 4b/4c never had, not a duplicate of it, so they're
 * additive steps rather than replacements. 2d's only real delta over the
 * shipped sign-in step was Apple/Facebook buttons, which stay out: Apple
 * needs a Services ID Supabase doesn't have and OAuthProvider is typed
 * "google" | "github" only; Facebook was never wired anywhere. 2d's copy
 * ("Save your seat at the table") is used instead, since it now correctly
 * describes what's been collected.
 */

type Step =
  | "welcome"
  | "meetBo"
  | "apps"
  | "location"
  | "diet"
  | "tastes"
  | "goals"
  | "calories"
  | "streak"
  | "signup"
  | "loading";

// Steps that show the header/progress bar, in order. welcome, meetBo, apps and
// loading don't participate. That's the artboards' own structure, not a
// shortcut: 7a draws no pager at all and 7b draws its OWN two-segment one, so
// the intro pair reads as a separate beat from the preference-collection run.
// Folding them into the main bar would also squeeze it to nine slivers.
const BAR_STEPS: Step[] = ["location", "diet", "tastes", "goals", "calories", "streak", "signup"];
const STEPS: Step[] = ["welcome", "meetBo", "apps", ...BAR_STEPS];

const DIET_OPTIONS = [
  "Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Halal",
  "Keto", "Nut-free", "Pescatarian", "Low-carb",
];

const TASTE_OPTIONS = [
  "Ramen", "Tacos", "Curry", "Pizza", "Sushi", "Salads",
  "BBQ", "Pho", "Pasta", "Dumplings", "Breakfast all day",
];

const AVOID_OPTIONS = ["Peanuts", "Shellfish", "Dairy", "Gluten", "Cilantro", "Olives"];

/** Artboard 7a's three capability rows, each on its own tint. */
const BO_CAN_DO: { n: string; title: string; body: string; tint: string; ink: string }[] = [
  { n: "1", title: "Turn cravings into plans", body: "Say you're hungry — I spin up recipes, grocery lists or a table.", tint: "var(--m-tint-green)", ink: "var(--m-forest)" },
  { n: "2", title: "Cook, buy, or dine out", body: "One chat, three ways to eat — make it, order the ingredients, or book a seat.", tint: "var(--m-tint-peach)", ink: "var(--m-burnt)" },
  { n: "3", title: "Learn your taste", body: "Veg, dairy-free, that cilantro grudge — I remember and filter everything.", tint: "var(--m-tint-lav)", ink: "var(--m-plum)" },
];

// hex-ok-start: partners' own brand colours — identity, not theme, so they do
// not track meshi's palette or flip with dark mode. Same allowlisted pattern
// as ConnectionsSection and the web landing's integrations strip.
const PARTNER_ORANGE = "#FC8019"; // Swiggy
const PARTNER_RED = "#E23744";    // Zomato
const PARTNER_GREEN = "#0AAD0A";  // Instacart
const PARTNER_BLACK = "#000000";  // Uber
const PARTNER_LIME = "#C6F000";   // Ola
const PARTNER_ON_DARK = "#FFFFFF";
// hex-ok-end

/** Artboard 7b. `mark` is the partner's own wordmark colour pairing. */
const PARTNERS: { key: string; label: string; sub: string; bg: string; fg: string; short: string }[] = [
  { key: "swiggy", label: "Swiggy", sub: "Food delivery · Instamart · Dineout", bg: PARTNER_ORANGE, fg: PARTNER_ON_DARK, short: "S" },
  { key: "zomato", label: "Zomato", sub: "Restaurant delivery & dining", bg: PARTNER_RED, fg: PARTNER_ON_DARK, short: "Z" },
  { key: "instacart", label: "Instacart", sub: "Grocery runs, ingredient by ingredient", bg: PARTNER_GREEN, fg: PARTNER_ON_DARK, short: "I" },
];

const RIDE_PARTNERS: { key: string; label: string; bg: string; fg: string }[] = [
  { key: "uber", label: "Uber", bg: PARTNER_BLACK, fg: PARTNER_ON_DARK },
  { key: "ola", label: "Ola", bg: PARTNER_LIME, fg: PARTNER_BLACK },
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

// The demographic profile Bo's calorie math runs against. No screen in this
// flow (design or shipped) collects sex/age/height/weight, so this stand-in
// is unchanged from the original goal step — a real profile capture is a
// separate piece of work, not something 2a's artboard adds.
const STAND_IN_PROFILE = { sex: "female" as const, age: 30, heightCm: 165, weightKg: 62, activity: "moderate" as const };

/** 4-segment pager: lime behind you, forest where you are, faint ahead. */
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="step-bar">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={`step-seg ${i < current ? "done" : i === current ? "now" : ""}`} />
      ))}
    </div>
  );
}

/** Shared top row for steps 2+: back, progress, skip. */
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
      <StepBar current={current} total={BAR_STEPS.length} />
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
  const { requestLocation, isLoadingLocation, setDietaryPreferences, setFavoriteCuisines } = useUser();

  const [step, setStep] = useState<Step>("welcome");
  const [diet, setDiet] = useState<string[]>([]);
  const [tastes, setTastes] = useState<string[]>([]);
  const [avoids, setAvoids] = useState<string[]>([]);
  const [goal, setGoal] = useState<WeightGoal | null>(null);
  const [notifOn, setNotifOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const idx = STEPS.indexOf(step);
  const barIdx = BAR_STEPS.indexOf(step); // -1 for welcome/loading, which don't use it
  const go = (s: Step) => setStep(s);
  const next = () => go(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  const back = () => (idx <= 0 ? router.push("/m") : go(STEPS[idx - 1]));

  const toggleDiet = (d: string) =>
    setDiet((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const toggleTaste = (t: string) =>
    setTastes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const toggleAvoid = (a: string) =>
    setAvoids((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  const handleUseLocation = async () => {
    await requestLocation();
    next();
  };

  const saveDietAndNext = () => {
    setDietaryPreferences(diet.map((d) => d.toLowerCase()));
    next();
  };

  // Runs after the diet step already saved. Merges rather than overwrites,
  // so hard-no allergies land alongside — not instead of — the diet picks.
  const saveTastesAndNext = () => {
    setFavoriteCuisines(tastes);
    const avoidTags = avoids.map((a) => `avoid ${a.toLowerCase()}`);
    setDietaryPreferences([...diet.map((d) => d.toLowerCase()), ...avoidTags]);
    next();
  };

  const previewGoals = goal
    ? defaultGoalsFromProfile({ ...STAND_IN_PROFILE, goal })
    : null;

  const saveGoalAndNext = () => {
    if (previewGoals) saveNutritionGoals(previewGoals);
    next();
  };

  const lightTheFlame = () => {
    if (notifOn) {
      // Best-effort — mirrors the pattern already used for audit logging and
      // tracker sync elsewhere: a denied/unsupported push subscription must
      // never block onboarding.
      import("@/lib/push-client").then(({ enableWebPush }) => {
        void enableWebPush().catch(() => {});
      });
      // Whether granted or denied, the browser has now been asked — 7d's
      // bottom-up prompt gates on the SAME permission state, so without this
      // it would ask again on the very first Home visit.
      if (typeof window !== "undefined") localStorage.setItem("crave_notifPromptSeen", "1");
    }
    if (typeof window !== "undefined") {
      // Recorded consent, not a permission grant — getUserMedia still prompts
      // for real at first camera use in /m/log. This just tells that screen
      // the user opted in during onboarding.
      localStorage.setItem("crave_cameraOptIn", JSON.stringify(camOn));
    }
    next();
  };

  // Header "Skip" and "Maybe later" — unlike the primary CTA, skipping this
  // step must NOT trigger a real browser permission prompt behind the user's
  // back just because the toggles default on.
  const skipStreak = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("crave_cameraOptIn", "false");
    }
    next();
  };

  const signInGoogle = async () => {
    setAuthError(null);
    go("loading");
    const { error } = await signInWithProvider(supabase, "google", "/m?welcome=1");
    if (error) {
      setAuthError(error);
      go("signup");
    }
    // On success: web navigates away to Google immediately; native opens the
    // system browser and initDeepLinks routes back to /m on return. Nothing
    // left to do here in either case.
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

  // ── Meet Bo (7a) ──────────────────────────────────────────────────────
  if (step === "meetBo") {
    return (
      <div style={SHELL} className="vstack">
        <div className="hstack">
          <button className="icon-btn" onClick={back} aria-label="Back">
            <ArrowLeft width={20} height={20} />
          </button>
        </div>

        <div className="vstack" style={{ gap: 6, marginTop: 14 }}>
          <span className="t-d1">Hi, I&rsquo;m Bo</span>
          <span className="t-body-soft">Your AI food buddy — with actual taste.</span>
        </div>

        {/* The artboard's "Ask me anything" field is a STILL of the chat
            composer, not a working input — tapping it should land you in the
            real one rather than opening a keyboard on a dead field. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, margin: "18px 0 4px" }}>
          <BoBowl width={92} height={92} style={{ animation: "mm-bob 2.4s ease-in-out infinite" }} />
          <button
            onClick={() => router.push("/m/chat")}
            className="input"
            style={{ width: "100%", height: 56, gap: 2, boxShadow: "inset 0 0 0 2.5px var(--m-forest)", cursor: "pointer" }}
          >
            <span style={{ color: "var(--m-ink-soft)" }}>Ask me anything</span>
            <span style={{ width: 2, height: 20, background: "var(--m-forest)", animation: "mm-blink 1.1s step-end infinite" }} />
          </button>
        </div>

        <span className="t-micro" style={{ marginTop: 14 }}>What Bo can do</span>
        <div className="card" style={{ padding: "6px 4px", marginTop: 8 }}>
          {BO_CAN_DO.map(({ n, title, body, tint, ink }, i) => (
            <div key={n}>
              {i > 0 && <div style={{ height: 1.5, background: "var(--m-ink-faint)", margin: "0 16px" }} />}
              <div className="row" style={{ boxShadow: "none", background: "transparent" }}>
                <span
                  style={{
                    width: 34, height: 34, borderRadius: "50%", background: tint, color: ink,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    font: "800 15px var(--m-font-display)", flex: "none",
                  }}
                >
                  {n}
                </span>
                <div className="vstack grow" style={{ gap: 2 }}>
                  <span className="t-h2">{title}</span>
                  <span className="t-cap">{body}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grow" />
        <button className="pill-primary" style={{ width: "100%" }} onClick={next}>
          Next
        </button>
      </div>
    );
  }

  // ── Bo works with your apps (7b) ──────────────────────────────────────
  if (step === "apps") {
    return (
      <div style={SHELL} className="vstack">
        <div className="hstack">
          <button className="icon-btn" onClick={back} aria-label="Back">
            <ArrowLeft width={20} height={20} />
          </button>
          {/* 7b's own two-segment pager — this pair's progress, not the
              preference run's. See the BAR_STEPS note. */}
          <div className="hstack grow" style={{ gap: 6, padding: "0 10px" }}>
            <i style={{ flex: 1, height: 7, borderRadius: 9, background: "var(--m-forest)" }} />
            <i style={{ flex: 1, height: 7, borderRadius: 9, background: "var(--m-forest)" }} />
          </div>
          <button className="t-cap" onClick={next} style={{ background: "none", border: "none" }}>
            Skip
          </button>
        </div>

        <div className="vstack" style={{ gap: 6, marginTop: 10 }}>
          <span className="t-d2">Bo plugs into the<br />apps you already use</span>
          <span className="t-body-soft">
            No new accounts. Bo hands off cooking, groceries, delivery and rides to the right app.
          </span>
        </div>

        <div className="vstack" style={{ gap: 8, marginTop: 14 }}>
          {PARTNERS.map(({ key, label, sub, bg, fg, short }) => (
            <div key={key} className="row" style={{ padding: "12px 14px" }}>
              <span
                style={{
                  width: 44, height: 44, borderRadius: 13, background: bg, color: fg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flex: "none", font: "800 17px var(--m-font-display)",
                }}
              >
                {short}
              </span>
              <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                <span className="t-h2">{label}</span>
                <span className="t-cap">{sub}</span>
              </div>
            </div>
          ))}

          <div className="hstack" style={{ gap: 8 }}>
            {RIDE_PARTNERS.map(({ key, label, bg, fg }) => (
              <div key={key} className="row grow" style={{ padding: "12px 14px", minWidth: 0 }}>
                <span
                  style={{
                    width: 44, height: 44, borderRadius: 13, background: bg, color: fg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flex: "none", font: "800 13px var(--m-font-display)",
                  }}
                >
                  {label}
                </span>
                <div className="vstack" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t-h2">{label}</span>
                  <span className="t-cap">Rides</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grow" />
        {/* Deliberately says "anytime in Settings" and nothing stronger: of
            these five, only Swiggy has an account-linking path at all, and it
            is blocked upstream (Dead End 1). Promising five connections here
            would be a claim the product cannot honour. */}
        <div className="card tint-green" style={{ boxShadow: "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Lock width={22} height={22} style={{ color: "var(--m-forest)", flex: "none" }} />
          <span className="t-cap" style={{ color: "var(--m-forest-2)" }}>
            Connect accounts anytime in Settings — Bo works without them too.
          </span>
        </div>
        <button className="pill-primary" style={{ width: "100%" }} onClick={next}>
          Got it
        </button>
      </div>
    );
  }

  // ── Location — Tomato scouts the block ───────────────────────────────
  if (step === "location") {
    return (
      <div style={SHELL} className="vstack">
        <StepHeader current={barIdx} onBack={back} onSkip={next} />

        <div
          className="tint-green"
          style={{
            marginTop: 12, borderRadius: 30, padding: "30px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}
        >
          <div style={{ position: "relative", width: 130, height: 130 }}>
            <span className="bo-halo" />
            <span className="bo-halo-inner" />
            <span style={{ position: "absolute", inset: 36, borderRadius: "50%", background: "var(--m-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Tomato width={42} height={42} style={{ animation: "mm-bob 2.4s ease-in-out infinite" }} />
            </span>
            <MapPin width={26} height={26} style={{ position: "absolute", top: 2, right: 8, color: "var(--m-forest)" }} />
          </div>
          <span className="t-cap" style={{ color: "var(--figure-accent)" }}>
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
        <StepHeader current={barIdx} onBack={back} onSkip={next} />

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

  // ── Tastes — cravings + hard no's (2b) ───────────────────────────────
  if (step === "tastes") {
    return (
      <div style={SHELL} className="vstack">
        <StepHeader current={barIdx} onBack={back} onSkip={saveTastesAndNext} />

        <div className="vstack" style={{ gap: 4, marginTop: 8 }}>
          <span className="t-d2">What makes you<br />drool?</span>
          <span className="t-body-soft">Pick a few — Bo takes notes.</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 8 }}>
          {TASTE_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => toggleTaste(t)}
              className={`chip ${tastes.includes(t) ? "chip-active" : ""}`}
              aria-pressed={tastes.includes(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="vstack" style={{ gap: 4, marginTop: 14 }}>
          <span className="t-h1">Hard no&rsquo;s</span>
          <span className="t-body-soft">Allergies and never-evers. Bo never suggests these.</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 4 }}>
          {AVOID_OPTIONS.map((a) => {
            const on = avoids.includes(a);
            return (
              <button
                key={a}
                onClick={() => toggleAvoid(a)}
                className="chip"
                aria-pressed={on}
                style={on ? { background: "var(--m-tint-peach)", boxShadow: "none", color: "var(--m-red)" } : undefined}
              >
                {a}{on ? " ✕" : ""}
              </button>
            );
          })}
        </div>

        <div className="grow" />
        {avoids.length > 0 && (
          <div className="toast tint-green" style={{ boxShadow: "none", marginBottom: 10 }}>
            <Leek width={30} height={30} />
            Noted. {avoids.join(" + ")} shall not pass.
          </div>
        )}
        <button className="pill-primary" style={{ width: "100%" }} onClick={saveTastesAndNext}>
          {tastes.length ? `Next — ${tastes.length} picked` : "Next"}
        </button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="t-cap" onClick={saveTastesAndNext} style={{ background: "none", border: "none" }}>
            Not picky — skip
          </button>
        </div>
      </div>
    );
  }

  // ── Goal — a mascot per goal, as list rows ───────────────────────────
  if (step === "goals") {
    return (
      <div style={SHELL} className="vstack">
        <StepHeader current={barIdx} onBack={back} onSkip={next} />

        <div className="vstack" style={{ gap: 6, marginTop: 8 }}>
          <span className="t-d2">What&rsquo;s the goal?</span>
        </div>

        {/* `.row` here is meshi-b's genuine LIST ROW card — one of the two
            cases in the mobile tree where that class is used as designed. */}
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
          onClick={next}
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

  // ── Calories — target preview before it's saved (2a) ─────────────────
  if (step === "calories") {
    const kcal = previewGoals?.dailyCalories ?? null;
    const pct = kcal ? Math.min(100, Math.round((kcal / 2800) * 100)) : 0;
    return (
      <div style={SHELL} className="vstack">
        <StepHeader current={barIdx} onBack={back} onSkip={saveGoalAndNext} />

        <div className="hstack" style={{ gap: 14, marginTop: 10 }}>
          <BoBowl width={64} height={64} style={{ flex: "none" }} />
          <div className="card tint-green" style={{ boxShadow: "none", padding: "12px 16px", borderBottomLeftRadius: 6 }}>
            <span className="t-body">Here&rsquo;s where Bo will start you off. You can refine this anytime.</span>
          </div>
        </div>

        <div className="card tint-peach" style={{ boxShadow: "none", padding: "14px 16px", marginTop: 14 }}>
          <div className="vstack" style={{ gap: 8 }}>
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <span className="t-cap" style={{ color: "var(--m-brown)" }}>Daily calorie target</span>
              <span className="t-h2" style={{ color: "var(--m-burnt)" }}>{kcal ? `${kcal.toLocaleString()} kcal` : "—"}</span>
            </div>
            <div className="progress">
              <i style={{ width: `${pct}%`, background: "var(--m-burnt)" }} />
            </div>
          </div>
        </div>

        <div className="card tint-peach" style={{ boxShadow: "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <BoBowl width={24} height={24} style={{ flex: "none" }} />
          <span className="t-body" style={{ color: "var(--m-brown)" }}>
            Bo&rsquo;s starting target: <b>{kcal ? `${kcal.toLocaleString()} kcal/day` : "—"}</b>. Refine anytime in the tracker.
          </span>
        </div>

        <div className="grow" />
        <button className="pill-primary" style={{ width: "100%" }} onClick={saveGoalAndNext}>
          Sounds like me
        </button>
      </div>
    );
  }

  // ── Streak & notifications opt-in (2c) ────────────────────────────────
  if (step === "streak") {
    return (
      <div style={SHELL} className="vstack">
        <StepHeader current={barIdx} onBack={back} onSkip={skipStreak} />

        <div
          className="tint-peach"
          style={{
            marginTop: 10, borderRadius: 30, padding: "26px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center",
          }}
        >
          <div className="hstack" style={{ gap: 8 }}>
            <Bell width={26} height={26} style={{ color: "var(--m-burnt)" }} />
            <span style={{ font: "800 40px/1 var(--m-font-display)", color: "var(--m-burnt)" }}>Day 1</span>
          </div>
          <span className="t-h2" style={{ color: "var(--m-brown)" }}>
            Log a meal a day, grow your streak,<br />adopt the whole veggie gang.
          </span>
          <div className="hstack" style={{ gap: 8, marginTop: 4 }}>
            <div className="mascot-tile" style={{ background: "var(--m-card)", padding: "8px 10px" }}>
              <Carrot width={34} height={34} />
              <span className="t-micro">Day 1</span>
            </div>
            <div className="mascot-tile mascot-locked" style={{ background: "var(--m-card)", padding: "8px 10px" }}>
              <Leek width={34} height={34} />
              <span className="t-micro">Day 3</span>
            </div>
            <div className="mascot-tile mascot-locked" style={{ background: "var(--m-card)", padding: "8px 10px" }}>
              <Broccoli width={34} height={34} />
              <span className="t-micro">Day 5</span>
            </div>
            <div className="mascot-tile mascot-locked" style={{ background: "var(--m-card)", padding: "8px 10px" }}>
              <Tomato width={34} height={34} />
              <span className="t-micro">Day 7</span>
            </div>
          </div>
        </div>

        <button className="row" style={{ marginTop: 10, width: "100%", border: "none", textAlign: "left" }} onClick={() => setNotifOn((v) => !v)}>
          <span className="icon-btn tint-peach" style={{ boxShadow: "none", color: "var(--m-burnt)", flex: "none" }}>
            <Bell width={20} height={20} />
          </span>
          <div className="vstack grow" style={{ gap: 1 }}>
            <span className="t-h2">Dinner-time nudges</span>
            <span className="t-cap">One gentle poke a day, never spam</span>
          </div>
          <Switch on={notifOn} />
        </button>

        <button className="row" style={{ width: "100%", border: "none", textAlign: "left" }} onClick={() => setCamOn((v) => !v)}>
          <span className="icon-btn tint-green" style={{ boxShadow: "none", color: "var(--m-forest)", flex: "none" }}>
            <Camera width={20} height={20} />
          </span>
          <div className="vstack grow" style={{ gap: 1 }}>
            <span className="t-h2">Camera access</span>
            <span className="t-cap">Snap food, Bo counts the calories</span>
          </div>
          <Switch on={camOn} />
        </button>

        <div className="grow" />
        <button className="pill-primary" style={{ width: "100%" }} onClick={lightTheFlame}>
          Light the flame
        </button>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button className="t-cap" onClick={skipStreak} style={{ background: "none", border: "none" }}>
            Maybe later
          </button>
        </div>
      </div>
    );
  }

  // ── Loading — post-Google hand-off (6b) ───────────────────────────────
  if (step === "loading") {
    const bits = [
      ...diet.slice(0, 2).map((d) => d.toLowerCase()),
      ...(goal ? [GOAL_OPTIONS.find((g) => g.value === goal)?.label.toLowerCase()] : []),
    ].filter(Boolean);
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 34px", gap: 14 }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8, animation: "mm-fadeup .8s ease-out both" }}>
          <span className="t-d2">Setting the table&hellip;</span>
          <span className="t-body-soft">
            {bits.length ? `${bits.join(" · ")}.` : ""}
            <br />Bo is briefing the kitchen.
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", height: 84, marginTop: 18 }}>
          <Carrot width={52} height={52} className="mm-move-bounce" />
          <Tomato width={52} height={52} className="mm-move-bounce" style={{ animationDelay: ".15s" }} />
          <BoBowl width={64} height={64} className="mm-move-bounce" style={{ animationDelay: ".3s" }} />
          <Mushroom width={52} height={52} className="mm-move-bounce" style={{ animationDelay: ".45s" }} />
          <Broccoli width={52} height={52} className="mm-move-bounce" style={{ animationDelay: ".6s" }} />
        </div>
        <div style={{ width: "100%", maxWidth: 250, marginTop: 22 }}>
          <div className="progress progress-lime">
            <i style={{ animation: "mm-fill 3.2s ease-in-out infinite alternate" }} />
          </div>
        </div>
        {authError && (
          <span className="t-cap" style={{ color: "var(--m-red)", marginTop: 8 }}>
            {authError}
          </span>
        )}
      </div>
    );
  }

  // ── Sign in (2d) ────────────────────────────────────────────────────
  return (
    <div style={SHELL} className="vstack">
      <StepHeader current={barIdx} onBack={back} />

      <div
        className="tint-green"
        style={{
          marginTop: 12, borderRadius: 30, padding: "30px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}
      >
        <BoBowl width={96} height={96} style={{ animation: "mm-bob 3s ease-in-out infinite" }} />
        <span className="t-cap" style={{ color: "var(--figure-accent)" }}>
          Bo remembers your taste across devices.
        </span>
      </div>

      <div className="vstack" style={{ gap: 6, marginTop: 16, textAlign: "center" }}>
        <span className="t-d2">Save your seat<br />at the table</span>
        <span className="t-body-soft" style={{ padding: "0 10px" }}>
          Your goal, tastes and Day-1 streak are packed. Sign in so they survive a phone swap.
        </span>
      </div>

      {authError && (
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <span className="t-cap" style={{ color: "var(--m-red)" }}>Couldn&rsquo;t sign in — {authError}</span>
        </div>
      )}

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
