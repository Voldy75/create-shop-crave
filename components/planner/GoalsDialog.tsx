"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import type {
  ActivityLevel,
  NutritionGoals,
  NutritionProfile,
  Sex,
  WeightGoal,
} from "@/lib/types";
import { computeMacros, defaultGoalsFromProfile } from "@/lib/nutrition";

interface Props {
  open: boolean;
  initial?: NutritionGoals | null;
  onClose: () => void;
  onSave: (goals: NutritionGoals) => void;
}

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; sub: string }[] = [
  { value: "sedentary", label: "Sedentary", sub: "Little to no exercise" },
  { value: "light", label: "Light", sub: "1–3 days / week" },
  { value: "moderate", label: "Moderate", sub: "3–5 days / week" },
  { value: "active", label: "Active", sub: "6–7 days / week" },
  { value: "very_active", label: "Very active", sub: "Twice daily / hard labor" },
];

const GOAL_OPTIONS: { value: WeightGoal; label: string; sub: string }[] = [
  { value: "lose", label: "Lose weight", sub: "−500 kcal/day" },
  { value: "maintain", label: "Maintain", sub: "Stay at current weight" },
  { value: "gain", label: "Gain weight", sub: "+400 kcal/day" },
];

export function GoalsDialog({ open, initial, onClose, onSave }: Props) {
  const [profile, setProfile] = useState<NutritionProfile>(
    initial?.profile ?? {
      sex: "male",
      age: 30,
      heightCm: 175,
      weightKg: 70,
      activity: "moderate",
      goal: "maintain",
    },
  );
  const [manualKcal, setManualKcal] = useState<number | null>(initial?.dailyCalories ?? null);
  const [useManual, setUseManual] = useState(false);

  if (!open) return null;

  const computed = defaultGoalsFromProfile(profile);
  const finalKcal = useManual && manualKcal ? manualKcal : computed?.dailyCalories ?? 2000;
  const macros = computeMacros(finalKcal);

  const handleSave = () => {
    const goals: NutritionGoals = {
      dailyCalories: finalKcal,
      ...macros,
      goal: profile.goal ?? "maintain",
      profile,
    };
    onSave(goals);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "color-mix(in srgb, var(--m-forest-2) 55%, transparent)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
        style={{
          background: "var(--m-card)",
          borderRadius: "20px 20px 0 0",
          border: "1px solid var(--m-ink-faint)",
        }}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-4"
          style={{ background: "var(--m-card)", borderBottom: "1px solid var(--m-ink-faint)" }}>
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--m-ink)" }}>
              Daily goals
            </h2>
            <p style={{ fontSize: "12px", color: "var(--m-ink-soft)", marginTop: "2px" }}>
              We&rsquo;ll use Mifflin–St Jeor to calculate your target.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full"
            style={{ color: "var(--m-ink-soft)", background: "var(--m-cream-2)" }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">
          {/* Sex */}
          <Field label="Sex">
            <div className="flex gap-2">
              {(["male", "female"] as Sex[]).map((s) => (
                <Chip
                  key={s}
                  active={profile.sex === s}
                  onClick={() => setProfile({ ...profile, sex: s })}
                >
                  {s === "male" ? "Male" : "Female"}
                </Chip>
              ))}
            </div>
          </Field>

          {/* Age / Height / Weight */}
          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="Age"
              suffix="yrs"
              value={profile.age}
              onChange={(v) => setProfile({ ...profile, age: v })}
              min={13}
              max={100}
            />
            <NumberField
              label="Height"
              suffix="cm"
              value={profile.heightCm}
              onChange={(v) => setProfile({ ...profile, heightCm: v })}
              min={120}
              max={230}
            />
            <NumberField
              label="Weight"
              suffix="kg"
              value={profile.weightKg}
              onChange={(v) => setProfile({ ...profile, weightKg: v })}
              min={30}
              max={250}
            />
          </div>

          {/* Activity */}
          <Field label="Activity level">
            <div className="flex flex-col gap-1.5">
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setProfile({ ...profile, activity: opt.value })}
                  className="flex items-center justify-between text-left px-3 py-2.5 transition-colors"
                  style={{
                    background:
                      profile.activity === opt.value ? "var(--m-tint-green)" : "var(--m-cream-2)",
                    border:
                      profile.activity === opt.value
                        ? "1px solid var(--m-forest)"
                        : "1px solid var(--m-ink-faint)",
                    borderRadius: "10px",
                  }}
                >
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--m-ink)" }}>
                      {opt.label}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--m-ink-soft)" }}>{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </Field>

          {/* Goal */}
          <Field label="Goal">
            <div className="grid grid-cols-3 gap-2">
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setProfile({ ...profile, goal: opt.value })}
                  className="flex flex-col items-start text-left px-3 py-2.5 transition-colors"
                  style={{
                    background:
                      profile.goal === opt.value ? "var(--m-tint-green)" : "var(--m-cream-2)",
                    border:
                      profile.goal === opt.value
                        ? "1px solid var(--m-forest)"
                        : "1px solid var(--m-ink-faint)",
                    borderRadius: "10px",
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--m-ink)" }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--m-ink-soft)" }}>{opt.sub}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* Computed summary + override */}
          <div className="p-4" style={{ background: "var(--m-cream-2)", borderRadius: "12px" }}>
            <div className="flex items-baseline justify-between">
              <span style={{ fontSize: "12px", color: "var(--m-ink-soft)" }}>
                Daily target
              </span>
              <span style={{ fontSize: "22px", fontWeight: 700, color: "var(--m-ink)" }}>
                {finalKcal} <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--m-ink-soft)" }}>kcal</span>
              </span>
            </div>
            <div className="flex gap-4 mt-2" style={{ fontSize: "11px", color: "var(--m-ink-soft)" }}>
              <span>P {macros.protein}g</span>
              <span>C {macros.carbs}g</span>
              <span>F {macros.fat}g</span>
            </div>
            <label className="flex items-center gap-2 mt-3" style={{ fontSize: "12px", color: "var(--m-ink-soft)" }}>
              <input
                type="checkbox"
                checked={useManual}
                onChange={(e) => {
                  setUseManual(e.target.checked);
                  if (e.target.checked && !manualKcal) setManualKcal(computed?.dailyCalories ?? 2000);
                }}
              />
              Override daily calories
            </label>
            {useManual && (
              <input
                type="number"
                value={manualKcal ?? ""}
                onChange={(e) => setManualKcal(parseInt(e.target.value || "0", 10))}
                className="mt-2 px-3 py-2 w-32 outline-none"
                style={{
                  fontSize: "13px",
                  background: "var(--m-card)",
                  border: "1px solid var(--m-ink-faint)",
                  borderRadius: "8px",
                  color: "var(--m-ink)",
                }}
              />
            )}
          </div>
        </div>

        <div
          className="sticky bottom-0 px-5 py-4 flex gap-2 justify-end"
          style={{ background: "var(--m-card)", borderTop: "1px solid var(--m-ink-faint)" }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 transition-colors"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--m-ink-soft)",
              borderRadius: "980px",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-white transition-colors"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              background: "var(--m-forest)",
              borderRadius: "980px",
            }}
          >
            Save goals
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--m-ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 transition-colors"
      style={{
        fontSize: "13px",
        fontWeight: 600,
        background: active ? "var(--m-forest)" : "var(--m-cream-2)",
        color: active ? "var(--m-on-deep)" : "var(--m-ink-soft)",
        borderRadius: "980px",
        border: active ? "1px solid var(--m-forest)" : "1px solid var(--m-ink-faint)",
      }}
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  suffix: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--m-ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
        {label}
      </p>
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={value ?? ""}
          min={min}
          max={max}
          onChange={(e) => onChange(parseInt(e.target.value || "0", 10))}
          className="w-full px-3 py-2 outline-none"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            background: "var(--m-cream-2)",
            border: "1px solid var(--m-ink-faint)",
            borderRadius: "10px",
            color: "var(--m-ink)",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "11px",
            color: "var(--m-ink-soft)",
            pointerEvents: "none",
          }}
        >
          {suffix}
        </span>
      </div>
    </div>
  );
}
