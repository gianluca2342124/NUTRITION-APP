import { z } from 'zod';
import type { NutrientValues } from './nutrients';

/**
 * Nutri-Score, 2023 algorithm (solid foods update 2022 and beverages update
 * 2023, Scientific Committee of the Nutri-Score). Implemented from the
 * published point tables and validated against Open Food Facts' own
 * computation on real products (see nutriscore.test.ts).
 *
 * Category flags, the fruit/vegetable/legume share and the sweetener count
 * come from the product source (Open Food Facts); every nutrient value comes
 * from the catalogue row. Nothing is estimated here.
 */

export const NUTRISCORE_CATEGORIES = ['general', 'cheese', 'red_meat', 'fats_oils_nuts_seeds', 'beverage', 'water'] as const;
export type NutriScoreCategory = (typeof NUTRISCORE_CATEGORIES)[number];
export type NutriScoreGrade = 'a' | 'b' | 'c' | 'd' | 'e';

export const NutriScoreInputsSchema = z.object({
  version: z.literal('2023'),
  /** False when the Nutri-Score does not apply (e.g. alcohol, baby food, herbs). */
  applicable: z.boolean(),
  notApplicableReason: z.string().nullable(),
  /** Null when the source could not determine the category. */
  category: z.enum(NUTRISCORE_CATEGORIES).nullable(),
  /** Fruits, vegetables and legumes (%), estimated by the source from the ingredients. */
  fvlPercent: z.number().min(0).max(100).nullable(),
  /** Number of non-nutritive sweeteners (beverages). */
  sweeteners: z.number().int().min(0).nullable(),
  /** Declared energy (kJ per 100 g/ml), used instead of converting kcal. */
  energyKj: z.number().min(0).nullable(),
  /** The source's own result, kept for audit and regression checks. */
  reference: z.object({ score: z.number(), grade: z.enum(['a', 'b', 'c', 'd', 'e']) }).nullable(),
});
export type NutriScoreInputs = z.infer<typeof NutriScoreInputsSchema>;

export type NutriScoreComponentId =
  | 'energy'
  | 'energy_from_saturated_fat'
  | 'sugars'
  | 'saturated_fat'
  | 'saturated_fat_ratio'
  | 'salt'
  | 'non_nutritive_sweeteners'
  | 'proteins'
  | 'fiber'
  | 'fruits_vegetables_legumes';

export interface NutriScoreComponent {
  id: NutriScoreComponentId;
  kind: 'negative' | 'positive';
  /** Value used (unit: kJ, g, % or count); null when unknown (scores 0 points). */
  value: number | null;
  unit: 'kJ' | 'g' | '%' | 'count';
  points: number;
  max: number;
  /** False for protein points excluded by the algorithm's rules. */
  counted: boolean;
}

export type NutriScoreResult =
  | { status: 'computed'; category: NutriScoreCategory; score: number; grade: NutriScoreGrade; components: NutriScoreComponent[] }
  | { status: 'not_applicable'; reason: string | null }
  | { status: 'unknown_category' }
  | { status: 'missing_nutrients'; missing: ('energy' | 'sugars' | 'saturated_fat' | 'salt' | 'fat')[] };

/* ------------------------------- point tables ------------------------------ */

const range = (start: number, step: number, n: number) => Array.from({ length: n }, (_, i) => Math.round((start + i * step) * 1000) / 1000);

const T = {
  energy: range(335, 335, 10),
  saturatedFat: range(1, 1, 10),
  sugars: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],
  salt: range(0.2, 0.2, 20),
  proteins: [2.4, 4.8, 7.2, 9.6, 12, 14, 17],
  fiber: [3.0, 4.1, 5.2, 6.3, 7.4],
  energyFromSaturates: range(120, 120, 10),
  saturatedRatio: [10, 16, 22, 28, 34, 40, 46, 52, 58, 64],
  beverageEnergy: [30, 90, 150, 210, 240, 270, 300, 330, 360, 390],
  beverageSugars: [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11],
  beverageProteins: [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0],
};

/** Rounds away binary noise (e.g. sodium × 2.5) before comparing with thresholds. */
const clean = (v: number) => Math.round(v * 10_000) / 10_000;

/** Points = number of thresholds strictly exceeded. */
function above(value: number | null, thresholds: number[]): number {
  if (value == null) return 0;
  const v = clean(value);
  return thresholds.filter((t) => v > t).length;
}

/** Points = number of thresholds reached (used by the saturated-fat ratio: "< 10 % → 0"). */
function atLeast(value: number | null, thresholds: number[]): number {
  if (value == null) return 0;
  const v = clean(value);
  return thresholds.filter((t) => v >= t).length;
}

function fvlPoints(percent: number | null, beverage: boolean): number {
  if (percent == null) return 0;
  const p = clean(percent);
  if (beverage) return p > 80 ? 6 : p > 60 ? 4 : p > 40 ? 2 : 0;
  return p > 80 ? 5 : p > 60 ? 2 : p > 40 ? 1 : 0;
}

export function nutriScoreGrade(score: number, category: NutriScoreCategory): NutriScoreGrade {
  if (category === 'water') return 'a';
  if (category === 'beverage') return score <= 2 ? 'b' : score <= 6 ? 'c' : score <= 9 ? 'd' : 'e';
  const aMax = category === 'fats_oils_nuts_seeds' ? -6 : 0;
  return score <= aMax ? 'a' : score <= 2 ? 'b' : score <= 10 ? 'c' : score <= 18 ? 'd' : 'e';
}

/**
 * Computes the Nutri-Score 2023 from per-100 g/ml values. Missing fibre,
 * protein or fruit/vegetable data score 0 points (never inflating the result);
 * missing energy, sugars, saturated fat or salt make the score unavailable.
 */
export function computeNutriScore2023(nutrients: NutrientValues, inputs: NutriScoreInputs | null): NutriScoreResult {
  if (!inputs) return { status: 'unknown_category' };
  if (!inputs.applicable) return { status: 'not_applicable', reason: inputs.notApplicableReason };
  const category = inputs.category;
  if (!category) return { status: 'unknown_category' };

  const fats = category === 'fats_oils_nuts_seeds';
  const beverage = category === 'beverage' || category === 'water';
  const missing: ('energy' | 'sugars' | 'saturated_fat' | 'salt' | 'fat')[] = [];
  const energyKj = inputs.energyKj ?? (nutrients.energy_kcal == null ? null : nutrients.energy_kcal * 4.184);
  if (energyKj == null && !fats) missing.push('energy');
  if (nutrients.sugars_g == null) missing.push('sugars');
  if (nutrients.saturated_fat_g == null) missing.push('saturated_fat');
  if (nutrients.salt_g == null) missing.push('salt');
  if (fats && nutrients.fat_g == null) missing.push('fat');
  if (missing.length > 0 && category !== 'water') return { status: 'missing_nutrients', missing };

  const sat = nutrients.saturated_fat_g;
  const negatives: NutriScoreComponent[] = [];
  if (fats) {
    const fromSat = sat == null ? null : Math.round(sat * 37 * 10) / 10;
    const ratio = sat == null || nutrients.fat_g == null ? null : nutrients.fat_g > 0 ? Math.round((sat / nutrients.fat_g) * 1000) / 10 : 0;
    negatives.push(
      { id: 'energy_from_saturated_fat', kind: 'negative', value: fromSat, unit: 'kJ', points: above(fromSat, T.energyFromSaturates), max: 10, counted: true },
      { id: 'sugars', kind: 'negative', value: nutrients.sugars_g, unit: 'g', points: above(nutrients.sugars_g, T.sugars), max: 15, counted: true },
      { id: 'saturated_fat_ratio', kind: 'negative', value: ratio, unit: '%', points: atLeast(ratio, T.saturatedRatio), max: 10, counted: true },
    );
  } else if (beverage) {
    negatives.push(
      { id: 'energy', kind: 'negative', value: energyKj, unit: 'kJ', points: above(energyKj, T.beverageEnergy), max: 10, counted: true },
      { id: 'sugars', kind: 'negative', value: nutrients.sugars_g, unit: 'g', points: above(nutrients.sugars_g, T.beverageSugars), max: 10, counted: true },
      { id: 'saturated_fat', kind: 'negative', value: sat, unit: 'g', points: above(sat, T.saturatedFat), max: 10, counted: true },
    );
  } else {
    negatives.push(
      { id: 'energy', kind: 'negative', value: energyKj, unit: 'kJ', points: above(energyKj, T.energy), max: 10, counted: true },
      { id: 'sugars', kind: 'negative', value: nutrients.sugars_g, unit: 'g', points: above(nutrients.sugars_g, T.sugars), max: 15, counted: true },
      { id: 'saturated_fat', kind: 'negative', value: sat, unit: 'g', points: above(sat, T.saturatedFat), max: 10, counted: true },
    );
  }
  negatives.push({ id: 'salt', kind: 'negative', value: nutrients.salt_g, unit: 'g', points: above(nutrients.salt_g, T.salt), max: 20, counted: true });
  if (beverage) {
    const n = inputs.sweeteners;
    negatives.push({ id: 'non_nutritive_sweeteners', kind: 'negative', value: n, unit: 'count', points: n && n > 0 ? 4 : 0, max: 4, counted: true });
  }

  const negativePoints = negatives.reduce((s, c) => s + c.points, 0);
  let proteinPoints = above(nutrients.protein_g, beverage ? T.beverageProteins : T.proteins);
  if (category === 'red_meat') proteinPoints = Math.min(proteinPoints, 2);
  const proteinCounted = beverage || category === 'cheese' || negativePoints < (fats ? 7 : 11);

  const positives: NutriScoreComponent[] = [
    { id: 'proteins', kind: 'positive', value: nutrients.protein_g, unit: 'g', points: proteinPoints, max: 7, counted: proteinCounted },
    { id: 'fiber', kind: 'positive', value: nutrients.fiber_g, unit: 'g', points: above(nutrients.fiber_g, T.fiber), max: 5, counted: true },
    {
      id: 'fruits_vegetables_legumes',
      kind: 'positive',
      value: inputs.fvlPercent,
      unit: '%',
      points: fvlPoints(inputs.fvlPercent, beverage),
      max: beverage ? 6 : 5,
      counted: true,
    },
  ];
  const positivePoints = positives.filter((c) => c.counted).reduce((s, c) => s + c.points, 0);
  const score = category === 'water' ? 0 : negativePoints - positivePoints;
  return { status: 'computed', category, score, grade: nutriScoreGrade(score, category), components: [...negatives, ...positives] };
}
