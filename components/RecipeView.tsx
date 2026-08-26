"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, ChevronDown, Utensils, CalendarPlus, Bot, Flame, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { buildBlinkitLink, buildSwiggyInstamartLink, buildInstacartLink } from "@/lib/deeplinks";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { AddToPlanDialog } from "@/components/planner/AddToPlanDialog";
import { setPendingMealLog } from "@/lib/storage";
import { setActiveRecipe, setBuyList } from "@/lib/mobile-handoff";
import { parseNumeric } from "@/lib/nutrition";
import { foodImage } from "@/lib/food-images";
import { mascotComponentFor, tileTint } from "@/lib/ingredient-mascot";
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
                <strong key={i} style={{ fontWeight: 800, color: "var(--m-ink)" }}>
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

// hex-ok-start: brand colours for grocery partners — allowlisted in DESIGN.md,
// not app-palette tokens.
const STORE_OPTIONS = [
    { id: "blinkit", name: "Blinkit", color: "#f8d800", buildLink: buildBlinkitLink },
    { id: "swiggy_instamart", name: "Swiggy Instamart", color: "#fc8019", buildLink: buildSwiggyInstamartLink },
    { id: "instacart", name: "Instacart", color: "#43b02a", buildLink: buildInstacartLink },
];
// hex-ok-end

/** "25 min" → "25", so the hero badge can carry its own "min" suffix. */
function cookMinutes(prepTime: string | undefined): string | null {
    if (!prepTime) return null;
    const n = prepTime.match(/\d+/);
    return n ? n[0] : prepTime;
}

/** Rough difficulty from step count — same thresholds as the mobile recipe screen. */
function difficultyLabel(steps: number): string {
    if (steps <= 4) return "Easy";
    if (steps <= 7) return "Medium";
    return "Pro";
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
    const img = foodImage(data.name);
    const cookMin = cookMinutes(data.prepTime);
    const estTotal = data.ingredients.reduce((acc, curr) => acc + parseNumeric(curr.price), 0);
    // Text on a store swatch/badge needs to read against that brand's own colour,
    // which is always a light hue here — dark ink reads on all three today.
    const onStore = "var(--m-ink)";

    return (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>

            {/* ── Hero: photo + badges + title, alongside a summary column ── */}
            <div className="hstack" style={{ alignItems: "stretch", gap: 24, padding: 24, flexWrap: "wrap" }}>
                <div className="duo duo-forest tint-cream" style={{ flex: "1 1 320px", maxWidth: 420, minHeight: 260 }}>
                    {img && (
                        <div className="imgfill" style={{ position: "absolute", inset: 0, backgroundImage: `url(${img})` }} />
                    )}
                    <div className="duo-body" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 20 }}>
                        <div className="hstack" style={{ gap: 8 }}>
                            {cookMin && <span className="badge badge-brown"><b>{cookMin}</b>min</span>}
                            {data.nutritionEstimate && (
                                <span className="badge badge-forest"><b>{parseNumeric(data.nutritionEstimate.calories)}</b>kcal</span>
                            )}
                            <span className="badge badge-plum"><b>{difficultyLabel(data.instructions.length)}</b></span>
                        </div>
                        <span style={{ font: "800 30px/1.05 var(--m-font-display)", color: "var(--m-on-deep)" }}>
                            {data.name}
                        </span>
                    </div>
                </div>

                <div className="vstack grow" style={{ gap: 16, minWidth: 260 }}>
                    <div className="hstack" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div className="vstack" style={{ gap: 6 }}>
                            {data.dietaryTags && data.dietaryTags.length > 0 && (
                                <span className="t-cap" style={{ color: "var(--m-forest)" }}>
                                    {data.dietaryTags.join(" · ")}
                                </span>
                            )}
                            <span className="t-h1">{data.name}</span>
                        </div>
                        <div className="hstack" style={{ gap: 8, flex: "none" }}>
                            <FavoriteButton type="recipe" data={data} />
                            <ShareButton title={data.name} text={`Check out this recipe for ${data.name}!`} />
                        </div>
                    </div>

                    {data.description && <p className="t-body-soft">{data.description}</p>}

                    {data.nutritionEstimate && (
                        <div className="hstack" style={{ gap: 16, flexWrap: "wrap" }}>
                            <span className="hstack" style={{ gap: 6 }}>
                                <Flame width={14} height={14} style={{ color: "var(--m-burnt)" }} />
                                <span className="t-cap" style={{ color: "var(--m-burnt)" }}>{data.nutritionEstimate.calories}</span>
                            </span>
                            <span className="t-cap">{data.nutritionEstimate.protein} protein</span>
                            <span className="t-cap">{data.nutritionEstimate.carbs} carbs</span>
                            <span className="t-cap">{data.nutritionEstimate.fat} fat</span>
                        </div>
                    )}

                    <div className="hstack" style={{ gap: 10, flexWrap: "wrap", marginTop: "auto" }}>
                        <button className="pill-primary" style={{ flex: "1 1 160px", padding: "0 18px" }} onClick={handleLogToTracker}>
                            <Utensils width={16} height={16} /> I ate this
                        </button>
                        <button
                            className="pill-lime"
                            style={{ flex: "1 1 160px", padding: "0 18px" }}
                            onClick={() => {
                                // Hand off to /cart rather than straight to the agent, so the
                                // pantry pre-check happens BEFORE anything is ordered — the
                                // same sequencing /m/buy gives the mobile tree.
                                setActiveRecipe(data);
                                setBuyList({ recipeName: data.name, items: data.ingredients });
                                router.push("/cart");
                            }}
                            aria-label="Review these ingredients in your cart"
                        >
                            <Bot width={16} height={16} /> Order · ₹{estTotal}
                        </button>
                        <button className="pill-plum" style={{ flex: "1 1 160px", padding: "0 18px" }} onClick={() => setPlanDialogOpen(true)}>
                            <CalendarPlus width={16} height={16} /> Add to plan
                        </button>
                        {/* ITEM 10 — w3b's "Dine out" expansion, landing on w9e.
                            It goes through Bo rather than straight to /dine-out
                            because there is no restaurant search in this app: the
                            matches ARE Bo's answer. Bo replies with a
                            RestaurantSuggestion, whose "See all on a map" button
                            then opens /dine-out. Two steps, both real — as opposed
                            to a button that jumps to an empty dine-out screen. */}
                        <button
                            className="pill-secondary"
                            style={{ flex: "1 1 160px", padding: "0 18px" }}
                            onClick={() => {
                                const prompt = `I'd rather eat out than cook ${data.name}. Where near me serves something close?`;
                                router.push(`/chat?q=${encodeURIComponent(prompt)}`);
                            }}
                            aria-label={`Find places serving something like ${data.name}`}
                        >
                            <MapPinned width={16} height={16} /> Dine out
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Ingredients — mascot tiles double as the buy list, one per store link ── */}
            <div style={{ padding: "0 24px 24px" }}>
                <div className="card" style={{ padding: 18 }}>
                    <div className="hstack" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                        <span className="t-micro">Ingredients{data.servings ? ` · serves ${data.servings}` : ""}</span>

                        <div className="hstack" style={{ gap: 8 }}>
                            <div style={{ position: "relative" }}>
                                <button onClick={() => setShowStoreDropdown(!showStoreDropdown)} className="chip" style={{ cursor: "pointer" }}>
                                    <span
                                        className="hstack"
                                        style={{
                                            width: 18, height: 18, borderRadius: "50%", flex: "none",
                                            background: selectedStore.color, color: onStore,
                                            fontSize: 9, fontWeight: 800, justifyContent: "center",
                                        }}
                                    >
                                        {selectedStore.name[0]}
                                    </span>
                                    {selectedStore.name}
                                    <ChevronDown width={14} height={14} style={{ color: "var(--m-ink-soft)" }} />
                                </button>
                                {showStoreDropdown && (
                                    <div className="card" style={{ position: "absolute", right: 0, marginTop: 8, zIndex: 20, minWidth: 190, padding: 6, overflow: "hidden" }}>
                                        {STORE_OPTIONS.map((store) => (
                                            <button
                                                key={store.id}
                                                onClick={() => { setSelectedStore(store); setShowStoreDropdown(false); }}
                                                className="hstack"
                                                style={{
                                                    width: "100%", padding: "8px 10px", borderRadius: 10, border: "none",
                                                    background: selectedStore.id === store.id ? "var(--m-cream-2)" : "transparent",
                                                    cursor: "pointer", textAlign: "left",
                                                }}
                                            >
                                                <span
                                                    className="hstack"
                                                    style={{ width: 18, height: 18, borderRadius: "50%", flex: "none", background: store.color, color: onStore, fontSize: 9, fontWeight: 800, justifyContent: "center" }}
                                                >
                                                    {store.name[0]}
                                                </span>
                                                <span className="t-cap" style={{ color: "var(--m-ink)", fontWeight: selectedStore.id === store.id ? 800 : 600 }}>
                                                    {store.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <a
                                href={selectedStore.buildLink(allItems)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hstack"
                                style={{ gap: 6, padding: "8px 16px", borderRadius: "var(--m-r-pill)", background: selectedStore.color, color: onStore, fontSize: 13, fontWeight: 700 }}
                            >
                                <ShoppingCart width={14} height={14} />
                                Add all
                            </a>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10, marginTop: 14 }}>
                        {data.ingredients.map((ing, idx) => {
                            const Mascot = mascotComponentFor(ing.item);
                            const links = getLinksForIngredient(ing);
                            const storeLink = links.find((l) => l.platform === selectedStore.id)?.url || selectedStore.buildLink(ing.item);
                            return (
                                <a
                                    key={idx}
                                    href={storeLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`mascot-tile ${tileTint(idx)}`}
                                    title={[ing.quantity, ing.item].filter(Boolean).join(" ")}
                                >
                                    <Mascot width={34} height={34} />
                                    <span className="t-cap" style={{ color: "var(--m-ink)", fontWeight: 700, textAlign: "center" }}>{ing.item}</span>
                                    {ing.quantity && <span className="t-cap">{ing.quantity}</span>}
                                    <span className="t-cap" style={{ color: "var(--m-forest)", fontWeight: 800 }}>{ing.price}</span>
                                </a>
                            );
                        })}
                    </div>

                    <div className="hstack" style={{ justifyContent: "flex-end", marginTop: 14, paddingTop: 14, borderTop: "1.5px solid var(--m-ink-faint)" }}>
                        <span className="t-cap" style={{ marginRight: 8 }}>Estimated total</span>
                        <span className="t-h2">₹{estTotal}</span>
                    </div>
                </div>
            </div>

            {/* ── About + Preparation ── */}
            <div style={{ borderTop: "1.5px solid var(--m-ink-faint)" }}>
                <div className="grid md:grid-cols-2 gap-0">
                    <div className="vstack" style={{ padding: "24px", gap: 10, borderRight: "1.5px solid var(--m-ink-faint)" }}>
                        <span className="t-h2">About this recipe</span>
                        <p className="t-body-soft">{renderInline(data.description)}</p>
                    </div>

                    <div className="vstack" style={{ padding: "24px", gap: 14 }}>
                        <span className="t-h2">Preparation</span>
                        <div className="vstack" style={{ gap: 14 }}>
                            {data.instructions.map((step, idx) => (
                                <div key={idx} className="hstack" style={{ gap: 12, alignItems: "flex-start" }}>
                                    <span
                                        className="hstack"
                                        style={{
                                            width: 28, height: 28, borderRadius: "50%", flex: "none",
                                            background: "var(--m-forest)", color: "var(--m-on-deep)",
                                            justifyContent: "center", font: "800 13px var(--m-font-display)",
                                        }}
                                    >
                                        {idx + 1}
                                    </span>
                                    <p className="t-body-soft" style={{ paddingTop: 2 }}>{renderInline(step)}</p>
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
        </div>
    );
}
