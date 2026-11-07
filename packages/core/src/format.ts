import type { NutrientKey } from './nutrients';
import { NUTRIENT_META } from './nutrients';

const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, maxFractionDigits: number, minFractionDigits = 0): Intl.NumberFormat {
  const key = `${locale}|${maxFractionDigits}|${minFractionDigits}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      maximumFractionDigits: maxFractionDigits,
      minimumFractionDigits: minFractionDigits,
    });
    cache.set(key, f);
  }
  return f;
}

export function formatNumber(value: number, locale: string, maxFractionDigits = 0): string {
  return formatter(locale, maxFractionDigits).format(value);
}

/** Number of decimals used to display a nutrient amount. */
export function nutrientDecimals(key: NutrientKey, value: number): number {
  if (key === 'energy_kcal') return 0;
  if (key === 'salt_g') return value < 1 ? 2 : 1;
  return value < 10 ? 1 : 0;
}

/**
 * Formats a nutrient value for display. Unknown values return the provided
 * placeholder; trace amounts are shown as "<0.1".
 */
export function formatNutrient(
  key: NutrientKey,
  value: number | null | undefined,
  locale: string,
  opts: { withUnit?: boolean; unknown?: string } = {},
): string {
  const { withUnit = true, unknown = '—' } = opts;
  if (value == null) return unknown;
  const unit = NUTRIENT_META[key].unit;
  const suffix = withUnit ? (unit === 'kcal' ? ' kcal' : ' g') : '';
  if (key !== 'energy_kcal' && value > 0 && value < (key === 'salt_g' ? 0.01 : 0.1)) {
    return `<${formatNumber(key === 'salt_g' ? 0.01 : 0.1, locale, 2)}${suffix}`;
  }
  return `${formatNumber(value, locale, nutrientDecimals(key, value))}${suffix}`;
}

export function formatGrams(value: number, locale: string, unit: 'g' | 'ml' = 'g'): string {
  return `${formatNumber(value, locale, value < 10 ? 1 : 0)} ${unit}`;
}
