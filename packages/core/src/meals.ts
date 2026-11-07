export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const ENTRY_METHODS = ['photo', 'barcode', 'voice', 'text', 'search', 'label', 'recipe', 'copy', 'quick_add'] as const;
export type EntryMethod = (typeof ENTRY_METHODS)[number];

/**
 * Suggested meal for a local hour. Tuned to Spanish eating times (late lunch
 * and dinner); the user can always change it.
 */
export function defaultMealForHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 12.5 && hour < 16.5) return 'lunch';
  if (hour >= 19.5 || hour < 2) return 'dinner';
  return 'snack';
}

export function defaultMealForDate(date: Date): MealType {
  return defaultMealForHour(date.getHours() + date.getMinutes() / 60);
}

/** Local calendar date (YYYY-MM-DD) of a Date in the device's time zone. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(value: string, days: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

/** Inclusive list of dates from `start` to `end` (YYYY-MM-DD). */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}
