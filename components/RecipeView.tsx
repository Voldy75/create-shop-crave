"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ExternalLink, ChefHat } from "lucide-react";

interface Ingredient {
    item: string;
    price: string;
    link: string;
}

interface RecipeData {
    name: string;
    description: string;
    ingredients: Ingredient[];
    instructions: string[];
}

interface RecipeViewProps {
    data: RecipeData;
}

export function RecipeView({ data }: RecipeViewProps) {
    return (
        <Card className="w-full bg-white shadow-none border-0 overflow-hidden">
            <div className="mb-6">
                <div className="flex items-center gap-2 text-orange-600 mb-2">
                    <ChefHat className="w-4 h-4" />
                    <span className="font-bold uppercase tracking-wider text-xs">Cook at Home</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{data.name}</h2>
                <p className="text-gray-500 mt-1">{data.description}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Ingredients Section - Instacart Style */}
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
                            {data.ingredients.map((ing, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm group hover:border-indigo-100 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
                                            🥗
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm">{ing.item}</p>
                                            <p className="text-xs text-gray-500 font-medium">{ing.price}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="bg-gray-900 text-white hover:bg-indigo-600 rounded-full w-8 h-8 p-0 flex items-center justify-center transition-colors"
                                        onClick={() => window.open(ing.link, "_blank")}
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    {/* Total Estimate */}
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                        <p className="text-sm text-gray-500 font-medium">Estimated Total</p>
                        <p className="text-lg font-bold text-gray-900">
                            ₹{data.ingredients.reduce((acc, curr) => {
                                const price = parseInt(curr.price.replace(/[^0-9]/g, '')) || 0;
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
