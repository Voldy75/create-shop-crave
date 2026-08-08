"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShoppingCart, Plus, X, ChefHat, ExternalLink, Bell } from "lucide-react";
import { getMealPlan, getMealLogs, saveMealPlan, type WeekPlan, type MealSlot } from "@/lib/storage";
import { loggingStreak } from "@/lib/nutrition";
import { buildBlinkitLink, buildSwiggyInstamartLink, buildInstacartLink } from "@/lib/deeplinks";
import { PlannerTabs, type PlannerTab } from "@/components/planner/PlannerTabs";
import { TrackerView } from "@/components/planner/TrackerView";
import { CoachPanel } from "@/components/planner/CoachPanel";
import { useUser } from "@/app/context/UserContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

type MealType = typeof MEALS[number];

const TAB_TITLE: Record<PlannerTab, string> = {
  plan: "Your week",
  tracker: "Your day",
  coach: "Coach",
};

export default function PlannerPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--m-cream)" }} />}>
            <PlannerPageInner />
        </Suspense>
    );
}

/**
 * Planner — built to artboard w4b (the tracker tab is what w4b draws).
 *
 * The old page-level sticky header is GONE: it carried a back arrow to /chat
 * and the page title, both of which the AppShell sidebar now covers. This is
 * the w4b topbar in its place — the same swap the chat page made for w3a.
 *
 * Two topbar elements from the artboard are deliberately not built:
 *   - **The search field.** It would have nowhere to go. Discover is an /m-only
 *     route, which is exactly why AppShell's sidebar omits it too; a search box
 *     that cannot search is worse than no search box.
 *   - **The bell's unread dot.** `notification_log` records a delivery status
 *     but no read state, so a dot would be a fabricated unread count. The bell
 *     itself is real and opens notification settings.
 *
 * The streak chip IS real — `loggingStreak` over the same logs the tracker
 * reads, and the same helper the mobile home and plan tabs use.
 */
function PlannerPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, dietaryPreferences } = useUser();
    const tabParam = searchParams?.get("tab");
    const initialTab: PlannerTab =
        tabParam === "tracker" ? "tracker" : tabParam === "coach" ? "coach" : "plan";
    const autoOpenLog = searchParams?.get("log") === "1";
    const [activeTab, setActiveTab] = useState<PlannerTab>(initialTab);
    const [plan, setPlan] = useState<WeekPlan>({});
    const [streak, setStreak] = useState(0);
    const [editingSlot, setEditingSlot] = useState<{ day: string; meal: MealType } | null>(null);
    const [dishInput, setDishInput] = useState("");

    useEffect(() => {
        // localStorage read after mount — cannot run during SSR. Same tree-wide
        // pattern the tracker and every /m screen use.
        /* eslint-disable react-hooks/set-state-in-effect */
        setPlan(getMealPlan());
        setStreak(loggingStreak(getMealLogs()));
        /* eslint-enable react-hooks/set-state-in-effect */
    }, []);

    const setMeal = (day: string, meal: MealType, dish: string) => {
        const updated = { ...plan };
        if (!updated[day]) updated[day] = {};
        updated[day][meal] = { dish };
        setPlan(updated);
        saveMealPlan(updated);
        setEditingSlot(null);
        setDishInput("");
    };

    const removeMeal = (day: string, meal: MealType) => {
        const updated = { ...plan };
        if (updated[day]) {
            delete updated[day][meal];
            if (Object.keys(updated[day]).length === 0) delete updated[day];
        }
        setPlan(updated);
        saveMealPlan(updated);
    };

    const todayLabel = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
    });

    return (
        <div className="flex h-full flex-col" style={{ background: "var(--m-cream)" }}>
            {/* ── Topbar — w4b. Replaces the old sticky header. ── */}
            <div className="topbar" style={{ gap: 14, flexWrap: "wrap", minHeight: 74, height: "auto" }}>
                <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                    <span className="t-cap">{todayLabel}</span>
                    <span className="t-d2" style={{ whiteSpace: "nowrap" }}>{TAB_TITLE[activeTab]}</span>
                </div>

                <PlannerTabs active={activeTab} onChange={setActiveTab} coachEnabled />

                {streak > 0 && (
                    <span className="streak-chip" aria-label={`${streak} day logging streak`}>
                        🔥 {streak}
                    </span>
                )}

                <button
                    onClick={() => router.push("/settings/notifications")}
                    className="icon-btn"
                    aria-label="Notification settings"
                    title="Notification settings"
                >
                    <Bell width={20} height={20} />
                </button>
            </div>

            <main className="mbody" style={{ overflow: "auto" }} id={`planner-panel-${activeTab}`}>
                {activeTab === "plan" && (
                    <PlanView
                        plan={plan}
                        editingSlot={editingSlot}
                        setEditingSlot={setEditingSlot}
                        dishInput={dishInput}
                        setDishInput={setDishInput}
                        onSetMeal={setMeal}
                        onRemoveMeal={removeMeal}
                    />
                )}

                {activeTab === "tracker" && (
                    <TrackerView weekPlan={plan} isSignedIn={Boolean(user)} autoOpenLog={autoOpenLog} />
                )}

                {activeTab === "coach" && (
                    <CoachPanel
                        isSignedIn={Boolean(user)}
                        dietaryPreferences={dietaryPreferences}
                        weekPlan={plan}
                        onPlanUpdated={setPlan}
                    />
                )}
            </main>
        </div>
    );
}

interface PlanViewProps {
    plan: WeekPlan;
    editingSlot: { day: string; meal: MealType } | null;
    setEditingSlot: (slot: { day: string; meal: MealType } | null) => void;
    dishInput: string;
    setDishInput: (v: string) => void;
    onSetMeal: (day: string, meal: MealType, dish: string) => void;
    onRemoveMeal: (day: string, meal: MealType) => void;
}

function PlanView({
    plan,
    editingSlot,
    setEditingSlot,
    dishInput,
    setDishInput,
    onSetMeal,
    onRemoveMeal,
}: PlanViewProps) {
    const allDishes = DAYS.flatMap((day) =>
        MEALS.map((meal) => plan[day]?.[meal]?.dish).filter(Boolean) as string[]
    );
    const uniqueDishes = [...new Set(allDishes)];

    return (
        <div className="vstack" style={{ gap: 18 }}>
            <div className="card" style={{ overflowX: "auto", padding: 4 }}>
                <div className="grid grid-cols-[100px_repeat(7,minmax(130px,1fr))] gap-0 min-w-[1050px]">
                    <div style={{ padding: 12, borderBottom: "1.5px solid var(--m-ink-faint)" }} />
                    {DAYS.map((day) => (
                        <div
                            key={day}
                            className="t-micro"
                            style={{
                                textAlign: "center",
                                padding: "12px 8px",
                                borderBottom: "1.5px solid var(--m-ink-faint)",
                            }}
                        >
                            {day.slice(0, 3)}
                        </div>
                    ))}

                    {MEALS.map((meal, mealIdx) => (
                        <React.Fragment key={meal}>
                            <div
                                className="t-micro hstack"
                                style={{
                                    padding: "16px 12px",
                                    borderBottom: mealIdx < MEALS.length - 1 ? "1.5px solid var(--m-ink-faint)" : "none",
                                }}
                            >
                                {meal}
                            </div>
                            {DAYS.map((day) => {
                                const slot: MealSlot | undefined = plan[day]?.[meal];
                                const isEditing = editingSlot?.day === day && editingSlot?.meal === meal;

                                return (
                                    <div
                                        key={`${day}-${meal}`}
                                        style={{
                                            padding: 6,
                                            borderLeft: "1.5px solid var(--m-ink-faint)",
                                            borderBottom: mealIdx < MEALS.length - 1 ? "1.5px solid var(--m-ink-faint)" : "none",
                                            minHeight: 80,
                                        }}
                                    >
                                        {isEditing ? (
                                            <div className="vstack tint-green" style={{ padding: 8, gap: 8, borderRadius: 12 }}>
                                                <input
                                                    value={dishInput}
                                                    onChange={(e) => setDishInput(e.target.value)}
                                                    placeholder="Dish name…"
                                                    className="input"
                                                    style={{ height: 34, fontSize: 13, padding: "0 12px", width: "100%" }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" && dishInput.trim()) onSetMeal(day, meal, dishInput.trim());
                                                        if (e.key === "Escape") { setEditingSlot(null); setDishInput(""); }
                                                    }}
                                                    autoFocus
                                                />
                                                <div className="hstack" style={{ gap: 6 }}>
                                                    <button
                                                        className="pill-primary pill-sm"
                                                        style={{ height: 28, padding: "0 12px", fontSize: 12 }}
                                                        onClick={() => { if (dishInput.trim()) onSetMeal(day, meal, dishInput.trim()); }}
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        className="t-cap"
                                                        style={{ background: "none", border: "none", cursor: "pointer" }}
                                                        onClick={() => { setEditingSlot(null); setDishInput(""); }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : slot ? (
                                            <div
                                                className="group relative tint-cream"
                                                style={{ height: "100%", padding: 8, borderRadius: 12 }}
                                            >
                                                <div className="hstack" style={{ alignItems: "flex-start", gap: 6 }}>
                                                    <ChefHat width={13} height={13} style={{ color: "var(--m-forest)", marginTop: 2, flex: "none" }} />
                                                    <p className="t-cap line-clamp-3" style={{ color: "var(--m-ink)" }}>{slot.dish}</p>
                                                </div>
                                                <button
                                                    onClick={() => onRemoveMeal(day, meal)}
                                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                                    style={{ background: "none", border: "none", color: "var(--m-red)", cursor: "pointer", padding: 2 }}
                                                    aria-label={`Remove ${meal} for ${day}`}
                                                >
                                                    <X width={13} height={13} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditingSlot({ day, meal }); setDishInput(""); }}
                                                className="hstack plan-slot-empty"
                                                style={{
                                                    width: "100%",
                                                    minHeight: 72,
                                                    justifyContent: "center",
                                                    borderRadius: 12,
                                                    border: "2px dashed var(--m-ink-faint)",
                                                    background: "transparent",
                                                    color: "var(--m-ink-soft)",
                                                    cursor: "pointer",
                                                }}
                                                aria-label={`Add ${meal} for ${day}`}
                                            >
                                                <Plus width={16} height={16} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {uniqueDishes.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                    <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
                        <ShoppingCart width={16} height={16} style={{ color: "var(--m-forest)" }} />
                        <span className="t-h1">Shopping list</span>
                        <span className="chip-tag chip">{uniqueDishes.length} dishes</span>
                    </div>
                    <p className="t-body-soft" style={{ marginBottom: 16 }}>
                        Quick-buy ingredients for your planned meals:
                    </p>
                    <div className="vstack" style={{ gap: 10 }}>
                        {uniqueDishes.map((dish) => (
                            <div
                                key={dish}
                                className="row"
                                style={{ boxShadow: "none", background: "var(--m-cream)", flexWrap: "wrap", gap: 10 }}
                            >
                                <span className="t-h2 grow">{dish}</span>
                                <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
                                    {/* Partner brand colours — allowlisted in DESIGN.md. */}
                                    <DeepLinkPill href={buildBlinkitLink(dish + " ingredients")} bg="#f8d800" label="Blinkit" />
                                    <DeepLinkPill href={buildSwiggyInstamartLink(dish + " ingredients")} bg="#fc8019" label="Instamart" />
                                    <DeepLinkPill href={buildInstacartLink(dish + " ingredients")} bg="#43b02a" label="Instacart" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {uniqueDishes.length === 0 && (
                <div className="vstack" style={{ alignItems: "center", textAlign: "center", padding: "56px 16px", gap: 4 }}>
                    <span className="t-h1">Your week is empty</span>
                    <span className="t-body-soft">Click any slot above to plan your meals for the week.</span>
                </div>
            )}
        </div>
    );
}

function DeepLinkPill({ href, bg, label }: { href: string; bg: string; label: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="hstack"
            style={{
                gap: 6,
                padding: "6px 12px",
                borderRadius: "var(--m-r-pill)",
                background: bg,
                // Every partner swatch here is a light hue, so chocolate ink is
                // the readable choice on all three.
                color: "var(--m-ink)",
                font: "700 11px var(--m-font-display)",
                minHeight: 32,
            }}
        >
            {label}
            <ExternalLink width={12} height={12} />
        </a>
    );
}
