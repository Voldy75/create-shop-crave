"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ShoppingCart, ExternalLink, Clock, Users, Flame, Dumbbell, Zap, ChevronDown, BookOpen, Utensils, CalendarPlus, Bot } from "lucide-react";
import { toast } from "sonner";
import { buildBlinkitLink, buildSwiggyInstamartLink, buildInstacartLink } from "@/lib/deeplinks";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { AddToPlanDialog } from "@/components/planner/AddToPlanDialog";
import { setPendingMealLog } from "@/lib/storage";
import { parseNumeric } from "@/lib/nutrition";
import type { RecipeData, Ingredient, ShoppingLink } from "@/lib/types";

interface RecipeViewProps {
    data: RecipeData;
}

// Render a string with **bold** markdown as JSX. Keeps everything else as plain text.
// Safe against nested asterisks because we split on the outermost pairs.
function renderInline(text: string): React.ReactNode {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
            return (
                <strong key={i} style={{ fontWeight: 700, color: "var(--cc-text-primary)" }}>
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return <span key={i}>{part}</span>;
    });
}

function getLinksForIngredient(ing: Ingredient): ShoppingLink[] {
    if (ing.links && ing.links.length > 0) return ing.links;
    if (ing.link) {
        return [{ platform: "blinkit", label: "Blinkit", url: ing.link }];
    }
    return [];
}

const STORE_OPTIONS = [
    { id: "blinkit", name: "Blinkit", color: "#f8d800", buildLink: buildBlinkitLink },
    { id: "swiggy_instamart", name: "Swiggy Instamart", color: "#fc8019", buildLink: buildSwiggyInstamartLink },
    { id: "instacart", name: "Instacart", color: "#43b02a", buildLink: buildInstacartLink },
];

const FOOD_EMOJIS = ["🍗", "🧅", "🧄", "🫚", "🍅", "🌶️", "🧈", "🥛", "🍋", "🧂", "🌿", "🫘", "🥚", "🍚", "🥥", "🫒", "🥕", "🥔", "🌽", "🍞"];

function getIngredientEmoji(item: string, index: number): string {
    const lower = item.toLowerCase();
    if (lower.includes("chicken") || lower.includes("meat") || lower.includes("mutton")) return "🍗";
    if (lower.includes("onion")) return "🧅";
    if (lower.includes("garlic")) return "🧄";
    if (lower.includes("ginger")) return "🫚";
    if (lower.includes("tomato")) return "🍅";
    if (lower.includes("chili") || lower.includes("pepper") || lower.includes("mirch")) return "🌶️";
    if (lower.includes("butter") || lower.includes("ghee")) return "🧈";
    if (lower.includes("cream") || lower.includes("milk") || lower.includes("yogurt") || lower.includes("curd")) return "🥛";
    if (lower.includes("lemon") || lower.includes("lime")) return "🍋";
    if (lower.includes("salt") || lower.includes("spice") || lower.includes("masala") || lower.includes("cumin") || lower.includes("turmeric")) return "🧂";
    if (lower.includes("coriander") || lower.includes("cilantro") || lower.includes("parsley") || lower.includes("mint") || lower.includes("basil")) return "🌿";
    if (lower.includes("dal") || lower.includes("lentil") || lower.includes("bean") || lower.includes("chickpea")) return "🫘";
    if (lower.includes("egg")) return "🥚";
    if (lower.includes("rice") || lower.includes("basmati")) return "🍚";
    if (lower.includes("coconut")) return "🥥";
    if (lower.includes("oil") || lower.includes("olive")) return "🫒";
    if (lower.includes("carrot")) return "🥕";
    if (lower.includes("potato")) return "🥔";
    if (lower.includes("corn")) return "🌽";
    if (lower.includes("bread") || lower.includes("naan") || lower.includes("roti") || lower.includes("flour")) return "🍞";
    return FOOD_EMOJIS[index % FOOD_EMOJIS.length];
}

export function RecipeView({ data }: RecipeViewProps) {
    const router = useRouter();
    const [selectedStore, setSelectedStore] = useState(STORE_OPTIONS[0]);
    const [showStoreDropdown, setShowStoreDropdown] = useState(false);
    const [planDialogOpen, setPlanDialogOpen] = useState(false);

    const handleLogToTracker = () => {
        const n = data.nutritionEstimate;
        setPendingMealLog({
            name: data.name,
            calories: parseNumeric(n?.calories),
            protein: parseNumeric(n?.protein),
            carbs: parseNumeric(n?.carbs),
            fat: parseNumeric(n?.fat),
            source: "search",
        });
        router.push("/planner?tab=tracker&log=1");
    };

    const allItems = data.ingredients.map((i) => i.item).join(", ");

    return (
        <Card className="w-full overflow-hidden shadow-none border-0" style={{ background: "var(--cc-surface)", color: "var(--cc-text-primary)", borderRadius: "16px" }}>

            {/* ── Hero Section — Recipe title + image ── */}
            <div className="grid md:grid-cols-[1fr_1.2fr]" style={{ borderBottom: "1px solid var(--cc-border)" }}>
                {/* Left: Recipe info */}
                <div className="flex flex-col justify-center" style={{ padding: "32px 28px" }}>
                    <h2 style={{
                        fontSize: "clamp(24px, 3vw, 32px)",
                        fontWeight: 700,
                        lineHeight: 1.12,
                        letterSpacing: "-0.02em",
                        color: "var(--cc-text-primary)",
                    }}>
                        {data.name}
                    </h2>

                    <p style={{
                        marginTop: "12px",
                        fontSize: "15px",
                        lineHeight: 1.5,
                        color: "var(--cc-text-secondary)",
                    }}>
                        {data.description}
                    </p>

                    {/* Metadata pill */}
                    <div className="inline-flex items-center gap-2 mt-4" style={{
                        padding: "8px 16px",
                        borderRadius: "980px",
                        border: "1px solid var(--cc-border)",
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "var(--cc-text-secondary)",
                        width: "fit-content",
                    }}>
                        {data.prepTime && <><Clock className="w-3.5 h-3.5" /> {data.prepTime}</>}
                        {data.prepTime && data.servings && <span style={{ color: "var(--cc-border)" }}>·</span>}
                        {data.servings && <><Users className="w-3.5 h-3.5" /> {data.servings} servings</>}
                        {data.nutritionEstimate && (
                            <>
                                <span style={{ color: "var(--cc-border)" }}>·</span>
                                <Flame className="w-3.5 h-3.5" style={{ color: "var(--cc-accent)" }} />
                                {data.nutritionEstimate.calories}
                            </>
                        )}
                    </div>

                    {/* Dietary tags */}
                    {data.dietaryTags && data.dietaryTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {data.dietaryTags.map((tag) => (
                                <span key={tag} style={{
                                    fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "980px",
                                    background: "rgba(52,199,89,0.1)", color: "#34c759", textTransform: "uppercase", letterSpacing: "0.02em",
                                }}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                        <button
                            onClick={handleLogToTracker}
                            className="flex items-center gap-1.5 px-4 py-2 text-white transition-colors"
                            style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                background: "var(--cc-accent)",
                                borderRadius: "980px",
                            }}
                            aria-label="Log this meal to your tracker"
                        >
                            <Utensils className="w-3.5 h-3.5" />
                            I ate this
                        </button>
                        <button
                            onClick={() => setPlanDialogOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 transition-colors"
                            style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                background: "var(--cc-surface-2)",
                                color: "var(--cc-text-primary)",
                                border: "1px solid var(--cc-border)",
                                borderRadius: "980px",
                            }}
                            aria-label="Add this recipe to your weekly plan"
                        >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            Add to plan
                        </button>
                        <button
                            onClick={() => {
                                const ingredientList = data.ingredients.map((i) => `${i.item}${i.quantity ? ` (${i.quantity})` : ""}`).join(", ");
                                const prompt = `Order these ingredients on Instamart for ${data.name}: ${ingredientList}. Use my saved address.`;
                                router.push(`/chat?agent=1&q=${encodeURIComponent(prompt)}`);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 transition-colors text-white"
                            style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                background: "#fc8019",
                                borderRadius: "980px",
                            }}
                            aria-label="Order these ingredients on Swiggy Instamart"
                        >
                            <Bot className="w-3.5 h-3.5" />
                            Order on Instamart
                        </button>
                        <FavoriteButton type="recipe" data={data} />
                        <ShareButton title={data.name} text={`Check out this recipe for ${data.name}!`} />
                    </div>
                </div>

                {/* Right: Food image placeholder */}
                <div
                    className="relative flex items-center justify-center overflow-hidden"
                    style={{
                        background: "linear-gradient(135deg, rgba(255,107,53,0.08) 0%, rgba(255,107,53,0.02) 100%)",
                        minHeight: "280px",
                    }}
                >
                    <div className="text-center space-y-3">
                        <span style={{ fontSize: "72px", display: "block" }}>
                            {data.name.toLowerCase().includes("chicken") ? "🍗" :
                             data.name.toLowerCase().includes("pizza") ? "🍕" :
                             data.name.toLowerCase().includes("salad") ? "🥗" :
                             data.name.toLowerCase().includes("pasta") ? "🍝" :
                             data.name.toLowerCase().includes("curry") ? "🍛" :
                             data.name.toLowerCase().includes("biryani") ? "🍚" :
                             data.name.toLowerCase().includes("soup") ? "🍜" :
                             data.name.toLowerCase().includes("cake") || data.name.toLowerCase().includes("dessert") ? "🎂" :
                             data.name.toLowerCase().includes("bread") || data.name.toLowerCase().includes("naan") ? "🫓" :
                             data.name.toLowerCase().includes("rice") ? "🍚" :
                             "🍽️"}
                        </span>
                        <p style={{ fontSize: "12px", color: "var(--cc-text-tertiary)", fontWeight: 500 }}>
                            AI-generated recipe
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Nutrition Bar ── */}
            {data.nutritionEstimate && (
                <div className="flex items-center gap-6 flex-wrap" style={{ padding: "16px 28px", borderBottom: "1px solid var(--cc-border)" }}>
                    <div className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5" style={{ color: "var(--cc-accent)" }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--cc-accent)" }}>{data.nutritionEstimate.calories}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Dumbbell className="w-3.5 h-3.5" style={{ color: "#0a84ff" }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#0a84ff" }}>{data.nutritionEstimate.protein} protein</span>
                    </div>
                    <span style={{ fontSize: "13px", color: "var(--cc-text-secondary)" }}>{data.nutritionEstimate.carbs} carbs</span>
                    <span style={{ fontSize: "13px", color: "var(--cc-text-secondary)" }}>{data.nutritionEstimate.fat} fat</span>
                </div>
            )}

            {/* ── Ingredients Section ── */}
            <div style={{ padding: "28px" }}>
                <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: "20px" }}>
                    <h3 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--cc-text-primary)" }}>
                        Ingredients
                    </h3>

                    {/* Store selector + Add all button */}
                    <div className="flex items-center gap-3">
                        {/* Store dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                                className="flex items-center gap-2 transition-colors"
                                style={{
                                    padding: "8px 14px",
                                    borderRadius: "980px",
                                    border: "1px solid var(--cc-border)",
                                    background: "var(--cc-surface-2)",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    color: "var(--cc-text-primary)",
                                    cursor: "pointer",
                                }}
                            >
                                <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: selectedStore.color, fontSize: "9px", fontWeight: 700, color: "#fff" }}>
                                    {selectedStore.name[0]}
                                </span>
                                {selectedStore.name}
                                <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--cc-text-tertiary)" }} />
                            </button>
                            {showStoreDropdown && (
                                <div
                                    className="absolute right-0 mt-2 z-20"
                                    style={{
                                        background: "var(--cc-surface)",
                                        border: "1px solid var(--cc-border)",
                                        borderRadius: "12px",
                                        boxShadow: "var(--cc-shadow-sm)",
                                        overflow: "hidden",
                                        minWidth: "180px",
                                    }}
                                >
                                    {STORE_OPTIONS.map((store) => (
                                        <button
                                            key={store.id}
                                            onClick={() => { setSelectedStore(store); setShowStoreDropdown(false); }}
                                            className={`w-full flex items-center gap-2 text-left transition-colors hover:bg-[var(--cc-surface-2)] ${selectedStore.id === store.id ? "bg-[var(--cc-surface-2)]" : "bg-transparent"}`}
                                            style={{
                                                padding: "10px 14px",
                                                fontSize: "13px",
                                                fontWeight: selectedStore.id === store.id ? 600 : 400,
                                                color: "var(--cc-text-primary)",
                                                border: "none",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: store.color, fontSize: "9px", fontWeight: 700, color: "#fff" }}>
                                                {store.name[0]}
                                            </span>
                                            {store.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add all to cart */}
                        <a
                            href={selectedStore.buildLink(allItems)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                            style={{
                                padding: "10px 20px",
                                borderRadius: "980px",
                                background: selectedStore.color,
                                color: selectedStore.id === "blinkit" ? "#1d1d1f" : "#ffffff",
                                fontSize: "14px",
                                fontWeight: 600,
                                textDecoration: "none",
                            }}
                        >
                            <ShoppingCart className="w-4 h-4" />
                            Add {data.ingredients.length} items to cart
                        </a>
                    </div>
                </div>

                {/* Ingredient grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {data.ingredients.map((ing, idx) => {
                        const emoji = getIngredientEmoji(ing.item, idx);
                        const links = getLinksForIngredient(ing);
                        const storeLink = links.find(l => l.platform === selectedStore.id)?.url || selectedStore.buildLink(ing.item);

                        return (
                            <div key={idx} className="flex flex-col" style={{
                                borderRadius: "12px",
                                border: "1px solid var(--cc-border)",
                                overflow: "hidden",
                                background: "var(--cc-surface)",
                            }}>
                                {/* Emoji image area */}
                                <a
                                    href={storeLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center relative transition-colors"
                                    style={{
                                        height: "100px",
                                        background: "var(--cc-surface-2)",
                                        cursor: "pointer",
                                    }}
                                >
                                    <span style={{ fontSize: "40px" }}>{emoji}</span>
                                    {/* Cart badge */}
                                    <span className="absolute top-2 right-2 flex items-center justify-center" style={{
                                        width: "22px", height: "22px", borderRadius: "50%",
                                        background: selectedStore.color,
                                        color: selectedStore.id === "blinkit" ? "#1d1d1f" : "#fff",
                                        fontSize: "11px", fontWeight: 700,
                                    }}>
                                        +
                                    </span>
                                </a>

                                {/* Info */}
                                <div style={{ padding: "10px 12px" }}>
                                    <p className="line-clamp-2" style={{
                                        fontSize: "13px", fontWeight: 500, lineHeight: 1.3,
                                        color: "var(--cc-text-primary)",
                                        minHeight: "34px",
                                    }}>
                                        {ing.quantity ? `${ing.quantity} ${ing.item}` : ing.item}
                                    </p>
                                    <p className="text-price" style={{ fontSize: "15px", fontWeight: 700, color: "var(--cc-text-primary)", marginTop: "4px" }}>
                                        {ing.price}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Total estimate */}
                <div className="flex items-center justify-between" style={{
                    marginTop: "20px", paddingTop: "16px",
                    borderTop: "1px solid var(--cc-border)",
                }}>
                    <span style={{ fontSize: "14px", color: "var(--cc-text-secondary)" }}>Estimated total</span>
                    <span className="text-price" style={{ fontSize: "22px", fontWeight: 700, color: "var(--cc-text-primary)" }}>
                        ₹{data.ingredients.reduce((acc, curr) => {
                            const price = parseFloat(curr.price.replace(/[^0-9.]/g, "")) || 0;
                            return acc + price;
                        }, 0)}
                    </span>
                </div>
            </div>

            {/* ── About this recipe + Preparation ── */}
            <div style={{ borderTop: "1px solid var(--cc-border)" }}>
                <div className="grid md:grid-cols-2 gap-0">
                    {/* Left: About + Full Ingredient List */}
                    <div style={{ padding: "28px 28px 32px", borderRight: "1px solid var(--cc-border)" }}>
                        {/* About */}
                        <h3 style={{
                            fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em",
                            color: "var(--cc-text-primary)", marginBottom: "10px",
                        }}>
                            About this recipe
                        </h3>
                        <p style={{
                            fontSize: "15px", lineHeight: 1.5, letterSpacing: "-0.01em",
                            color: "var(--cc-text-secondary)",
                            marginBottom: "24px",
                        }}>
                            {renderInline(data.description)}
                        </p>

                        {/* Full ingredient list */}
                        <h4 style={{
                            fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em",
                            color: "var(--cc-text-primary)", marginBottom: "10px",
                        }}>
                            Full ingredient list
                        </h4>
                        <ul style={{ paddingLeft: "20px", margin: 0 }}>
                            {data.ingredients.map((ing, idx) => (
                                <li key={idx} style={{
                                    fontSize: "15px", lineHeight: 1.5, letterSpacing: "-0.01em",
                                    color: "var(--cc-text-secondary)",
                                    paddingBottom: "2px",
                                }}>
                                    {ing.quantity ? `${ing.quantity} ${ing.item}` : ing.item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right: Preparation */}
                    <div style={{ padding: "28px 28px 32px" }}>
                        <h3 style={{
                            fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em",
                            color: "var(--cc-text-primary)", marginBottom: "18px",
                        }}>
                            Preparation
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                            {data.instructions.map((step, idx) => (
                                <div key={idx} className="flex" style={{ gap: "14px" }}>
                                    <div
                                        className="flex-shrink-0 flex items-center justify-center"
                                        style={{
                                            width: "28px", height: "28px", borderRadius: "50%",
                                            fontSize: "13px", fontWeight: 700,
                                            background: "var(--cc-text-primary)", color: "var(--cc-surface)",
                                        }}
                                    >
                                        {idx + 1}
                                    </div>
                                    <p style={{
                                        fontSize: "15px",
                                        lineHeight: 1.5,
                                        letterSpacing: "-0.01em",
                                        color: "var(--cc-text-secondary)",
                                        paddingTop: "3px",
                                    }}>
                                        {renderInline(step)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <AddToPlanDialog
                open={planDialogOpen}
                recipe={data}
                onClose={() => setPlanDialogOpen(false)}
                onAdded={() => toast(`Added to plan: ${data.name}`)}
            />
        </Card>
    );
}
