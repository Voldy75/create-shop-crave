"use client";

/**
 * /home — the signed-in dashboard.
 *
 * WHY THIS ROUTE EXISTS AT ALL. The web app had no home: `/` is the marketing
 * landing, and a signed-in visitor was redirected straight to /chat. AppShell's
 * sidebar has had a "Home" item pointing at `/` since Phase 10c, which for a
 * signed-in user meant "go to the landing page, which will bounce you to chat".
 *
 * WHY IT IS NOT BUILT FROM AN ARTBOARD. w2a — the board Phase 10c built the
 * shell from — no longer exists in the design file; it was replaced wholesale by
 * the w6–w9 boards. So this is composed from the meshi system and the mobile
 * home screen's structure rather than traced from a drawing, and it deliberately
 * shows only what this app can actually answer.
 *
 * ITEM 9 asked for "data of the past 2 days to display suggestions", and that
 * window is taken literally: PAST_DAYS = 2, read through lib/nutrition's
 * lastNDates / logsByDay, which is the same machinery the tracker uses.
 *
 * WHAT IS DELIBERATELY NOT HERE:
 *   - A "recommended for you" feed. There is no recipe catalogue and no
 *     recommender; every suggestion below is derived from the user's OWN logs,
 *     goals and dietary preferences, and each one says what it is reacting to.
 *   - Any streak/goal number that is not computed from real meal logs.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChefHat, Flame, MessageSquare, ShoppingBag, Sparkles, TrendingUp } from "lucide-react";
import { AppTopbar } from "@/components/web/AppTopbar";
import { useUser } from "@/app/context/UserContext";
import { MascotFor } from "@/components/mascots";
import { getMealLogs, getNutritionGoals } from "@/lib/storage";
import { dayTotals, lastNDates, loggingStreak, localDateKey } from "@/lib/nutrition";
import { savedRecipes, recipeSlug } from "@/lib/recipe-slug";
import { listConversations, relativeStamp, type Conversation } from "@/lib/conversation-history";
import { listGroceryRuns, runDayLabel, type GroceryRun } from "@/lib/grocery-history";
import { setActiveRecipe } from "@/lib/mobile-handoff";
import type { MealLog, NutritionGoals, RecipeData } from "@/lib/types";

/** ITEM 9's window. Two days is short on purpose — it is "what have you been
 *  eating lately", not a trend line. The tracker owns longer horizons. */
const PAST_DAYS = 2;

interface Suggestion {
  id: string;
  title: string;
  /** What in the data produced this. Rendered, so no suggestion is unexplained. */
  because: string;
  href: string;
  cta: string;
}

/**
 * Suggestions from the last two days of real logs. Every branch names the
 * number it is reacting to, and if there is nothing to react to the list is
 * empty rather than padded with generic advice.
 */
function buildSuggestions(
  logs: MealLog[],
  goals: NutritionGoals | null,
  dietaryPreferences: string[]
): Suggestion[] {
  const dates = lastNDates(PAST_DAYS);
  const windowLogs = logs.filter((l) => dates.includes(l.date));
  const out: Suggestion[] = [];

  if (windowLogs.length === 0) {
    out.push({
      id: "first-log",
      title: "Log something you ate",
      because: "Nothing logged in the last two days",
      href: "/planner?tab=tracker&log=1",
      cta: "Open the tracker",
    });
    return out;
  }

  const today = localDateKey();
  const todayTotals = dayTotals(logs, today);

  if (goals) {
    const kcalLeft = Math.round(goals.dailyCalories - todayTotals.calories);
    if (kcalLeft > 250) {
      out.push({
        id: "kcal-left",
        title: `About ${kcalLeft} kcal left today`,
        because: `${Math.round(todayTotals.calories)} of ${goals.dailyCalories} logged so far`,
        href: "/chat",
        cta: "Ask Bo for something that fits",
      });
    }

    // Protein over the window, compared with the window's worth of the goal.
    const windowProtein = windowLogs.reduce((s, l) => s + (l.protein ?? 0), 0);
    const target = goals.protein * PAST_DAYS;
    if (target > 0 && windowProtein < target * 0.8) {
      out.push({
        id: "protein",
        title: "Protein is running behind",
        because: `${Math.round(windowProtein)}g over ${PAST_DAYS} days against a ${goals.protein}g daily goal`,
        href: "/chat",
        cta: "Ask for a high-protein meal",
      });
    }
  }

  // Repetition is a real, checkable observation about the window.
  const names = windowLogs.map((l) => l.name?.toLowerCase()).filter(Boolean) as string[];
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const repeated = [...counts.entries()].find(([, c]) => c >= 3);
  if (repeated) {
    out.push({
      id: "variety",
      title: "Same meal three times",
      because: `"${repeated[0]}" appears ${repeated[1]} times in the last ${PAST_DAYS} days`,
      href: "/chat",
      cta: "Ask for something different",
    });
  }

  if (dietaryPreferences.length > 0 && out.length < 3) {
    out.push({
      id: "prefs",
      title: "Something new that still fits",
      because: `Respecting ${dietaryPreferences.slice(0, 3).join(", ")}`,
      href: "/chat",
      cta: "Ask Bo",
    });
  }

  return out.slice(0, 3);
}

export default function HomePage() {
  const router = useRouter();
  const { user, userName, hydrated, dietaryPreferences } = useUser();

  const [logs, setLogs] = useState<MealLog[]>([]);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [saved, setSaved] = useState<Array<{ id: string; savedAt: string; recipe: RecipeData }>>([]);
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [runs, setRuns] = useState<GroceryRun[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(() => {
    setLogs(getMealLogs());
    setGoals(getNutritionGoals());
    setSaved(savedRecipes());
    setThreads(listConversations());
    setRuns(listGroceryRuns());
    setReady(true);
  }, []);

  useEffect(() => {
    // localStorage read after mount — cannot run during SSR. Same scoped
    // disable and same reason as /cart's hydration effect.
    /* eslint-disable react-hooks/set-state-in-effect */
    load();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  useEffect(() => {
    if (hydrated && !user) router.replace("/");
  }, [hydrated, user, router]);

  const dates = useMemo(() => lastNDates(PAST_DAYS), []);
  const windowLogs = useMemo(() => logs.filter((l) => dates.includes(l.date)), [logs, dates]);
  const streak = useMemo(() => loggingStreak(logs), [logs]);
  const suggestions = useMemo(
    () => buildSuggestions(logs, goals, dietaryPreferences),
    [logs, goals, dietaryPreferences]
  );
  const todayTotals = useMemo(() => dayTotals(logs, localDateKey()), [logs]);

  const firstName = userName?.split(" ")[0];

  const startCooking = (recipe: RecipeData) => {
    setActiveRecipe(recipe);
    router.push(`/recipes/${recipeSlug(recipe.name)}/cook`);
  };

  if (!ready) return <main className="mbody" />;

  return (
    <>
      <AppTopbar
        title={firstName ? `Hey, ${firstName}` : "Home"}
        caption={
          windowLogs.length > 0
            ? `${windowLogs.length} meal${windowLogs.length === 1 ? "" : "s"} logged in the last ${PAST_DAYS} days`
            : `Nothing logged in the last ${PAST_DAYS} days`
        }
      >
        {streak > 0 && (
          <span className="chip pill-sm">
            <Flame width={14} height={14} style={{ color: "var(--m-burnt)" }} aria-hidden />
            {streak} day{streak === 1 ? "" : "s"}
          </span>
        )}
        <Link href="/chat" className="pill-primary pill-sm" style={{ textDecoration: "none" }}>
          <Sparkles width={15} height={15} aria-hidden /> Ask Bo
        </Link>
      </AppTopbar>

      <main className="mbody">
        <div className="vstack" style={{ gap: 22, padding: "24px 32px 40px", maxWidth: 1180, margin: "0 auto", width: "100%" }}>
          {/* ── Today, from real logs ── */}
          <div className="home-grid">
            <div className="card vstack" style={{ padding: 20, gap: 13 }}>
              <div className="hstack" style={{ gap: 10 }}>
                <TrendingUp width={19} height={19} style={{ color: "var(--m-forest)", flex: "none" }} aria-hidden />
                <span className="t-d2" style={{ fontSize: 18 }}>Today</span>
              </div>
              <div className="hstack" style={{ gap: 22, flexWrap: "wrap" }}>
                <div className="vstack" style={{ gap: 0 }}>
                  {/* --figure-accent, not --m-forest: bare forest measures
                      2.63:1 on the dark card, failing AA even at the 3:1
                      large-text bar. See the token's note in globals.css —
                      including why the obvious color-mix fix is worse. */}
                  <span className="t-d1" style={{ fontSize: 30, color: "var(--figure-accent)" }}>
                    {Math.round(todayTotals.calories)}
                  </span>
                  <span className="t-cap">{goals ? `of ${goals.dailyCalories} kcal` : "kcal logged"}</span>
                </div>
                <div className="vstack" style={{ gap: 0 }}>
                  <span className="t-d2">{Math.round(todayTotals.protein)}g</span>
                  <span className="t-cap">protein</span>
                </div>
                <div className="vstack" style={{ gap: 0 }}>
                  <span className="t-d2">{Math.round(todayTotals.carbs)}g</span>
                  <span className="t-cap">carbs</span>
                </div>
                <div className="vstack" style={{ gap: 0 }}>
                  <span className="t-d2">{Math.round(todayTotals.fat)}g</span>
                  <span className="t-cap">fat</span>
                </div>
              </div>
              {!goals && (
                <span className="t-cap">
                  Set your goals in the tracker and these get a target to sit against.
                </span>
              )}
              <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
                <Link href="/planner?tab=tracker&log=1" className="pill-primary pill-sm" style={{ textDecoration: "none" }}>
                  Log a meal
                </Link>
                <Link href="/planner" className="chip pill-sm" style={{ textDecoration: "none" }}>
                  Open planner
                </Link>
              </div>
            </div>

            {/* ── Suggestions, each with its reason ── */}
            <div className="card vstack" style={{ padding: 20, gap: 13 }}>
              <div className="hstack" style={{ gap: 10 }}>
                <Sparkles width={19} height={19} style={{ color: "var(--m-plum)", flex: "none" }} aria-hidden />
                <span className="t-d2" style={{ fontSize: 18 }}>What Bo noticed</span>
                <div className="grow" />
                <span className="t-cap">last {PAST_DAYS} days</span>
              </div>

              {suggestions.length === 0 ? (
                <span className="t-body-soft">
                  Nothing worth flagging — you&rsquo;re tracking close to your goals.
                </span>
              ) : (
                <div className="vstack" style={{ gap: 9 }}>
                  {suggestions.map((s) => (
                    <div key={s.id} className="row" style={{ padding: "12px 14px", boxShadow: "none", background: "var(--m-cream)", alignItems: "flex-start" }}>
                      <div className="vstack grow" style={{ gap: 2, minWidth: 0 }}>
                        <span className="t-h2" style={{ fontSize: 14 }}>{s.title}</span>
                        {/* Every suggestion states the data behind it, so none
                            of them reads as an oracle. */}
                        <span className="t-cap">{s.because}</span>
                      </div>
                      <Link href={s.href} className="chip pill-sm" style={{ textDecoration: "none", flex: "none" }}>
                        {s.cta}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Saved recipes ── */}
          {saved.length > 0 && (
            <div className="card vstack" style={{ padding: 20, gap: 14 }}>
              <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
                <ChefHat width={19} height={19} style={{ color: "var(--m-forest)", flex: "none" }} aria-hidden />
                <span className="t-d2" style={{ fontSize: 18 }}>Back to your shelf</span>
                <div className="grow" />
                <Link href="/recipes" className="wlink" style={{ textDecoration: "none" }}>
                  All {saved.length}
                </Link>
              </div>
              <div className="home-shelf">
                {saved.slice(0, 4).map((r) => (
                  <button
                    key={r.id}
                    className="din-lift"
                    onClick={() => startCooking(r.recipe)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
                      background: "var(--m-cream-2)", border: "none", borderRadius: 16,
                      padding: 13, cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <MascotFor name={r.recipe.name} width={30} height={30} aria-hidden />
                    <span className="t-h2" style={{ fontSize: 14 }}>{r.recipe.name}</span>
                    <span className="t-cap" style={{ fontSize: 11.5 }}>
                      {r.recipe.ingredients.length} ingredients
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Pick a thread back up / recent grocery hand-offs ── */}
          <div className="home-grid">
            {threads.length > 0 && (
              <div className="card vstack" style={{ padding: 20, gap: 12 }}>
                <div className="hstack" style={{ gap: 10 }}>
                  <MessageSquare width={18} height={18} style={{ color: "var(--m-forest)", flex: "none" }} aria-hidden />
                  <span className="t-d2" style={{ fontSize: 18 }}>Pick up where you left off</span>
                </div>
                <div className="vstack" style={{ gap: 7 }}>
                  {threads.slice(0, 3).map((t) => (
                    <Link
                      key={t.id}
                      href="/chat"
                      className="row"
                      style={{ padding: "11px 13px", boxShadow: "none", background: "var(--m-cream)", textDecoration: "none" }}
                    >
                      <span className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                        <span className="t-h2 conv-clip" style={{ fontSize: 13.5 }}>{t.title}</span>
                        {t.snippet && <span className="t-cap conv-clip" style={{ fontSize: 11.5 }}>{t.snippet}</span>}
                      </span>
                      <span className="t-cap" style={{ flex: "none" }}>{relativeStamp(t.at)}</span>
                    </Link>
                  ))}
                </div>
                <span className="t-cap">Chats are kept 3 days on this device.</span>
              </div>
            )}

            {runs.length > 0 && (
              <div className="card vstack" style={{ padding: 20, gap: 12 }}>
                <div className="hstack" style={{ gap: 10 }}>
                  <ShoppingBag width={18} height={18} style={{ color: "var(--m-forest)", flex: "none" }} aria-hidden />
                  <span className="t-d2" style={{ fontSize: 18 }}>Recently sent to a store</span>
                  <div className="grow" />
                  <Link href="/cart" className="wlink" style={{ textDecoration: "none" }}>Groceries</Link>
                </div>
                <div className="vstack" style={{ gap: 7 }}>
                  {runs.slice(0, 3).map((r) => (
                    <div key={r.id} className="row" style={{ padding: "11px 13px", boxShadow: "none", background: "var(--m-cream)" }}>
                      <span className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                        <span className="t-h2" style={{ fontSize: 13.5 }}>{r.recipeName ?? "Shopping list"}</span>
                        <span className="t-cap" style={{ fontSize: 11.5 }}>{runDayLabel(r.at)}</span>
                      </span>
                      <span className="t-cap" style={{ flex: "none" }}>{r.items.length} items</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
