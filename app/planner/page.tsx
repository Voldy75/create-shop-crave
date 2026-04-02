"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, ShoppingCart, Plus, X, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getMealPlan, saveMealPlan, type WeekPlan, type MealSlot } from "@/lib/storage";
import { buildBlinkitLink, buildSwiggyInstamartLink, buildInstacartLink } from "@/lib/deeplinks";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["breakfast", "lunch", "dinner"] as const;

type MealType = typeof MEALS[number];

export default function PlannerPage() {
    const router = useRouter();
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

    // Collect all unique dish names for consolidated shopping list
    const allDishes = DAYS.flatMap((day) =>
        MEALS.map((meal) => plan[day]?.[meal]?.dish).filter(Boolean) as string[]
    );
    const uniqueDishes = [...new Set(allDishes)];

    return (
        <div className="min-h-screen bg-white">
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
                <button
                    onClick={() => router.push("/chat")}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Back to chat"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <h1 className="font-bold text-lg text-gray-900">Weekly Meal Planner</h1>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6 space-y-8">
                {/* Planner Grid */}
                <div className="overflow-x-auto">
                    <div className="grid grid-cols-[120px_repeat(7,minmax(140px,1fr))] gap-2 min-w-[1100px]">
                        {/* Header row */}
                        <div />
                        {DAYS.map((day) => (
                            <div key={day} className="text-center text-sm font-bold text-gray-900 py-2">
                                {day}
                            </div>
                        ))}

                        {/* Meal rows */}
                        {MEALS.map((meal) => (
                            <>
                                <div key={`label-${meal}`} className="flex items-center text-sm font-medium text-gray-500 capitalize">
                                    {meal}
                                </div>
                                {DAYS.map((day) => {
                                    const slot = plan[day]?.[meal];
                                    const isEditing = editingSlot?.day === day && editingSlot?.meal === meal;

                                    return (
                                        <div key={`${day}-${meal}`} className="min-h-[80px]">
                                            {isEditing ? (
                                                <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-200 space-y-2">
                                                    <Input
                                                        value={dishInput}
                                                        onChange={(e) => setDishInput(e.target.value)}
                                                        placeholder="Dish name..."
                                                        className="text-xs h-8 border-0 bg-white"
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" && dishInput.trim()) {
                                                                setMeal(day, meal, dishInput.trim());
                                                            }
                                                            if (e.key === "Escape") {
                                                                setEditingSlot(null);
                                                                setDishInput("");
                                                            }
                                                        }}
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-1">
                                                        <Button
                                                            size="sm"
                                                            className="text-[10px] h-6 bg-indigo-600 hover:bg-indigo-700 rounded-full px-2"
                                                            onClick={() => {
                                                                if (dishInput.trim()) setMeal(day, meal, dishInput.trim());
                                                            }}
                                                        >
                                                            Add
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-[10px] h-6 rounded-full px-2"
                                                            onClick={() => { setEditingSlot(null); setDishInput(""); }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : slot ? (
                                                <div className="p-2 bg-gray-50 rounded-xl border border-gray-100 h-full group relative">
                                                    <div className="flex items-start gap-1">
                                                        <ChefHat className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                                                        <p className="text-xs font-medium text-gray-900 line-clamp-3">{slot.dish}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => removeMeal(day, meal)}
                                                        className="absolute top-1 right-1 p-0.5 rounded-full bg-white shadow-sm text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        aria-label="Remove meal"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setEditingSlot({ day, meal }); setDishInput(""); }}
                                                    className="w-full h-full min-h-[80px] border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-300 hover:border-indigo-300 hover:text-indigo-400 transition-colors"
                                                    aria-label={`Add ${meal} for ${day}`}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        ))}
                    </div>
                </div>

                {/* Consolidated Shopping List */}
                {uniqueDishes.length > 0 && (
                    <Card className="p-6 border border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                            <ShoppingCart className="w-5 h-5 text-indigo-600" />
                            <h2 className="font-bold text-lg text-gray-900">Shopping List</h2>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                {uniqueDishes.length} dishes planned
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Quick-buy ingredients for your planned meals:
                        </p>
                        <div className="space-y-3">
                            {uniqueDishes.map((dish) => (
                                <div key={dish} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <span className="font-medium text-sm text-gray-900">{dish}</span>
                                    <div className="flex gap-2">
                                        <a
                                            href={buildBlinkitLink(dish + " ingredients")}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] font-bold text-white bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded-full transition-colors"
                                        >
                                            Blinkit
                                        </a>
                                        <a
                                            href={buildSwiggyInstamartLink(dish + " ingredients")}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] font-bold text-white bg-orange-500 hover:bg-orange-600 px-2 py-1 rounded-full transition-colors"
                                        >
                                            Instamart
                                        </a>
                                        <a
                                            href={buildInstacartLink(dish + " ingredients")}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 px-2 py-1 rounded-full transition-colors"
                                        >
                                            Instacart
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </main>
        </div>
    );
}
