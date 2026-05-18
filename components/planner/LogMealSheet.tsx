"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  CalendarCheck,
  PenLine,
  Search,
  Camera,
  Lock,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { MealLog, MealSource, MealType } from "@/lib/types";
import type { MealSlot, WeekPlan } from "@/lib/storage";
import { parseNumeric } from "@/lib/nutrition";
import { PhotoCapture } from "./PhotoCapture";

interface Prefill {
  name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  source?: MealSource;
  mealType?: MealType;
  notes?: string;
}

interface Props {
  open: boolean;
  date: string;
  weekPlan: WeekPlan;
  prefill?: Prefill | null;
  editLog?: MealLog | null;
  isSignedIn: boolean;
  onClose: () => void;
  onSave: (log: Omit<MealLog, "id" | "loggedAt">) => void;
  onEdit?: (id: string, patch: Partial<MealLog>) => void;
}

type Mode = "plan" | "manual" | "search" | "photo";

const MODES: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }>; requiresAI: boolean }[] = [
  { id: "plan", label: "From plan", icon: CalendarCheck, requiresAI: false },
  { id: "manual", label: "Manual", icon: PenLine, requiresAI: false },
  { id: "search", label: "Estimate", icon: Search, requiresAI: true },
  { id: "photo", label: "Photo", icon: Camera, requiresAI: true },
];

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayNameFromDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return DAYS[new Date(y, m - 1, d).getDay()];
}

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

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

async function analyzeMeal(
  payload: { kind: "photo"; imageBase64: string; mealType?: string } | { kind: "dish"; name: string; mealType?: string },
): Promise<AnalyzeResult> {
  const res = await fetch("/api/meals/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || data.error || "Failed to analyze") as Error & { code?: string };
    err.code = data.error;
    throw err;
  }
  return data as AnalyzeResult;
}

export function LogMealSheet({ open, date, weekPlan, prefill, editLog, isSignedIn, onClose, onSave, onEdit }: Props) {
  const isEditing = Boolean(editLog);
  const [mode, setMode] = useState<Mode>("plan");
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [name, setName] = useState("");
  const [calories, setCalories] = useState<string>("");
  const [protein, setProtein] = useState<string>("");
  const [carbs, setCarbs] = useState<string>("");
  const [fat, setFat] = useState<string>("");
  const [notes, setNotes] = useState("");
  // AI modes
  const [searchQuery, setSearchQuery] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [aiNotes, setAiNotes] = useState<string | null>(null);

  // Reset when opened or prefill/editLog changes
  useEffect(() => {
    if (!open) return;
    if (editLog) {
      setMode("manual");
      setMealType(editLog.mealType);
      setName(editLog.name);
      setCalories(String(editLog.calories));
      setProtein(String(editLog.protein));
      setCarbs(String(editLog.carbs));
      setFat(String(editLog.fat));
      setNotes(editLog.notes || "");
    } else if (prefill) {
      setMode((prefill.source as Mode) || "manual");
      setMealType(prefill.mealType || defaultMealType());
      setName(prefill.name || "");
      setCalories(prefill.calories ? String(prefill.calories) : "");
      setProtein(prefill.protein ? String(prefill.protein) : "");
      setCarbs(prefill.carbs ? String(prefill.carbs) : "");
      setFat(prefill.fat ? String(prefill.fat) : "");
      setNotes(prefill.notes || "");
    } else {
      setMode("plan");
      setMealType(defaultMealType());
      setName("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      setNotes("");
    }
    setSearchQuery("");
    setImageDataUrl(null);
    setAnalyzing(false);
    setAnalyzeError(null);
    setNeedsConfirmation(false);
    setAiNotes(null);
  }, [open, prefill, editLog]);

  const dayName = useMemo(() => dayNameFromDate(date), [date]);

  const planSuggestions = useMemo(() => {
    const dayPlan = weekPlan[dayName];
    if (!dayPlan) return [] as { mealType: MealType; slot: MealSlot }[];
    return (["breakfast", "lunch", "dinner"] as const)
      .map((m) => {
        const slot = dayPlan[m];
        return slot ? { mealType: m as MealType, slot } : null;
      })
      .filter(Boolean) as { mealType: MealType; slot: MealSlot }[];
  }, [weekPlan, dayName]);

  if (!open) return null;

  const fillFromAnalyze = (r: AnalyzeResult) => {
    setName(r.name);
    setCalories(String(r.calories));
    setProtein(String(r.protein));
    setCarbs(String(r.carbs));
    setFat(String(r.fat));
    setNeedsConfirmation(Boolean(r.needsConfirmation));
    setAiNotes(r.notes ?? null);
  };

  const fillFromSlot = (mt: MealType, slot: MealSlot) => {
    setMealType(mt);
    setName(slot.dish);
    const nutr = slot.recipe?.nutritionEstimate;
    if (nutr) {
      setCalories(String(parseNumeric(nutr.calories)));
      setProtein(String(parseNumeric(nutr.protein)));
      setCarbs(String(parseNumeric(nutr.carbs)));
      setFat(String(parseNumeric(nutr.fat)));
    }
    setMode("manual");
  };

  const handleAnalyzePhoto = async () => {
    if (!imageDataUrl) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeMeal({ kind: "photo", imageBase64: imageDataUrl, mealType });
      fillFromAnalyze(result);
    } catch (e) {
      const err = e as Error & { code?: string };
      setAnalyzeError(
        err.code === "photo_quota_exceeded"
          ? "Daily photo limit reached. Try again tomorrow or add your own API key."
          : err.message || "Couldn't analyze that photo.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeDish = async () => {
    if (!searchQuery.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeMeal({ kind: "dish", name: searchQuery.trim(), mealType });
      fillFromAnalyze(result);
    } catch (e) {
      const err = e as Error;
      setAnalyzeError(err.message || "Couldn't estimate that dish.");
    } finally {
      setAnalyzing(false);
    }
  };

  const canSave = name.trim().length > 0 && parseNumeric(calories) > 0 && !analyzing;

  const handleSave = () => {
    if (!canSave) return;
    if (editLog && onEdit) {
      onEdit(editLog.id, {
        mealType,
        name: name.trim(),
        calories: parseNumeric(calories),
        protein: parseNumeric(protein),
        carbs: parseNumeric(carbs),
        fat: parseNumeric(fat),
        notes: notes.trim() || undefined,
      });
      onClose();
      return;
    }
    const source: MealSource = prefill?.source
      ? prefill.source
      : mode === "search"
        ? "search"
        : mode === "photo"
          ? "photo"
          : mode === "plan"
            ? "planned"
            : "manual";
    onSave({
      date,
      mealType,
      source,
      name: name.trim(),
      calories: parseNumeric(calories),
      protein: parseNumeric(protein),
      carbs: parseNumeric(carbs),
      fat: parseNumeric(fat),
      notes: notes.trim() || undefined,
      imageDataUrl: mode === "photo" && imageDataUrl ? imageDataUrl : undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
        style={{
          background: "var(--cc-surface)",
          borderRadius: "20px 20px 0 0",
          border: "1px solid var(--cc-border)",
        }}
      >
        <div
          className="sticky top-0 flex items-center justify-between px-5 py-4 z-10"
          style={{ background: "var(--cc-surface)", borderBottom: "1px solid var(--cc-border)" }}
        >
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
              {isEditing ? "Edit meal" : "Log meal"}
            </h2>
            <p style={{ fontSize: "12px", color: "var(--cc-text-tertiary)", marginTop: "2px" }}>
              {dayName} · {date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full"
            style={{ color: "var(--cc-text-tertiary)", background: "var(--cc-surface-2)" }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">
          {/* Mode picker — hidden when editing an existing log */}
          {!isEditing && (
          <div className="grid grid-cols-4 gap-2">
            {MODES.map(({ id, label, icon: Icon, requiresAI }) => {
              const lockedForAuth = requiresAI && !isSignedIn;
              const active = mode === id;
              return (
                <button
                  key={id}
                  disabled={lockedForAuth}
                  onClick={() => !lockedForAuth && setMode(id)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 transition-colors relative"
                  style={{
                    background: active ? "var(--cc-accent-dim)" : "var(--cc-surface-2)",
                    border: active ? "1px solid var(--cc-accent)" : "1px solid var(--cc-border)",
                    borderRadius: "12px",
                    color: active
                      ? "var(--cc-accent)"
                      : lockedForAuth
                        ? "var(--cc-text-tertiary)"
                        : "var(--cc-text-secondary)",
                    opacity: lockedForAuth ? 0.55 : 1,
                    cursor: lockedForAuth ? "not-allowed" : "pointer",
                  }}
                  title={lockedForAuth ? "Sign in to use AI features" : ""}
                >
                  <Icon className="w-4 h-4" />
                  <span style={{ fontSize: "11px", fontWeight: 600 }}>{label}</span>
                  {lockedForAuth && (
                    <span
                      className="absolute"
                      style={{ top: "6px", right: "6px", color: "var(--cc-text-tertiary)" }}
                      aria-label="Sign in to unlock"
                    >
                      <Lock className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          )}

          {/* Meal type chips */}
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--cc-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
              Meal
            </p>
            <div className="flex gap-2 flex-wrap">
              {MEAL_TYPES.map((mt) => (
                <button
                  key={mt}
                  onClick={() => setMealType(mt)}
                  className="px-3 py-1.5 transition-colors capitalize"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    background: mealType === mt ? "var(--cc-accent)" : "var(--cc-surface-2)",
                    color: mealType === mt ? "#fff" : "var(--cc-text-secondary)",
                    border: mealType === mt ? "1px solid var(--cc-accent)" : "1px solid var(--cc-border)",
                    borderRadius: "980px",
                  }}
                >
                  {mt}
                </button>
              ))}
            </div>
          </div>

          {/* From plan */}
          {mode === "plan" && (
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--cc-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
                Planned for {dayName.toLowerCase()}
              </p>
              {planSuggestions.length === 0 ? (
                <div
                  className="text-center py-6 px-4"
                  style={{ background: "var(--cc-surface-2)", borderRadius: "12px", color: "var(--cc-text-tertiary)" }}
                >
                  <p style={{ fontSize: "13px" }}>No meals planned for this day.</p>
                  <p style={{ fontSize: "11px", marginTop: "4px" }}>Switch to Manual to log what you ate.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {planSuggestions.map(({ mealType: mt, slot }) => (
                    <button
                      key={mt}
                      onClick={() => fillFromSlot(mt, slot)}
                      className="flex items-center justify-between text-left px-4 py-3 transition-colors"
                      style={{
                        background: "var(--cc-surface-2)",
                        border: "1px solid var(--cc-border)",
                        borderRadius: "12px",
                      }}
                    >
                      <div>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--cc-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {mt}
                        </p>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--cc-text-primary)", marginTop: "2px" }}>
                          {slot.dish}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--cc-accent)",
                          padding: "4px 10px",
                          borderRadius: "980px",
                          background: "var(--cc-accent-dim)",
                        }}
                      >
                        Use
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Estimate by name */}
          {mode === "search" && (
            <div className="flex flex-col gap-2">
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--cc-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Describe what you ate
              </p>
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. 2 idlis with sambar"
                  className="flex-1 px-3 py-2.5 outline-none"
                  style={{
                    fontSize: "14px",
                    background: "var(--cc-surface-2)",
                    border: "1px solid var(--cc-border)",
                    borderRadius: "10px",
                    color: "var(--cc-text-primary)",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim() && !analyzing) handleAnalyzeDish();
                  }}
                />
                <button
                  onClick={handleAnalyzeDish}
                  disabled={!searchQuery.trim() || analyzing}
                  className="flex items-center gap-1.5 px-4 text-white transition-colors"
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    background: searchQuery.trim() && !analyzing ? "var(--cc-accent)" : "var(--cc-surface-2)",
                    color: searchQuery.trim() && !analyzing ? "#fff" : "var(--cc-text-tertiary)",
                    borderRadius: "10px",
                    cursor: searchQuery.trim() && !analyzing ? "pointer" : "not-allowed",
                  }}
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Estimate
                </button>
              </div>
              <p style={{ fontSize: "11px", color: "var(--cc-text-tertiary)" }}>
                AI will estimate calories and macros. Edit anything below before saving.
              </p>
            </div>
          )}

          {/* Photo */}
          {mode === "photo" && (
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--cc-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Snap or upload your plate
              </p>
              <PhotoCapture
                imageDataUrl={imageDataUrl}
                onChange={(url) => {
                  setImageDataUrl(url);
                  if (!url) {
                    setNeedsConfirmation(false);
                    setAiNotes(null);
                  }
                }}
                disabled={analyzing}
              />
              {imageDataUrl && (
                <button
                  onClick={handleAnalyzePhoto}
                  disabled={analyzing}
                  className="flex items-center justify-center gap-2 py-2.5 text-white transition-colors"
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    background: "var(--cc-accent)",
                    borderRadius: "10px",
                  }}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing photo…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analyze with AI
                    </>
                  )}
                </button>
              )}
              <p style={{ fontSize: "11px", color: "var(--cc-text-tertiary)" }}>
                Photo is sent to Gemini for analysis. It is not stored on our servers.
              </p>
            </div>
          )}

          {/* AI feedback banners */}
          {analyzeError && (
            <div
              className="flex items-start gap-2 p-3"
              style={{
                background: "rgba(255,69,58,0.08)",
                border: "1px solid rgba(255,69,58,0.3)",
                borderRadius: "10px",
                color: "#ff453a",
              }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p style={{ fontSize: "12px" }}>{analyzeError}</p>
            </div>
          )}
          {needsConfirmation && !analyzeError && (
            <div
              className="flex items-start gap-2 p-3"
              style={{
                background: "rgba(255,159,10,0.08)",
                border: "1px solid rgba(255,159,10,0.3)",
                borderRadius: "10px",
                color: "#ff9f0a",
              }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p style={{ fontSize: "12px", fontWeight: 600 }}>Low confidence — please confirm</p>
                {aiNotes && <p style={{ fontSize: "11px", marginTop: "2px", opacity: 0.9 }}>{aiNotes}</p>}
              </div>
            </div>
          )}
          {!needsConfirmation && aiNotes && (
            <p style={{ fontSize: "11px", color: "var(--cc-text-tertiary)", fontStyle: "italic" }}>
              {aiNotes}
            </p>
          )}

          {/* Always-editable fields */}
          <div className="grid grid-cols-1 gap-3">
            <Field label="Dish">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Paneer tikka"
                className="w-full px-3 py-2.5 outline-none"
                style={{
                  fontSize: "14px",
                  background: "var(--cc-surface-2)",
                  border: "1px solid var(--cc-border)",
                  borderRadius: "10px",
                  color: "var(--cc-text-primary)",
                }}
              />
            </Field>
            <div className="grid grid-cols-4 gap-2">
              <NutritionField label="Cal" value={calories} onChange={setCalories} suffix="" />
              <NutritionField label="Protein" value={protein} onChange={setProtein} suffix="g" />
              <NutritionField label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
              <NutritionField label="Fat" value={fat} onChange={setFat} suffix="g" />
            </div>
            <Field label="Notes (optional)">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Half portion, post-workout"
                className="w-full px-3 py-2.5 outline-none"
                style={{
                  fontSize: "13px",
                  background: "var(--cc-surface-2)",
                  border: "1px solid var(--cc-border)",
                  borderRadius: "10px",
                  color: "var(--cc-text-primary)",
                }}
              />
            </Field>
          </div>
        </div>

        <div
          className="sticky bottom-0 px-5 py-4 flex gap-2 justify-end"
          style={{ background: "var(--cc-surface)", borderTop: "1px solid var(--cc-border)" }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 transition-colors"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--cc-text-secondary)",
              borderRadius: "980px",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-5 py-2 text-white transition-colors"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              background: canSave ? "var(--cc-accent)" : "var(--cc-surface-2)",
              color: canSave ? "#ffffff" : "var(--cc-text-tertiary)",
              borderRadius: "980px",
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            {isEditing ? "Save changes" : "Log meal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--cc-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function NutritionField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <div>
      <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--cc-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>
        {label}
      </p>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={0}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-2 outline-none"
          style={{
            fontSize: "13px",
            fontWeight: 600,
            background: "var(--cc-surface-2)",
            border: "1px solid var(--cc-border)",
            borderRadius: "8px",
            color: "var(--cc-text-primary)",
          }}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "10px",
              color: "var(--cc-text-tertiary)",
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
