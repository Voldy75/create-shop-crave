"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X, Camera, Loader2 } from "lucide-react";
import {
  getMealLogs,
  getNutritionGoals,
  saveMealLog,
  deleteMealLog,
} from "@/lib/storage";
import { dayTotals, lastNDates, localDateKey } from "@/lib/nutrition";
import { isNative, captureMealPhoto } from "@/lib/native-bridge";
import type { MealLog, MealType, NutritionGoals } from "@/lib/types";

/**
 * Plan tab — meshi meal tracker "Today" (v3-screens ScreenMealTracker), wired
 * to real storage. Date strip, calorie ring + macro bars vs goal, logged-meals
 * list, and a working manual log sheet (saveMealLog). Photo scan reuses
 * /api/meals/analyze.
 */

const DEFAULT_GOALS: NutritionGoals = { dailyCalories: 2000, protein: 150, carbs: 225, fat: 56, goal: "maintain" };
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function PlanTracker() {
  const [hydrated, setHydrated] = useState(false);
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_GOALS);
  const [selected, setSelected] = useState(localDateKey());
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    setLogs(getMealLogs());
    setGoals(getNutritionGoals() ?? DEFAULT_GOALS);
    setHydrated(true);
  }, []);

  const week = useMemo(() => lastNDates(7), []);
  const today = useMemo(() => localDateKey(), []);
  const totals = useMemo(() => dayTotals(logs, selected), [logs, selected]);
  const dayLogs = useMemo(() => logs.filter((l) => l.date === selected), [logs, selected]);

  const left = Math.max(0, goals.dailyCalories - totals.calories);
  const pct = Math.min(1, totals.calories / Math.max(1, goals.dailyCalories));

  const onSaved = (l: MealLog) => { setLogs((p) => [l, ...p]); setSheet(false); };
  const onDelete = (id: string) => { deleteMealLog(id); setLogs((p) => p.filter((x) => x.id !== id)); };

  if (!hydrated) return <div style={{ minHeight: "100dvh", background: "var(--cc-bg)" }} />;

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)" }}>
      <div className="row" style={{ padding: "calc(env(safe-area-inset-top,12px) + 10px) 16px 4px", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="t-h1">Today</h1>
        <a href="/m/plan/week" className="chip" style={{ fontSize: 11, textDecoration: "none" }}>This week ›</a>
      </div>

      {/* Date strip */}
      <div className="hscroll row" style={{ gap: 8, padding: "10px 14px 12px" }}>
        {week.map((d) => {
          const [, , day] = d.split("-");
          const dow = DOW[new Date(d + "T00:00:00").getDay()];
          const on = d === selected;
          const isToday = d === today;
          return (
            <button key={d} onClick={() => setSelected(d)} style={{ flex: "0 0 44px", textAlign: "center", padding: "8px 0", borderRadius: 14, background: on ? "var(--cc-acc)" : "var(--cc-surf-1)", color: on ? "#fff" : "var(--cc-ink-1)", border: on ? "none" : "1px solid var(--cc-line)" }}>
              <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 500 }}>{dow}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{parseInt(day, 10)}{isToday && !on ? "·" : ""}</div>
            </button>
          );
        })}
      </div>

      <div className="scroll" style={{ flex: 1, padding: "6px 14px 96px" }}>
        {/* Calorie hero */}
        <div className="card" style={{ padding: 18 }}>
          <div className="row" style={{ gap: 16 }}>
            <Ring pct={pct} center={String(left)} sub="LEFT" over={totals.calories > goals.dailyCalories} />
            <div className="col" style={{ flex: 1, gap: 4 }}>
              <span className="t-cap">CALORIES</span>
              <div className="row" style={{ alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{totals.calories.toLocaleString()}</span>
                <span className="t-small" style={{ fontSize: 12 }}>of {goals.dailyCalories.toLocaleString()}</span>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <span className="chip" style={{ fontSize: 10, padding: "3px 8px", background: totals.calories > goals.dailyCalories ? "rgba(255,69,58,0.16)" : "rgba(48,209,88,0.14)", color: totals.calories > goals.dailyCalories ? "#ff453a" : "var(--cc-pos)", borderColor: "transparent" }}>
                  {totals.calories > goals.dailyCalories ? "Over" : "On track"}
                </span>
                <span className="chip" style={{ fontSize: 10, padding: "3px 8px" }}>{dayLogs.length} meal{dayLogs.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 14, marginTop: 16 }}>
            <MacroBar label="Protein" value={Math.round(totals.protein)} max={goals.protein} color="var(--cc-acc)" />
            <MacroBar label="Carbs" value={Math.round(totals.carbs)} max={goals.carbs} color="#2997ff" />
            <MacroBar label="Fat" value={Math.round(totals.fat)} max={goals.fat} color="#ffd60a" />
          </div>
        </div>

        {/* Meals */}
        <div style={{ marginTop: 18 }}>
          <span className="t-cap" style={{ padding: "0 4px" }}>MEALS LOGGED</span>
          <div style={{ marginTop: 8 }}>
            {dayLogs.length === 0 && (
              <p className="t-small" style={{ padding: "0 4px 8px" }}>Nothing logged for this day yet.</p>
            )}
            {dayLogs.map((m) => (
              <div key={m.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
                <div className="row" style={{ gap: 12 }}>
                  {m.imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.imageDataUrl} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div className="ph ph-cream" style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} />
                  )}
                  <div className="col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="t-cap" style={{ fontSize: 9 }}>{m.mealType.toUpperCase()}</span>
                      {m.source === "photo" && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--cc-acc)", padding: "1px 6px", background: "var(--cc-acc-dim)", borderRadius: 3 }}>AI</span>}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                    <span className="t-small" style={{ fontSize: 11 }}>{Math.round(m.protein)}P · {Math.round(m.carbs)}C · {Math.round(m.fat)}F</span>
                  </div>
                  <div className="col" style={{ alignItems: "flex-end" }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{Math.round(m.calories)}</span>
                    <button onClick={() => onDelete(m.id)} className="t-small" style={{ fontSize: 10, background: "none", border: "none", color: "var(--cc-ink-3)" }}>remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => setSheet(true)} style={{ position: "fixed", right: 18, bottom: "calc(72px + env(safe-area-inset-bottom,0px))", width: 56, height: 56, borderRadius: "50%", background: "var(--cc-acc)", color: "#fff", border: "none", boxShadow: "0 8px 24px rgba(255,107,53,0.4)", display: "grid", placeItems: "center", zIndex: 30 }} aria-label="Log a meal">
        <Plus width={24} height={24} />
      </button>

      {sheet && <LogSheet date={selected} onClose={() => setSheet(false)} onSaved={onSaved} />}
    </div>
  );
}

function Ring({ pct, center, sub, over }: { pct: number; center: string; sub: string; over: boolean }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
      <svg width={88} height={88} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={44} cy={44} r={r} fill="none" stroke="var(--cc-surf-3)" strokeWidth={9} />
        <circle cx={44} cy={44} r={r} fill="none" stroke={over ? "#ff453a" : "var(--cc-acc)"} strokeWidth={9} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="col" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 800 }}>{center}</span>
        <span className="t-cap" style={{ fontSize: 8 }}>{sub}</span>
      </div>
    </div>
  );
}

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const over = value > max && max > 0;
  return (
    <div className="col" style={{ flex: 1, gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="t-small" style={{ fontSize: 11 }}>{label}</span>
        <span className="t-small" style={{ fontSize: 11, color: over ? "#ff453a" : "var(--cc-ink-2)" }}>{value}/{max}g</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--cc-surf-3)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: over ? "#ff453a" : color, borderRadius: 999 }} />
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="col" style={{ width: "100%", maxWidth: 520, background: "var(--cc-surf-1)", borderRadius: "22px 22px 0 0", border: "1px solid var(--cc-line)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="row" style={{ justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--cc-line)" }}>
          <h2 className="t-h2">Log a meal</h2>
          <button onClick={onClose} style={{ background: "var(--cc-surf-3)", border: "none", color: "var(--cc-ink-2)", width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center" }}><X width={16} height={16} /></button>
        </div>
        <div className="col" style={{ padding: 18, gap: 14 }}>
          <div className="row hscroll" style={{ gap: 8 }}>
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
          <div className="row" style={{ gap: 8 }}>
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
