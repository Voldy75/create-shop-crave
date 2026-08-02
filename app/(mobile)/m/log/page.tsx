"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Flame, Sparkles, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { getMealLogs, getNutritionGoals, saveMealLog } from "@/lib/storage";
import { dayTotals, localDateKey, loggingStreak } from "@/lib/nutrition";
import { isNative, captureMealPhoto } from "@/lib/native-bridge";
import { BoBowl } from "@/components/mascots";
import type { MealLog, MealType, NutritionGoals } from "@/lib/types";

/**
 * Camera logging — built to the Flow 6 artboards 3e (capture) and 3f (Bo's
 * verdict). One route, two phases, because the captured image never has to
 * survive a navigation.
 *
 * This is the mobile face of the same capability the web app already ships in
 * components/planner/LogMealSheet — same /api/meals/analyze endpoint, same
 * low-confidence handling, same "photo is not stored" guarantee.
 *
 * TWO ARTBOARD ELEMENTS ARE DELIBERATELY NOT BUILT, because both would be
 * inventing capability the product does not have:
 *
 *  - The "Barcode" mode chip. There is no barcode scanner and no product
 *    database behind one; a third chip that does nothing is a dead control.
 *    Photo and Describe it are the two modes that actually work.
 *  - The live "Detected: rice bowl · 92%" chip on the viewfinder. Analysis is
 *    a single quota-metered call that happens AFTER the shutter, so a live
 *    confidence readout would be a fabricated number. The real confidence is
 *    shown on the verdict screen, where it is a real one.
 *
 * The third mode chip is Manual instead. /api/meals/analyze requires a session
 * and is quota-metered, so without a no-AI path a signed-out user — or one who
 * has spent their daily photo quota — could not log a meal at all. Manual drops
 * straight to the verdict screen with empty, editable values.
 */

const DEFAULT_GOALS: NutritionGoals = { dailyCalories: 2000, protein: 150, carbs: 225, fat: 56, goal: "maintain" };
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const PORTIONS = [0.5, 1, 1.5, 2];

interface AnalyzeResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  notes?: string;
  needsConfirmation?: boolean;
}

/** Meal type guessed from the clock, matching the web sheet's behaviour. */
function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export default function MobileLog() {
  const router = useRouter();

  const [phase, setPhase] = useState<"capture" | "verdict">("capture");
  const [mode, setMode] = useState<"photo" | "describe" | "manual">("photo");
  const [image, setImage] = useState<string | null>(null);
  const [describe, setDescribe] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [portion, setPortion] = useState(1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });

  const [logs, setLogs] = useState<MealLog[]>([]);
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_GOALS);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [liveCamera, setLiveCamera] = useState(false);

  useEffect(() => {
    setLogs(getMealLogs());
    setGoals(getNutritionGoals() ?? DEFAULT_GOALS);
  }, []);

  /* A real viewfinder on the web, per the artboard. Native uses the OS camera
     instead, and any failure (no permission, no device, http) simply falls back
     to the file picker below — the screen must never dead-end on a denied
     permission. */
  useEffect(() => {
    if (phase !== "capture" || mode !== "photo" || isNative()) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setLiveCamera(true);
      } catch {
        setLiveCamera(false);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [phase, mode]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLiveCamera(false);
  }, []);

  const analyze = useCallback(async (payload: { kind: "photo"; imageBase64: string } | { kind: "dish"; name: string }) => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, mealType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error === "photo_quota_exceeded"
            ? "Daily photo limit reached. Try again tomorrow, or add your own API key."
            : res.status === 401
              ? "Sign in to let Bo read your plate."
              : data.message || "Bo couldn't read that one.",
        );
        return;
      }
      const r = data as AnalyzeResult;
      setResult(r);
      setDraft({
        name: r.name,
        calories: String(r.calories),
        protein: String(r.protein),
        carbs: String(r.carbs),
        fat: String(r.fat),
      });
      setPortion(1);
      setEditing(false);
      setPhase("verdict");
    } catch {
      setError("Network error — try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [mealType]);

  /** No AI, no session needed — straight to the verdict screen, fields open. */
  const startManual = () => {
    stopCamera();
    setMode("manual");
    setResult(null);
    setImage(null);
    setError(null);
    setDraft({ name: "", calories: "", protein: "", carbs: "", fat: "" });
    setPortion(1);
    setEditing(true);
    setPhase("verdict");
  };

  /** Freeze the current video frame and send it. */
  const shoot = async () => {
    if (isNative()) {
      const dataUrl = await captureMealPhoto();
      if (!dataUrl) return;
      setImage(dataUrl);
      await analyze({ kind: "photo", imageBase64: dataUrl });
      return;
    }
    const video = videoRef.current;
    if (!video || !liveCamera) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    stopCamera();
    setImage(dataUrl);
    await analyze({ kind: "photo", imageBase64: dataUrl });
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    stopCamera();
    setImage(dataUrl);
    await analyze({ kind: "photo", imageBase64: dataUrl });
  };

  const streak = useMemo(() => loggingStreak(logs), [logs]);
  const today = localDateKey();
  const consumed = useMemo(() => dayTotals(logs, today).calories, [logs, today]);

  const n = (s: string) => Math.max(0, Number(s) || 0);
  const scaled = {
    calories: Math.round(n(draft.calories) * portion),
    protein: Math.round(n(draft.protein) * portion),
    carbs: Math.round(n(draft.carbs) * portion),
    fat: Math.round(n(draft.fat) * portion),
  };
  const projected = consumed + scaled.calories;
  const fits = projected <= goals.dailyCalories;

  const canLog = draft.name.trim().length > 0 && scaled.calories > 0;

  const logIt = () => {
    if (!canLog) return;
    saveMealLog({
      date: today,
      mealType,
      source: image ? "photo" : result ? "search" : "manual",
      name: draft.name.trim() || "Meal",
      calories: scaled.calories,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
      notes: result?.notes,
      imageDataUrl: image ?? undefined,
    });
    router.push("/m/plan");
  };

  // ---------- Capture (3e) ----------
  if (phase === "capture") {
    return (
      <div className="capture-shell">
        <div className="capture-view">
          {mode === "photo" ? (
            <>
              {liveCamera && <video ref={videoRef} autoPlay playsInline muted className="capture-video" />}
              <div className="capture-frame" />
              <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 12px) + 20px)", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                <span className="chip capture-hint">Center the plate — Bo&rsquo;s watching 👀</span>
              </div>
              {!liveCamera && !isNative() && (
                <div className="vstack" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 12, padding: 30, textAlign: "center" }}>
                  <BoBowl width={56} height={56} />
                  <span className="t-body on-dark-text">No live camera here — pick a photo instead.</span>
                </div>
              )}
            </>
          ) : (
            <div className="vstack" style={{ position: "absolute", inset: 0, justifyContent: "center", gap: 14, padding: 24 }}>
              <BoBowl width={56} height={56} style={{ alignSelf: "center" }} />
              <span className="t-body on-dark-text" style={{ textAlign: "center" }}>Tell Bo what you ate and he&rsquo;ll do the math.</span>
              <input
                value={describe}
                onChange={(e) => setDescribe(e.target.value)}
                placeholder="e.g. 2 idlis with sambar"
                className="input"
                style={{ width: "100%" }}
                onKeyDown={(e) => { if (e.key === "Enter" && describe.trim() && !analyzing) analyze({ kind: "dish", name: describe.trim() }); }}
              />
              <button
                className="pill-primary"
                style={{ width: "100%" }}
                disabled={!describe.trim() || analyzing}
                onClick={() => analyze({ kind: "dish", name: describe.trim() })}
              >
                <Sparkles width={16} height={16} /> {analyzing ? "Bo’s thinking…" : "Estimate it"}
              </button>
            </div>
          )}

          {analyzing && (
            <div className="vstack capture-busy">
              <BoBowl width={64} height={64} style={{ animation: "mm-bob 2.4s ease-in-out infinite" }} />
              <span className="t-body on-dark-text">Bo&rsquo;s reading your plate…</span>
            </div>
          )}
        </div>

        <div className="capture-controls">
          {error && (
            <div className="hstack" style={{ gap: 8, padding: "0 24px" }}>
              <AlertTriangle width={16} height={16} style={{ color: "var(--m-orange)", flex: "none" }} />
              <span className="t-cap on-dark-text">{error}</span>
            </div>
          )}

          {/* Barcode is intentionally absent — see the note at the top. */}
          <div className="hstack" style={{ gap: 10 }}>
            <button className={`chip ${mode === "photo" ? "chip-active" : "on-dark"}`} onClick={() => setMode("photo")}>Photo</button>
            <button className={`chip ${mode === "describe" ? "chip-active" : "on-dark"}`} onClick={() => { stopCamera(); setMode("describe"); }}>Describe it</button>
            <button className={`chip ${mode === "manual" ? "chip-active" : "on-dark"}`} onClick={startManual}>Manual</button>
          </div>

          <div className="hstack" style={{ gap: 34 }}>
            <button className="icon-btn on-dark" onClick={() => router.back()} aria-label="Back">
              <ArrowLeft width={20} height={20} />
            </button>

            {mode === "photo" ? (
              liveCamera || isNative() ? (
                <button className="shutter" onClick={shoot} disabled={analyzing} aria-label="Take photo"><span /></button>
              ) : (
                <label className="shutter" aria-label="Choose a photo">
                  <span />
                  <input type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: "none" }} />
                </label>
              )
            ) : (
              <span style={{ width: 74 }} />
            )}

            {mode === "photo" && (liveCamera || isNative()) ? (
              <label className="icon-btn on-dark" aria-label="Choose from library">
                <ImageIcon width={20} height={20} />
                <input type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
              </label>
            ) : (
              <span style={{ width: 42 }} />
            )}
          </div>

          <span className="t-cap on-dark-dim">
            {streak > 0 ? `Streak day ${streak + 1} unlocks with this log` : "Log today to start a streak"}
          </span>
          <span className="t-cap on-dark-dim">Photos go to the model for analysis. They are not stored on our servers.</span>
        </div>
      </div>
    );
  }

  // ---------- Bo's verdict (3f) ----------
  const confidencePct = result ? Math.round(result.confidence * 100) : 0;

  return (
    <div className="vstack" style={{ minHeight: "100dvh", background: "var(--m-cream)", padding: "calc(env(safe-area-inset-top, 12px) + 8px) 20px 30px", gap: 12 }}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => { setPhase("capture"); setResult(null); setImage(null); }} aria-label="Back">
          <ArrowLeft width={20} height={20} />
        </button>
        <span className="t-h1 grow" style={{ textAlign: "center", marginRight: 42 }}>Log this meal</span>
      </div>

      {/* What Bo saw. The artboard's duotone hero only works over a photo —
          laid over the empty-state gradient its white title is unreadable, so
          the no-photo case gets a plain tinted header instead. */}
      {image ? (
        <div
          className="duo duo-forest"
          style={{ height: 170, flex: "none", backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="duo-body vstack" style={{ justifyContent: "flex-end", padding: 14, gap: 2 }}>
            <span style={{ font: "800 20px/1.05 var(--m-font-display)", color: "var(--m-on-deep)" }}>{draft.name || "Your meal"}</span>
            {/* Only claim a confidence when Bo actually produced one. */}
            <span className="t-cap on-photo-soft">
              {result ? `Bo is ${confidencePct}% sure. Correct him, gently.` : "Fill in what you ate."}
            </span>
          </div>
        </div>
      ) : (
        <div className="card tint-green vstack" style={{ boxShadow: "none", padding: "14px 16px", gap: 2 }}>
          <span className="t-d2">{draft.name || "Your meal"}</span>
          <span className="t-cap">
            {result ? `Bo is ${confidencePct}% sure. Correct him, gently.` : "Fill in what you ate."}
          </span>
        </div>
      )}

      {/* Low confidence is the one case where the artboard's cheerful framing
          would be wrong — say so plainly. */}
      {result?.needsConfirmation && (
        <div className="card tint-peach hstack" style={{ boxShadow: "none", padding: "12px 14px", gap: 10 }}>
          <AlertTriangle width={18} height={18} style={{ color: "var(--m-burnt)", flex: "none" }} />
          <span className="t-cap" style={{ color: "var(--m-burnt)" }}>
            {result.notes ?? "Bo isn't confident here — check the numbers before logging."}
          </span>
        </div>
      )}
      {!result?.needsConfirmation && result?.notes && <span className="t-cap">{result.notes}</span>}

      {/* Macros */}
      <div className="hstack" style={{ gap: 10 }}>
        <Stat tint="tint-green" ink="var(--m-forest-2)" value={scaled.calories.toLocaleString()} label="kcal" />
        <Stat tint="tint-peach" ink="var(--m-burnt)" value={`${scaled.protein}g`} label="protein" />
        <Stat tint="tint-lav" ink="var(--m-plum)" value={`${scaled.carbs}g`} label="carbs" />
        <Stat tint="tint-cream" ink="var(--m-ink)" value={`${scaled.fat}g`} label="fat" />
      </div>

      {/* Meal type + portion */}
      <div className="hstack hscroll" style={{ gap: 8 }}>
        {MEAL_TYPES.map((m) => (
          <button key={m} className={`chip ${mealType === m ? "chip-active" : ""}`} style={{ textTransform: "capitalize" }} onClick={() => setMealType(m)}>{m}</button>
        ))}
      </div>
      <div className="hstack hscroll" style={{ gap: 8 }}>
        <span className="t-cap" style={{ flex: "none" }}>Portion</span>
        {PORTIONS.map((p) => (
          <button key={p} className={`chip ${portion === p ? "chip-active" : ""}`} onClick={() => setPortion(p)}>{p}×</button>
        ))}
      </div>

      {/* Where this lands you */}
      <div className="row">
        <span className="icon-btn tint-green" style={{ boxShadow: "none", color: "var(--m-forest)", flex: "none" }}>
          <Sparkles width={20} height={20} />
        </span>
        <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="t-h2">{fits ? "Fits your day" : "Puts you over"}</span>
          <span className="t-cap">
            You&rsquo;d land at {projected.toLocaleString()} of {goals.dailyCalories.toLocaleString()} kcal.
          </span>
        </div>
      </div>

      {/* Editable values — the web sheet keeps every field editable after an
          AI estimate, and so should this. */}
      {editing && (
        <div className="vstack" style={{ gap: 8 }}>
          <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Dish" />
          {/* flex:1 + minWidth:0 — .input has generous side padding, so four of
              them in a row overflow the viewport without an explicit shrink. */}
          <div className="hstack" style={{ gap: 8 }}>
            {([
              ["calories", "Cal"],
              ["protein", "P"],
              ["carbs", "C"],
              ["fat", "F"],
            ] as const).map(([k, ph]) => (
              <input
                key={k}
                className="input"
                inputMode="numeric"
                style={{ flex: 1, minWidth: 0, padding: "0 12px" }}
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                placeholder={ph}
              />
            ))}
          </div>
          <span className="t-cap">Values above are per 1× portion.</span>
        </div>
      )}

      <div className="grow" />

      {streak > 0 && (
        <div className="card tint-peach hstack" style={{ boxShadow: "none", padding: "12px 16px", gap: 12 }}>
          <Flame width={26} height={26} style={{ color: "var(--m-burnt)", flex: "none" }} />
          <span className="t-h2" style={{ color: "var(--m-burnt)" }}>Logging this lights Day {streak + 1} 🔥</span>
        </div>
      )}

      <button className="pill-primary" style={{ width: "100%", opacity: canLog ? 1 : 0.5 }} disabled={!canLog} onClick={logIt}>
        {canLog ? `Log it — ${scaled.calories.toLocaleString()} kcal` : "Add a dish and calories"}
      </button>
      <button
        onClick={() => setEditing((v) => !v)}
        style={{ background: "none", border: "none", textAlign: "center", padding: 0 }}
      >
        <span className="t-cap" style={{ color: "var(--m-forest)", fontWeight: 700 }}>
          {editing ? "Done editing" : "Edit values instead"}
        </span>
      </button>
    </div>
  );
}

function Stat({ tint, ink, value, label }: { tint: string; ink: string; value: string; label: string }) {
  return (
    <div className={`card ${tint} vstack grow`} style={{ boxShadow: "none", padding: 12, alignItems: "center", gap: 1, minWidth: 0 }}>
      <span style={{ font: "800 22px/1 var(--m-font-display)", color: ink }}>{value}</span>
      <span className="t-micro">{label}</span>
    </div>
  );
}
