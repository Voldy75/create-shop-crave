"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Camera, Loader2 } from "lucide-react";
import {
  getMealLogs,
  getNutritionGoals,
  saveMealLog,
  deleteMealLog,
} from "@/lib/storage";
import { dayTotals, lastNDates, localDateKey, loggingStreak } from "@/lib/nutrition";
import { isNative, captureMealPhoto } from "@/lib/native-bridge";
import { Beet } from "@/components/mascots";
import type { MealLog, MealType, NutritionGoals } from "@/lib/types";

/**
 * Plan tab — "Today" meal tracker, built to the Flow 6 artboard (1j).
 *
 * The artboard reframes the hero: the ring counts calories CONSUMED against the
 * goal ("1,380 of 2,000") rather than counting down what is left, and the three
 * macros are full-width `.progress` bars beside it instead of three cramped
 * columns underneath.
 *
 * Two things here are real data the artboard only mocks: the flame chip uses
 * lib/nutrition's loggingStreak, and Bo's closing toast is computed from the
 * remaining calories rather than being fixed copy.
 *
 * The floating + button is gone — the artboard makes the dashed "snap it" row
 * the single logging affordance, which is also where a user's eye already is
 * after reading the list.
 */

const DEFAULT_GOALS: NutritionGoals = { dailyCalories: 2000, protein: 150, carbs: 225, fat: 56, goal: "maintain" };
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/** The artboard heads each logged row with an emoji when there is no photo. */
const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍽️",
  snack: "🍎",
};

function timeOf(log: MealLog): string {
  const d = new Date(log.loggedAt);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function PlanTracker() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_GOALS);
  const [selected, setSelected] = useState(localDateKey());
  const [sheet, setSheet] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs(getMealLogs());
    setGoals(getNutritionGoals() ?? DEFAULT_GOALS);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && stripRef.current) stripRef.current.scrollLeft = stripRef.current.scrollWidth;
  }, [hydrated]);

  const week = useMemo(() => lastNDates(7), []);
  const today = useMemo(() => localDateKey(), []);
  const totals = useMemo(() => dayTotals(logs, selected), [logs, selected]);
  const dayLogs = useMemo(() => logs.filter((l) => l.date === selected), [logs, selected]);
  const streak = useMemo(() => loggingStreak(logs), [logs]);

  const left = goals.dailyCalories - totals.calories;
  const pct = Math.min(1, totals.calories / Math.max(1, goals.dailyCalories));
  const over = totals.calories > goals.dailyCalories;

  const onSaved = (l: MealLog) => { setLogs((p) => [l, ...p]); setSheet(false); };
  const onDelete = (id: string) => { deleteMealLog(id); setLogs((p) => p.filter((x) => x.id !== id)); };

  if (!hydrated) return <div style={{ minHeight: "100dvh", background: "var(--m-cream)" }} />;

  return (
    <div className="vstack" style={{ minHeight: "100dvh", background: "var(--m-cream)", padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px 0", gap: 14 }}>
      {/* Title + Day / Week / Chart */}
      <div className="hstack">
        <span className="t-d2 grow">{selected === today ? "Today" : new Date(selected + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
        <div className="hstack" style={{ gap: 0, background: "var(--m-cream-2)", borderRadius: 99, padding: 4 }}>
          <span className="t-cap" style={{ padding: "5px 13px", background: "var(--m-card)", borderRadius: 99, boxShadow: "var(--m-shadow)", color: "var(--m-ink)", fontWeight: 700 }}>Day</span>
          <button className="t-cap" onClick={() => router.push("/m/plan/week")} style={segIdle}>Week</button>
          <button className="t-cap" onClick={() => router.push("/m/plan/diet-chart")} style={segIdle}>Chart</button>
        </div>
      </div>

      {/* Date strip — not on the artboard, but it is the only way to reach a
          past day, and dropping it would remove a working feature. lastNDates
          ends with today, so the strip is parked at its end: the selected day
          must be visible without a scroll. */}
      <div ref={stripRef} className="hscroll hstack" style={{ gap: 8 }}>
        {week.map((d) => {
          const [, , day] = d.split("-");
          const dow = DOW[new Date(d + "T00:00:00").getDay()];
          const on = d === selected;
          return (
            <button
              key={d}
              onClick={() => setSelected(d)}
              aria-pressed={on}
              style={{
                flex: "0 0 44px",
                textAlign: "center",
                padding: "7px 0",
                borderRadius: 14,
                border: "none",
                background: on ? "var(--m-forest)" : "var(--m-card)",
                color: on ? "var(--m-on-deep)" : "var(--m-ink)",
                boxShadow: on ? "none" : "var(--m-shadow)",
              }}
            >
              <div className="t-micro" style={{ color: "inherit", opacity: 0.75 }}>{dow}</div>
              <div style={{ font: "800 16px var(--m-font-display)", marginTop: 2 }}>{parseInt(day, 10)}</div>
            </button>
          );
        })}
      </div>

      <div className="scroll vstack" style={{ flex: 1, gap: 14, paddingBottom: 12 }}>
        {/* Calories + macros */}
        <div className="card tint-green hstack" style={{ boxShadow: "none", padding: 16, gap: 16 }}>
          <Ring pct={pct} value={totals.calories} goal={goals.dailyCalories} over={over} />
          <div className="vstack grow" style={{ gap: 8 }}>
            <Macro label="Protein" value={Math.round(totals.protein)} max={goals.protein} tone="lime" />
            <Macro label="Carbs" value={Math.round(totals.carbs)} max={goals.carbs} tone="orange" />
            <Macro label="Fat" value={Math.round(totals.fat)} max={goals.fat} tone="plum" />
          </div>
        </div>

        {/* Logged meals */}
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <span className="t-h1">Logged meals</span>
          {streak > 0 && (
            <span className="streak-chip" style={{ height: 32 }}>
              🔥 {streak} day{streak === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {dayLogs.map((m) => (
          <div key={m.id} className="row">
            {m.imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.imageDataUrl} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", flex: "none" }} />
            ) : (
              <span style={{ fontSize: 24, width: 40, textAlign: "center", flex: "none" }}>{MEAL_EMOJI[m.mealType]}</span>
            )}
            <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
              <span className="t-h2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
              <span className="t-cap" style={{ textTransform: "capitalize" }}>
                {[m.mealType, timeOf(m), m.source === "photo" ? "via Bo" : null].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="vstack" style={{ alignItems: "flex-end", gap: 0, flex: "none" }}>
              <span className="t-h2">{Math.round(m.calories)}</span>
              <button onClick={() => onDelete(m.id)} className="t-cap" style={{ background: "none", border: "none", padding: 0 }}>
                remove
              </button>
            </div>
          </div>
        ))}

        {/* The artboard's dashed capture prompt — the only logging affordance */}
        <button onClick={() => setSheet(true)} className="row" style={{ boxShadow: "none", background: "transparent", border: "2px dashed var(--m-ink-faint)", justifyContent: "center", gap: 8 }}>
          <Camera width={18} height={18} style={{ color: "var(--m-forest)" }} />
          <span className="t-cap" style={{ color: "var(--m-forest)", fontWeight: 700 }}>
            {dayLogs.length === 0 ? "Snap a meal to log it — Bo does the math" : "Snap the next one — Bo does the math"}
          </span>
        </button>

        {/* Bo's read on the day */}
        <div className="toast tint-lav" style={{ boxShadow: "none" }}>
          <Beet width={30} height={30} style={{ flex: "none" }} />
          <span>
            {dayLogs.length === 0
              ? "Nothing logged yet. Bo's got the calculator ready."
              : over
                ? `${Math.abs(left).toLocaleString()} kcal over. Tomorrow's a fresh page.`
                : `${left.toLocaleString()} kcal left. Dinner: go wild(ish).`}
          </span>
        </div>
      </div>

      {sheet && <LogSheet date={selected} onClose={() => setSheet(false)} onSaved={onSaved} />}
    </div>
  );
}

const segIdle: React.CSSProperties = {
  padding: "5px 13px",
  background: "none",
  border: "none",
  borderRadius: 99,
  color: "var(--m-ink-soft)",
  fontWeight: 700,
};

/** Calories consumed against the goal, per the artboard (not a countdown). */
function Ring({ pct, value, goal, over }: { pct: number; value: number; goal: number; over: boolean }) {
  const r = 39;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 92, height: 92, flex: "none" }}>
      <svg width={92} height={92} viewBox="0 0 92 92">
        <circle className="cal-ring-track" cx={46} cy={46} r={r} fill="none" strokeWidth={9} />
        <circle
          cx={46}
          cy={46}
          r={r}
          fill="none"
          stroke={over ? "var(--m-red)" : "var(--m-forest)"}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 46 46)"
        />
      </svg>
      <div className="vstack" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 0 }}>
        <span style={{ font: "800 21px/1 var(--m-font-display)", color: "var(--m-forest-2)" }}>{value.toLocaleString()}</span>
        <span className="t-micro" style={{ color: "var(--m-forest)" }}>of {goal.toLocaleString()}</span>
      </div>
    </div>
  );
}

function Macro({ label, value, max, tone }: { label: string; value: number; max: number; tone: "lime" | "orange" | "plum" }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const over = max > 0 && value > max;
  return (
    <div className="vstack" style={{ gap: 3 }}>
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <span className="t-cap" style={{ color: "var(--m-ink)" }}>{label}</span>
        <span className="t-cap" style={{ color: over ? "var(--m-red)" : undefined }}>{value}/{max}g</span>
      </div>
      <div className={`progress ${tone === "lime" ? "progress-lime" : ""}`}>
        <i style={{ width: `${pct}%`, background: over ? "var(--m-red)" : tone === "orange" ? "var(--m-orange)" : undefined }} />
      </div>
    </div>
  );
}

function LogSheet({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: (l: MealLog) => void }) {
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [img, setImg] = useState<string | null>(null);

  const num = (s: string) => Math.max(0, parseInt(s || "0", 10) || 0);
  const canSave = name.trim() && num(cal) > 0;

  const save = (source: MealLog["source"]) => {
    const saved = saveMealLog({ date, mealType, source, name: name.trim(), calories: num(cal), protein: num(p), carbs: num(c), fat: num(f), imageDataUrl: img ?? undefined });
    onSaved(saved);
  };

  // Run a captured/selected image through /api/meals/analyze and prefill fields.
  const analyzeDataUrl = async (dataUrl: string) => {
    setAnalyzing(true);
    try {
      setImg(dataUrl);
      const r = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "photo", imageBase64: dataUrl, mealType }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        if (data.name) setName(data.name);
        if (data.calories) setCal(String(data.calories));
        if (data.protein) setP(String(data.protein));
        if (data.carbs) setC(String(data.carbs));
        if (data.fat) setF(String(data.fat));
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    await analyzeDataUrl(dataUrl);
  };

  // Native camera path — opens the OS camera/library picker via Capacitor.
  const onNativeCapture = async () => {
    const dataUrl = await captureMealPhoto();
    if (dataUrl) await analyzeDataUrl(dataUrl);
  };

  return (
    <div onClick={onClose} className="sheet-scrim">
      <div onClick={(e) => e.stopPropagation()} className="vstack" style={{ width: "100%", maxWidth: 520, background: "var(--m-cream)", borderRadius: "28px 28px 0 0", maxHeight: "90vh", overflowY: "auto", padding: "0 20px calc(20px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="hstack" style={{ justifyContent: "space-between", padding: "18px 0 14px" }}>
          <span className="t-h1">Log a meal</span>
          <button onClick={onClose} className="icon-btn" aria-label="Close"><X width={18} height={18} /></button>
        </div>
        <div className="vstack" style={{ gap: 14 }}>
          <div className="hstack hscroll" style={{ gap: 8 }}>
            {MEAL_TYPES.map((m) => (
              <button key={m} onClick={() => setMealType(m)} className={`chip ${mealType === m ? "on" : ""}`} style={{ textTransform: "capitalize" }}>{m}</button>
            ))}
          </div>

          {isNative() ? (
            <button type="button" className="pill-secondary" disabled={analyzing} style={{ justifyContent: "center" }} onClick={onNativeCapture}>
              {analyzing ? <Loader2 width={16} height={16} className="animate-spin" /> : <Camera width={16} height={16} />}
              {analyzing ? "Analyzing…" : "Scan with camera / photo"}
            </button>
          ) : (
            <label className="pill-secondary" style={{ cursor: "pointer", justifyContent: "center" }}>
              {analyzing ? <Loader2 width={16} height={16} className="animate-spin" /> : <Camera width={16} height={16} />}
              {analyzing ? "Analyzing…" : "Scan with camera / photo"}
              <input type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: "none" }} />
            </label>
          )}

          <input placeholder="Dish name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="hstack" style={{ gap: 8 }}>
            <input placeholder="Cal" inputMode="numeric" value={cal} onChange={(e) => setCal(e.target.value)} />
            <input placeholder="P (g)" inputMode="numeric" value={p} onChange={(e) => setP(e.target.value)} />
            <input placeholder="C (g)" inputMode="numeric" value={c} onChange={(e) => setC(e.target.value)} />
            <input placeholder="F (g)" inputMode="numeric" value={f} onChange={(e) => setF(e.target.value)} />
          </div>
          <button className="pill-primary" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }} onClick={() => save(img ? "photo" : "manual")}>Log meal</button>
        </div>
      </div>
    </div>
  );
}
