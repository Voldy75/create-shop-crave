import type {
  ActivityLevel,
  MealLog,
  NutritionGoals,
  NutritionProfile,
  WeightGoal,
} from "./types";

export interface Totals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const EMPTY_TOTALS: Totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function sumLogs(logs: MealLog[]): Totals {
  return logs.reduce<Totals>(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein: acc.protein + (l.protein || 0),
      carbs: acc.carbs + (l.carbs || 0),
      fat: acc.fat + (l.fat || 0),
    }),
    { ...EMPTY_TOTALS },
  );
}

export function dayTotals(logs: MealLog[], date: string): Totals {
  return sumLogs(logs.filter((l) => l.date === date));
}

export function logsByDay(logs: MealLog[], dates: string[]): Record<string, Totals> {
  const map: Record<string, Totals> = {};
  for (const d of dates) map[d] = { ...EMPTY_TOTALS };
  for (const l of logs) {
    if (map[l.date]) {
      map[l.date].calories += l.calories || 0;
      map[l.date].protein += l.protein || 0;
      map[l.date].carbs += l.carbs || 0;
      map[l.date].fat += l.fat || 0;
    }
  }
  return map;
}

/**
 * Local-timezone YYYY-MM-DD. Avoids UTC drift near midnight (rate-limit uses UTC,
 * but meal "date" should match the user's calendar day).
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function lastNDates(n: number, end: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(localDateKey(d));
  }
  return out;
}

/**
 * 42-cell month grid (6 weeks × 7 days), Monday-first.
 * Includes trailing days from previous month and leading from next month so
 * the calendar always renders as a clean rectangle.
 */
export interface CalendarCell {
  date: string;       // YYYY-MM-DD
  inMonth: boolean;   // false for leading/trailing greyed cells
  isToday: boolean;
}

export function monthGrid(year: number, month: number /* 0-11 */, today: Date = new Date()): CalendarCell[] {
  const first = new Date(year, month, 1);
  // Monday = 0, Sunday = 6 (cf. WeeklyChart uses Sun=0, but the planner already
  // standardized on Mon-first via DAYS in app/planner/page.tsx)
  const firstDow = (first.getDay() + 6) % 7;
  const todayKey = localDateKey(today);
  const cells: CalendarCell[] = [];
  // Leading cells from previous month
  for (let i = firstDow; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    cells.push({ date: localDateKey(d), inMonth: false, isToday: localDateKey(d) === todayKey });
  }
  // Days in this month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    cells.push({ date: localDateKey(d), inMonth: true, isToday: localDateKey(d) === todayKey });
  }
  // Trailing cells to fill 42 (6 weeks)
  while (cells.length < 42) {
    const i = cells.length - (firstDow + daysInMonth) + 1;
    const d = new Date(year, month + 1, i);
    cells.push({ date: localDateKey(d), inMonth: false, isToday: localDateKey(d) === todayKey });
  }
  return cells;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_DELTA: Record<WeightGoal, number> = {
  lose: -500,
  maintain: 0,
  gain: 400,
};

/**
 * Mifflin–St Jeor BMR -> TDEE -> goal-adjusted daily calorie target.
 * Returns null if any required field is missing.
 */
export function computeDailyCalories(profile: NutritionProfile): number | null {
  const { sex, age, heightCm, weightKg, activity, goal } = profile;
  if (!sex || !age || !heightCm || !weightKg || !activity || !goal) return null;
  const sexOffset = sex === "male" ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  const tdee = bmr * ACTIVITY_MULTIPLIER[activity];
  const target = tdee + GOAL_DELTA[goal];
  return Math.max(1200, Math.round(target / 10) * 10);
}

/**
 * Default macro split: 30% protein, 45% carbs, 25% fat.
 * Protein/carbs at 4 kcal/g, fat at 9 kcal/g.
 */
export function computeMacros(dailyCalories: number): Pick<NutritionGoals, "protein" | "carbs" | "fat"> {
  return {
    protein: Math.round((dailyCalories * 0.3) / 4),
    carbs: Math.round((dailyCalories * 0.45) / 4),
    fat: Math.round((dailyCalories * 0.25) / 9),
  };
}

export function defaultGoalsFromProfile(profile: NutritionProfile): NutritionGoals | null {
  const dailyCalories = computeDailyCalories(profile);
  if (!dailyCalories || !profile.goal) return null;
  return {
    dailyCalories,
    ...computeMacros(dailyCalories),
    goal: profile.goal,
    profile,
  };
}

/**
 * Parse a nutrition string like "~450 kcal" or "20g" into a number.
 * Returns 0 if no number found.
 */
export function parseNumeric(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Math.round(parseFloat(match[0])) : 0;
}

export function pctOf(value: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}
