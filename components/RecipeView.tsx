"use client";

import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, ExternalLink, ChefHat, Clock, Users, Flame, Dumbbell } from "lucide-react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import type { RecipeData, Ingredient, ShoppingLink } from "@/lib/types";

interface RecipeViewProps {
    data: RecipeData;
}

function getLinksForIngredient(ing: Ingredient): ShoppingLink[] {
    if (ing.links && ing.links.length > 0) return ing.links;
    // Backward compat: old single-link format
    if (ing.link) {
        return [{ platform: "blinkit", label: "Blinkit", url: ing.link }];
    }
    return [];
}

const platformColors: Record<string, { bg: string; hover: string }> = {
    blinkit: { bg: "bg-yellow-500", hover: "hover:bg-yellow-600" },
    swiggy_instamart: { bg: "bg-orange-500", hover: "hover:bg-orange-600" },
    instacart: { bg: "bg-green-600", hover: "hover:bg-green-700" },
};

export function RecipeView({ data }: RecipeViewProps) {
    return (
        <Card className="w-full bg-white shadow-none border-0 overflow-hidden">
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-orange-600">
                        <ChefHat className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider text-xs">Cook at Home</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <FavoriteButton type="recipe" data={data} />
                        <ShareButton title={data.name} text={`Check out this recipe for ${data.name}!`} />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{data.name}</h2>
                <p className="text-gray-500 mt-1">{data.description}</p>

                {/* Recipe metadata */}
                <div className="flex flex-wrap gap-3 mt-3">
                    {data.prepTime && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                            <Clock className="w-3 h-3" /> {data.prepTime}
                        </span>
                    )}
                    {data.servings && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                            <Users className="w-3 h-3" /> {data.servings} servings
                        </span>
                    )}
                    {data.dietaryTags?.map((tag) => (
                        <span
                            key={tag}
                            className="inline-flex items-center text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full"
                        >
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Nutrition estimate */}
                {data.nutritionEstimate && (
                    <div className="flex flex-wrap gap-3 mt-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full">
                            <Flame className="w-3 h-3" /> {data.nutritionEstimate.calories}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                            <Dumbbell className="w-3 h-3" /> {data.nutritionEstimate.protein} protein
                        </span>
                        <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                            {data.nutritionEstimate.carbs} carbs
                        </span>
                        <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                            {data.nutritionEstimate.fat} fat
                        </span>
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Ingredients Section */}
                <div className="bg-gray-50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-indigo-600" />
                            Shopping List
                        </h3>
                        <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-100">
                            ~ {data.ingredients.length} items
                        </span>
                    </div>
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-3">
                            {data.ingredients.map((ing, idx) => {
                                const links = getLinksForIngredient(ing);
                                return (
                                    <div
                                        key={idx}
                                        className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm group hover:border-indigo-100 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                                                    🥗
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 text-sm">{ing.item}</p>
                                                    <p className="text-xs text-gray-500 font-medium">
                                                        {ing.quantity && `${ing.quantity} · `}{ing.price}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {links.length > 0 && (
                                            <div className="flex gap-2 mt-2 ml-13">
                                                {links.map((lnk) => {
                                                    const colors = platformColors[lnk.platform] || { bg: "bg-gray-900", hover: "hover:bg-gray-700" };
                                                    return (
                                                        <a
                                                            key={lnk.platform}
                                                            href={lnk.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`inline-flex items-center gap-1 text-[10px] font-bold text-white ${colors.bg} ${colors.hover} px-2 py-1 rounded-full transition-colors`}
                                                        >
                                                            {lnk.label}
                                                            <ExternalLink className="w-2.5 h-2.5" />
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>

                    {/* Total Estimate */}
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                        <p className="text-sm text-gray-500 font-medium">Estimated Total</p>
                        <p className="text-lg font-bold text-gray-900">
                            ₹{data.ingredients.reduce((acc, curr) => {
                                const price = parseFloat(curr.price.replace(/[^0-9.]/g, '')) || 0;
                                return acc + price;
                            }, 0)}
                        </p>
                    </div>
                </div>

                {/* Instructions Section */}
                <div>
                    <h3 className="font-bold text-gray-900 mb-4">Instructions</h3>
                    <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-6">
                            {data.instructions.map((step, idx) => (
                                <div key={idx} className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                                        {idx + 1}
                                    </div>
                                    <p className="text-gray-600 leading-relaxed pt-1">
                                        {step}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </Card>
    );
}
