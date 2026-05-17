"use client";

import React, { useMemo, useState } from "react";
import {
  Sparkles,
  Info,
  Lightbulb,
  AlertTriangle,
  Loader2,
  ChefHat,
  Lock,
  RefreshCw,
} from "lucide-react";
import {
  getMealLogs,
  getNutritionGoals,
  saveMealPlan,
  type WeekPlan,
} from "@/lib/storage";
import { lastNDates } from "@/lib/nutrition";
import type { MealLog, NutritionGoals } from "@/lib/types";
import { DietChartPreview, type GeneratedDay } from "./DietChartPreview";

interface Insight {
  title: string;
  body: string;
  severity: "info" | "nudge" | "warn";
}

interface DietChartResponse {
  summary: string;
  days: GeneratedDay[];
}

interface Props {
  isSignedIn: boolean;
  dietaryPreferences: string[];
  weekPlan: WeekPlan;
  onPlanUpdated: (plan: WeekPlan) => void;
}

const SEVERITY_STYLE: Record<
  Insight["severity"],
  { color: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  info: { color: "#0a84ff", bg: "rgba(10,132,255,0.10)", icon: Info },
  nudge: { color: "#ff6b35", bg: "rgba(255,107,53,0.10)", icon: Lightbulb },
  warn: { color: "#ff9f0a", bg: "rgba(255,159,10,0.10)", icon: AlertTriangle },
};

function buildPayload(logs: MealLog[], goals: NutritionGoals, dietaryPreferences: string[]) {
  // Limit to last 7 days to keep tokens cheap
  const cutoffSet = new Set(lastNDates(7));
  const trimmed = logs
    .filter((l) => cutoffSet.has(l.date))
    .slice(0, 40)
    .map((l) => ({
      date: l.date,
      mealType: l.mealType,
      name: l.name,
      calories: l.calories,
      protein: l.protein,
      carbs: l.carbs,
      fat: l.fat,
    }));
  return {
    logs: trimmed,
    goals: {
      dailyCalories: goals.dailyCalories,
      protein: goals.protein,
      carbs: goals.carbs,
      fat: goals.fat,
      goal: goals.goal,
    },
    dietaryPreferences,
  };
}

export function CoachPanel({ isSignedIn, dietaryPreferences, weekPlan, onPlanUpdated }: Props) {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [chart, setChart] = useState<DietChartResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartOpen, setChartOpen] = useState(false);

  const dataReady = useMemo(() => {
    const logs = typeof window === "undefined" ? [] : getMealLogs();
    return logs.length >= 2; // need at least a couple of logs to give meaningful insights
  }, []);

  const callCoach = async (mode: "insights" | "diet_chart") => {
    const logs = getMealLogs();
    const goals = getNutritionGoals();
    if (!goals) {
      throw new Error("Set your daily goals first.");
    }
    const payload = { mode, ...buildPayload(logs, goals, dietaryPreferences) };
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || data.error || "Coach failed") as Error & { code?: string };
      err.code = data.error;
      throw err;
    }
    return data;
  };

  const handleGenerateInsights = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const data = (await callCoach("insights")) as { insights: Insight[] };
      setInsights(data.insights);
    } catch (e) {
      const err = e as Error & { code?: string };
      setInsightsError(
        err.code === "rate_limit_exceeded"
          ? "Daily AI limit reached. Add your API key to keep using Coach."
          : err.message || "Couldn't generate insights right now.",
      );
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleGenerateChart = async () => {
    setChartLoading(true);
    setChartError(null);
    try {
      const data = (await callCoach("diet_chart")) as DietChartResponse;
      setChart(data);
      setChartOpen(true);
    } catch (e) {
      const err = e as Error & { code?: string };
      setChartError(
        err.code === "rate_limit_exceeded"
          ? "Daily AI limit reached. Add your API key to keep using Coach."
          : err.message || "Couldn't generate the diet chart right now.",
      );
    } finally {
      setChartLoading(false);
    }
  };

  const handleApply = (next: WeekPlan) => {
    saveMealPlan(next);
    onPlanUpdated(next);
  };

  if (!isSignedIn) {
    return (
      <div
        className="flex flex-col items-center text-center px-6 py-16"
        style={{
          background: "var(--cc-surface)",
          border: "1px solid var(--cc-border)",
          borderRadius: "16px",
          color: "var(--cc-text-secondary)",
        }}
      >
        <Lock className="w-6 h-6" style={{ color: "var(--cc-text-tertiary)", marginBottom: "10px" }} />
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
          Sign in to use Coach
        </h3>
        <p style={{ fontSize: "13px", marginTop: "6px", maxWidth: "340px" }}>
          Coach reads your meal logs and gives you specific, numeric suggestions and a personalized 7-day plan.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Insights card */}
      <div
        className="p-5 sm:p-6"
        style={{
          background: "var(--cc-surface)",
          border: "1px solid var(--cc-border)",
          borderRadius: "16px",
        }}
      >
        <div className="flex items-start justify-between gap-3" style={{ marginBottom: "12px" }}>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
              Insights
            </h3>
            <p style={{ fontSize: "12px", color: "var(--cc-text-tertiary)", marginTop: "2px" }}>
              Specific observations from the last 7 days of logs.
            </p>
          </div>
          {insights && (
            <button
              onClick={handleGenerateInsights}
              disabled={insightsLoading}
              className="p-2 rounded-full transition-colors"
              style={{ background: "var(--cc-surface-2)", color: "var(--cc-text-secondary)" }}
              aria-label="Refresh insights"
            >
              {insightsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {insightsError && (
          <div
            className="flex items-start gap-2 p-3"
            style={{
              background: "rgba(255,69,58,0.08)",
              border: "1px solid rgba(255,69,58,0.3)",
              borderRadius: "10px",
              color: "#ff453a",
              marginBottom: "12px",
            }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p style={{ fontSize: "12px" }}>{insightsError}</p>
          </div>
        )}

        {!insights && !insightsLoading && (
          <div className="flex flex-col items-start gap-3">
            {!dataReady && (
              <p style={{ fontSize: "12px", color: "var(--cc-text-tertiary)" }}>
                Log a couple of meals first so Coach has something to work with.
              </p>
            )}
            <button
              onClick={handleGenerateInsights}
              disabled={!dataReady}
              className="flex items-center gap-1.5 px-4 py-2 text-white transition-colors"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                background: dataReady ? "var(--cc-accent)" : "var(--cc-surface-2)",
                color: dataReady ? "#fff" : "var(--cc-text-tertiary)",
                borderRadius: "980px",
                cursor: dataReady ? "pointer" : "not-allowed",
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate insights
            </button>
          </div>
        )}

        {insightsLoading && (
          <div className="flex items-center gap-2" style={{ color: "var(--cc-text-secondary)" }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span style={{ fontSize: "13px" }}>Looking at your last 7 days…</span>
          </div>
        )}

        {insights && (
          <div className="flex flex-col gap-2">
            {insights.map((ins, i) => {
              const style = SEVERITY_STYLE[ins.severity];
              const Icon = style.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3"
                  style={{
                    background: style.bg,
                    border: `1px solid ${style.color}30`,
                    borderRadius: "12px",
                  }}
                >
                  <div
                    className="flex-shrink-0"
                    style={{ color: style.color, marginTop: "2px" }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
                      {ins.title}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--cc-text-secondary)", marginTop: "2px", lineHeight: 1.45 }}>
                      {ins.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diet chart card */}
      <div
        className="p-5 sm:p-6"
        style={{
          background: "var(--cc-surface)",
          border: "1px solid var(--cc-border)",
          borderRadius: "16px",
        }}
      >
        <div className="flex items-start justify-between gap-3" style={{ marginBottom: "12px" }}>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
              7-day diet chart
            </h3>
            <p style={{ fontSize: "12px", color: "var(--cc-text-tertiary)", marginTop: "2px" }}>
              Personalized to your goal, dietary prefs, and recent intake. One tap to apply to the planner.
            </p>
          </div>
          <ChefHat className="w-5 h-5" style={{ color: "var(--cc-accent)" }} />
        </div>

        {chartError && (
          <div
            className="flex items-start gap-2 p-3"
            style={{
              background: "rgba(255,69,58,0.08)",
              border: "1px solid rgba(255,69,58,0.3)",
              borderRadius: "10px",
              color: "#ff453a",
              marginBottom: "12px",
            }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p style={{ fontSize: "12px" }}>{chartError}</p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleGenerateChart}
            disabled={chartLoading}
            className="flex items-center gap-1.5 px-4 py-2 text-white transition-colors"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              background: chartLoading ? "var(--cc-surface-2)" : "var(--cc-accent)",
              color: chartLoading ? "var(--cc-text-tertiary)" : "#fff",
              borderRadius: "980px",
              cursor: chartLoading ? "not-allowed" : "pointer",
            }}
          >
            {chartLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating plan…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {chart ? "Generate again" : "Generate plan"}
              </>
            )}
          </button>
          {chart && !chartOpen && (
            <button
              onClick={() => setChartOpen(true)}
              className="px-4 py-2 transition-colors"
              style={{
                fontSize: "13px",
                fontWeight: 600,
                background: "var(--cc-surface-2)",
                color: "var(--cc-text-primary)",
                border: "1px solid var(--cc-border)",
                borderRadius: "980px",
              }}
            >
              View last plan
            </button>
          )}
        </div>
      </div>

      {chart && (
        <DietChartPreview
          open={chartOpen}
          summary={chart.summary}
          days={chart.days}
          currentPlan={weekPlan}
          onClose={() => setChartOpen(false)}
          onApply={handleApply}
        />
      )}
    </div>
  );
}
