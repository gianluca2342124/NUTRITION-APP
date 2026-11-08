import { addDays, parseLocalDate } from './meals';

/**
 * Streak rules (mirrored by public.streak_chains / record_activity in SQL):
 * - a day counts when the user did at least one eligible action that day
 *   (local date);
 * - consecutive active days may be at most two calendar days apart: one
 *   missed day is forgiven, two in a row end the streak;
 * - the streak counts active days, never calendar days.
 */
export const STREAK_GRACE_DAYS = 1;

export const ACTIVITY_KINDS = ['meal_logged', 'product_analyzed', 'comparison', 'recipe_completed', 'ingredient_explored'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACHIEVEMENT_IDS = [
  'first_scan',
  'food_explorer',
  'smart_choices',
  'recipe_discoverer',
  'weekly_explorer',
  'food_curious',
  'consistency',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

/** Requirement of each achievement (shown as progress; enforced in SQL). */
export const ACHIEVEMENT_RULES: Record<AchievementId, { metric: 'products' | 'comparisons' | 'recipes' | 'ingredients' | 'streak' | 'activeDays'; target: number }> = {
  first_scan: { metric: 'products', target: 1 },
  food_explorer: { metric: 'products', target: 10 },
  smart_choices: { metric: 'comparisons', target: 5 },
  recipe_discoverer: { metric: 'recipes', target: 1 },
  weekly_explorer: { metric: 'streak', target: 7 },
  food_curious: { metric: 'ingredients', target: 1 },
  consistency: { metric: 'activeDays', target: 30 },
};

export interface StreakSummary {
  /** Active days in the current chain (0 when the chain has ended). */
  current: number;
  longest: number;
  lastActiveDate: string | null;
  /** True when today already counts. */
  activeToday: boolean;
  /** True when the chain is still alive but today has no activity yet. */
  atRisk: boolean;
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86_400_000);
}

/** Computes the streak from the user's activity days (any order, duplicates allowed). */
export function computeStreak(activeDays: readonly string[], today: string, graceDays: number = STREAK_GRACE_DAYS): StreakSummary {
  const days = [...new Set(activeDays)].sort();
  if (days.length === 0) return { current: 0, longest: 0, lastActiveDate: null, activeToday: false, atRisk: false };
  const maxGap = graceDays + 1;
  let longest = 1;
  let chain = 1;
  for (let i = 1; i < days.length; i++) {
    chain = daysBetween(days[i - 1]!, days[i]!) <= maxGap ? chain + 1 : 1;
    longest = Math.max(longest, chain);
  }
  const last = days[days.length - 1]!;
  const sinceLast = daysBetween(last, today);
  const alive = sinceLast <= maxGap;
  return {
    current: alive ? chain : 0,
    longest,
    lastActiveDate: last,
    activeToday: sinceLast <= 0,
    atRisk: alive && sinceLast > 0,
  };
}

/** Monday-first week containing `date` (7 local dates). */
export function weekDays(date: string): string[] {
  const d = parseLocalDate(date);
  const offset = (d.getDay() + 6) % 7;
  const monday = addDays(date, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Last `weeks` full weeks ending with the week of `today` (Monday-first). */
export function calendarWeeks(today: string, weeks: number): string[][] {
  const current = weekDays(today);
  return Array.from({ length: weeks }, (_, w) => current.map((d) => addDays(d, -7 * (weeks - 1 - w))));
}

