"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ShoppingCart, Plus, X, ChefHat } from "lucide-react";
import { getMealPlan, saveMealPlan, type WeekPlan, type MealSlot } from "@/lib/storage";
import { buildBlinkitLink, buildSwiggyInstamartLink, buildInstacartLink } from "@/lib/deeplinks";
import { PlannerTabs, type PlannerTab } from "@/components/planner/PlannerTabs";
import { TrackerView } from "@/components/planner/TrackerView";
import { CoachPanel } from "@/components/planner/CoachPanel";
import { useUser } from "@/app/context/UserContext";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["breakfast", "lunch", "dinner"] as const;

type MealType = typeof MEALS[number];

export default function PlannerPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--cc-bg)" }} />}>
            <PlannerPageInner />
        </Suspense>
    );
}

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
    const [editingSlot, setEditingSlot] = useState<{ day: string; meal: MealType } | null>(null);
    const [dishInput, setDishInput] = useState("");

    useEffect(() => {
        setPlan(getMealPlan());
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

    return (
        <div className="min-h-screen" style={{ background: "var(--cc-bg)", color: "var(--cc-text-primary)" }}>
            <header className="glass-nav px-6 flex items-center gap-4 sticky top-0 z-10" style={{ height: "48px" }}>
                <button
                    onClick={() => router.push("/chat")}
                    className="p-2 rounded-full transition-opacity hover:opacity-70"
                    style={{ color: "var(--cc-text-secondary)" }}
                    aria-label="Back to chat"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 style={{ fontSize: "14px", fontWeight: 400, color: "var(--cc-text-primary)" }}>
                    Weekly Meal Planner
                </h1>
            </header>

            <main className="max-w-[1080px] mx-auto p-6 space-y-6">
                <div className="flex justify-center sm:justify-start">
                    <PlannerTabs active={activeTab} onChange={setActiveTab} coachEnabled />
                </div>

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
        <div className="space-y-8">
            <div className="overflow-x-auto" style={{ borderRadius: "12px", border: "1px solid var(--cc-border)" }}>
                <div className="grid grid-cols-[100px_repeat(7,minmax(130px,1fr))] gap-0 min-w-[1050px]">
                    <div style={{ padding: "12px", borderBottom: "1px solid var(--cc-border)" }} />
                    {DAYS.map((day) => (
                        <div key={day}
                            className="text-center py-3 px-2"
                            style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "-0.01em",
                                color: "var(--cc-text-secondary)",
                                borderBottom: "1px solid var(--cc-border)",
                                borderLeft: "1px solid var(--cc-border)",
                            }}>
                            {day.slice(0, 3)}
                        </div>
                    ))}

                    {MEALS.map((meal, mealIdx) => (
                        <React.Fragment key={meal}>
                            <div className="flex items-center px-3 py-4"
                                style={{
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "-0.01em",
                                    color: "var(--cc-text-tertiary)",
                                    borderBottom: mealIdx < MEALS.length - 1 ? "1px solid var(--cc-border)" : "none",
                                }}>
                                {meal}
                            </div>
                            {DAYS.map((day) => {
                                const slot: MealSlot | undefined = plan[day]?.[meal];
                                const isEditing = editingSlot?.day === day && editingSlot?.meal === meal;

                                return (
                                    <div key={`${day}-${meal}`}
                                        className="p-2"
                                        style={{
                                            borderLeft: "1px solid var(--cc-border)",
                                            borderBottom: mealIdx < MEALS.length - 1 ? "1px solid var(--cc-border)" : "none",
                                            minHeight: "80px",
                                        }}>
                                        {isEditing ? (
                                            <div className="p-2 space-y-2" style={{
                                                background: "rgba(255,107,53,0.08)",
                                                borderRadius: "8px",
                                            }}>
                                                <input
                                                    value={dishInput}
                                                    onChange={(e) => setDishInput(e.target.value)}
                                                    placeholder="Dish name..."
                                                    className="w-full px-2 py-1.5 outline-none"
                                                    style={{
                                                        fontSize: "12px",
                                                        borderRadius: "8px",
                                                        background: "var(--cc-surface-2)",
                                                        color: "var(--cc-text-primary)",
                                                        border: "1px solid var(--cc-border)",
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" && dishInput.trim()) onSetMeal(day, meal, dishInput.trim());
                                                        if (e.key === "Escape") { setEditingSlot(null); setDishInput(""); }
                                                    }}
                                                    autoFocus
                                                />
                                                <div className="flex gap-1">
                                                    <button
                                                        className="text-white"
                                                        style={{ fontSize: "10px", fontWeight: 600, padding: "4px 8px", borderRadius: "980px", background: "#ff6b35" }}
                                                        onClick={() => { if (dishInput.trim()) onSetMeal(day, meal, dishInput.trim()); }}
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        style={{ fontSize: "10px", fontWeight: 400, padding: "4px 8px", borderRadius: "980px", color: "var(--cc-text-secondary)" }}
                                                        onClick={() => { setEditingSlot(null); setDishInput(""); }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : slot ? (
                                            <div className="h-full group relative p-2" style={{
                                                background: "var(--cc-surface-2)",
                                                borderRadius: "8px",
                                            }}>
                                                <div className="flex items-start gap-1">
                                                    <ChefHat className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "#ff6b35" }} />
                                                    <p className="line-clamp-3" style={{ fontSize: "12px", fontWeight: 400, color: "var(--cc-text-primary)" }}>{slot.dish}</p>
                                                </div>
                                                <button
                                                    onClick={() => onRemoveMeal(day, meal)}
                                                    className="absolute top-1 right-1 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    style={{ background: "var(--cc-surface-3)", color: "var(--cc-text-tertiary)" }}
                                                    aria-label="Remove meal"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setEditingSlot({ day, meal }); setDishInput(""); }}
                                                className="w-full h-full min-h-[72px] flex items-center justify-center transition-colors"
                                                style={{
                                                    border: "2px dashed var(--cc-border)",
                                                    borderRadius: "8px",
                                                    color: "var(--cc-text-tertiary)",
                                                }}
                                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,107,53,0.4)"; (e.currentTarget as HTMLButtonElement).style.color = "#ff6b35"; }}
                                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cc-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--cc-text-tertiary)"; }}
                                                aria-label={`Add ${meal} for ${day}`}
                                            >
                                                <Plus className="w-4 h-4" />
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
                <div className="p-6" style={{ background: "var(--cc-surface)", borderRadius: "12px" }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: "4px" }}>
                        <ShoppingCart className="w-4 h-4" style={{ color: "#ff6b35" }} />
                        <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--cc-text-primary)" }}>Shopping List</h2>
                        <span style={{
                            fontSize: "12px", fontWeight: 400, padding: "2px 8px",
                            borderRadius: "980px", background: "var(--cc-surface-2)", color: "var(--cc-text-tertiary)",
                        }}>
                            {uniqueDishes.length} dishes
                        </span>
                    </div>
                    <p style={{ fontSize: "14px", color: "var(--cc-text-secondary)", marginBottom: "16px" }}>
                        Quick-buy ingredients for your planned meals:
                    </p>
                    <div className="space-y-3">
                        {uniqueDishes.map((dish) => (
                            <div key={dish} className="flex items-center justify-between p-3" style={{
                                background: "var(--cc-surface-2)", borderRadius: "8px",
                            }}>
                                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--cc-text-primary)" }}>{dish}</span>
                                <div className="flex gap-2">
                                    <a href={buildBlinkitLink(dish + " ingredients")} target="_blank" rel="noopener noreferrer"
                                        className="text-white bg-yellow-500 hover:bg-yellow-600 transition-colors"
                                        style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "980px" }}>
                                        Blinkit
                                    </a>
                                    <a href={buildSwiggyInstamartLink(dish + " ingredients")} target="_blank" rel="noopener noreferrer"
                                        className="text-white bg-orange-500 hover:bg-orange-600 transition-colors"
                                        style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "980px" }}>
                                        Instamart
                                    </a>
                                    <a href={buildInstacartLink(dish + " ingredients")} target="_blank" rel="noopener noreferrer"
                                        className="text-white bg-green-600 hover:bg-green-700 transition-colors"
                                        style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "980px" }}>
                                        Instacart
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {uniqueDishes.length === 0 && (
                <div className="text-center" style={{ paddingTop: "64px", paddingBottom: "64px" }}>
                    <div style={{ fontSize: "40px", marginBottom: "12px" }}>📅</div>
                    <p style={{ fontSize: "17px", fontWeight: 600, color: "var(--cc-text-primary)" }}>Your week is empty</p>
                    <p style={{ fontSize: "14px", color: "var(--cc-text-secondary)", marginTop: "4px" }}>
                        Click any slot above to plan your meals for the week.
                    </p>
                </div>
            )}
        </div>
    );
}
