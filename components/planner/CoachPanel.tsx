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
  info: { color: "var(--m-plum)", bg: "var(--m-tint-lav)", icon: Info },
  nudge: { color: "var(--m-forest)", bg: "var(--m-tint-green)", icon: Lightbulb },
  warn: { color: "var(--m-burnt)", bg: "var(--m-tint-peach)", icon: AlertTriangle },
};

// Sort priority: lower = earlier. warn first so users see action items above the fold.
const SEVERITY_ORDER: Record<Insight["severity"], number> = {
  warn: 0,
  nudge: 1,
  info: 2,
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
    setInsights([]); // clear and start with empty so the loading state shows the streaming list
    try {
      const logs = getMealLogs();
      const goals = getNutritionGoals();
      if (!goals) throw Object.assign(new Error("Set your daily goals first."), { code: "missing_goals" });
      const payload = { mode: "insights" as const, ...buildPayload(logs, goals, dietaryPreferences) };
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) {
        // Non-streaming error response — parse normally
        const data = await res.json().catch(() => ({} as { message?: string; error?: string }));
        const err = new Error(data.message || data.error || "Coach failed") as Error & { code?: string };
        err.code = data.error;
        throw err;
      }
      // NDJSON: one JSON object per line, each is a progressively-fuller partial.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let received = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? ""; // keep the trailing incomplete line for the next chunk
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const partial = JSON.parse(line) as { insights?: Insight[]; _error?: string; message?: string; _done?: boolean };
            if (partial._error) {
              throw Object.assign(new Error(partial.message || "Stream interrupted"), { code: partial._error });
            }
            if (partial._done) continue;
            // Filter partials to fully-formed insights only — incomplete entries
            // (missing title/body/severity while still being generated) shouldn't
            // render half-cards.
            const complete = (partial.insights ?? []).filter(
              (i): i is Insight => Boolean(i?.title && i?.body && i?.severity),
            );
            if (complete.length > 0) {
              received = true;
              setInsights(complete);
            }
          } catch (e) {
            if ((e as Error & { code?: string }).code) throw e; // surface _error
            // JSON-parse failures: chunk boundary hit mid-line — ignore, next chunk fixes it
          }
        }
      }
      if (!received) {
        throw new Error("No insights received");
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      setInsights(null);
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
          Sign in to unlock AI-powered meal planning — Coach reads your logs to generate numeric suggestions and a personalized 7-day plan.
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
              background: "color-mix(in srgb, var(--m-red) 10%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--m-red) 32%, transparent)",
              borderRadius: "10px",
              color: "var(--m-red)",
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
                color: dataReady ? "var(--m-on-deep)" : "var(--cc-text-tertiary)",
                borderRadius: "980px",
                cursor: dataReady ? "pointer" : "not-allowed",
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate insights
            </button>
          </div>
        )}

        {(insightsLoading || (insights && insights.length > 0)) && (
          <div className="flex flex-col gap-2">
            {insightsLoading && (!insights || insights.length === 0) && (
              <div
                className="flex items-center gap-2 px-3 py-3"
                style={{
                  background: "var(--cc-surface-2)",
                  border: "1px solid var(--cc-border)",
                  borderRadius: "12px",
                  color: "var(--cc-text-secondary)",
                }}
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span style={{ fontSize: "12px" }}>Looking at your last 7 days…</span>
              </div>
            )}
            {(insights ?? [])
              .slice()
              // Surface warn > nudge > info so users see action items first
              .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
              .map((ins, i) => {
              const style = SEVERITY_STYLE[ins.severity];
              const Icon = style.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 animate-in fade-in slide-in-from-bottom-1 duration-300"
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
            {insightsLoading && insights && insights.length > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-3"
                style={{
                  background: "var(--cc-surface-2)",
                  border: "1px dashed var(--cc-border-strong)",
                  borderRadius: "12px",
                  color: "var(--cc-text-tertiary)",
                }}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span style={{ fontSize: "11px" }}>More on the way…</span>
              </div>
            )}
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
              background: "color-mix(in srgb, var(--m-red) 10%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--m-red) 32%, transparent)",
              borderRadius: "10px",
              color: "var(--m-red)",
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
              color: chartLoading ? "var(--cc-text-tertiary)" : "var(--m-on-deep)",
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
          dietaryPreferences={dietaryPreferences}
          onClose={() => setChartOpen(false)}
          onApply={handleApply}
        />
      )}
    </div>
  );
}
