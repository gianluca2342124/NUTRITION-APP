import { z } from 'zod';
import {
  energyFromMacros,
  kjToKcal,
  nutrients,
  round,
  saltToSodium,
  sodiumToSalt,
  type NutrientValues,
} from './nutrients';
import type { Basis } from './products';

/**
 * Deterministic validation of nutrition data, used for label photos (OCR) and
 * for imported records. Checks never "fix" values silently: they produce
 * warnings that the UI shows next to the affected fields.
 */
export const LABEL_ISSUES = [
  'missing_energy',
  'kj_kcal_mismatch',
  'energy_macros_mismatch',
  'sugars_exceed_carbs',
  'saturates_exceed_fat',
  'salt_sodium_mismatch',
  'macros_exceed_basis',
  'value_out_of_range',
] as const;
export type LabelIssueCode = (typeof LABEL_ISSUES)[number];

export interface LabelIssue {
  code: LabelIssueCode;
  fields: string[];
}

/** Raw label values as read from packaging (all optional). */
export const LabelNutritionSchema = z.object({
  energy_kj: z.number().nonnegative().nullable(),
  energy_kcal: z.number().nonnegative().nullable(),
  fat_g: z.number().nonnegative().nullable(),
  saturated_fat_g: z.number().nonnegative().nullable(),
  carbs_g: z.number().nonnegative().nullable(),
  sugars_g: z.number().nonnegative().nullable(),
  fiber_g: z.number().nonnegative().nullable(),
  protein_g: z.number().nonnegative().nullable(),
  salt_g: z.number().nonnegative().nullable(),
  sodium_g: z.number().nonnegative().nullable(),
});
export type LabelNutrition = z.infer<typeof LabelNutritionSchema>;

/** Plausibility checks for per-100 values that apply to any data source. */
export function checkNutrientPlausibility(v: NutrientValues, basis: Basis): LabelIssue[] {
  const issues: LabelIssue[] = [];
  const grams = (['protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const)
    .map((k) => v[k] ?? 0)
    .reduce((a, b) => a + b, 0);
  if (basis === '100g' && grams + (v.salt_g ?? 0) > 102) {
    issues.push({ code: 'macros_exceed_basis', fields: ['protein_g', 'carbs_g', 'fat_g', 'fiber_g'] });
  }
  if (v.energy_kcal != null && v.energy_kcal > 900) {
    issues.push({ code: 'value_out_of_range', fields: ['energy_kcal'] });
  }
  if (v.sugars_g != null && v.carbs_g != null && v.sugars_g > v.carbs_g + 0.5) {
    issues.push({ code: 'sugars_exceed_carbs', fields: ['sugars_g', 'carbs_g'] });
  }
  if (v.saturated_fat_g != null && v.fat_g != null && v.saturated_fat_g > v.fat_g + 0.5) {
    issues.push({ code: 'saturates_exceed_fat', fields: ['saturated_fat_g', 'fat_g'] });
  }
  const estimated = energyFromMacros(v);
  if (v.energy_kcal != null && estimated != null && v.energy_kcal > 20) {
    const ratio = estimated / v.energy_kcal;
    // Wide tolerance: alcohol, polyols and rounding legitimately shift energy.
    if (ratio < 0.7 || ratio > 1.3) issues.push({ code: 'energy_macros_mismatch', fields: ['energy_kcal'] });
  }
  return issues;
}

export interface LabelValidation {
  /** Values resolved to the platform's nutrient set (kcal, salt). */
  nutrients: NutrientValues;
  issues: LabelIssue[];
}

export function validateLabelNutrition(raw: LabelNutrition, basis: Basis): LabelValidation {
  const issues: LabelIssue[] = [];

  let kcal = raw.energy_kcal;
  if (kcal == null && raw.energy_kj != null) kcal = round(kjToKcal(raw.energy_kj), 1);
  if (kcal == null) issues.push({ code: 'missing_energy', fields: ['energy_kcal', 'energy_kj'] });

  if (raw.energy_kcal != null && raw.energy_kj != null && raw.energy_kcal > 5) {
    const ratio = raw.energy_kj / raw.energy_kcal;
    if (ratio < 3.9 || ratio > 4.5) issues.push({ code: 'kj_kcal_mismatch', fields: ['energy_kj', 'energy_kcal'] });
  }

  let salt = raw.salt_g;
  if (salt == null && raw.sodium_g != null) salt = round(sodiumToSalt(raw.sodium_g), 3);
  if (raw.salt_g != null && raw.sodium_g != null && raw.salt_g > 0.05) {
    const expectedSodium = saltToSodium(raw.salt_g);
    if (Math.abs(expectedSodium - raw.sodium_g) > Math.max(0.05, expectedSodium * 0.15)) {
      issues.push({ code: 'salt_sodium_mismatch', fields: ['salt_g', 'sodium_g'] });
    }
  }

  const values = nutrients({
    energy_kcal: kcal ?? undefined,
    protein_g: raw.protein_g ?? undefined,
    carbs_g: raw.carbs_g ?? undefined,
    sugars_g: raw.sugars_g ?? undefined,
    fat_g: raw.fat_g ?? undefined,
    saturated_fat_g: raw.saturated_fat_g ?? undefined,
    fiber_g: raw.fiber_g ?? undefined,
    salt_g: salt ?? undefined,
  });

  for (const issue of checkNutrientPlausibility(values, basis)) {
    if (!issues.some((i) => i.code === issue.code)) issues.push(issue);
  }
  return { nutrients: values, issues };
}
