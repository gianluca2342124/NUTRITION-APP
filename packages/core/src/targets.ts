import { z } from 'zod';
import { round } from './nutrients';

/**
 * Daily target estimation (methodology v1).
 *
 * - Resting energy: Mifflin-St Jeor (1990). For "unspecified" sex the midpoint
 *   of both sex constants is used (−78).
 * - Total energy: resting energy × activity factor (1.2 – 1.9).
 * - Goals adjust energy moderately (−15 % / +5 % / +10 %), never below a floor
 *   of max(resting energy, 1200 kcal) and never with a deficit when BMI < 18.5.
 * - Protein: g/kg of a reference weight (actual weight, or weight at BMI 25 when
 *   BMI > 25). Fat: 30 % of energy (EFSA reference intake range 20–35 %).
 *   Carbohydrate: remaining energy. Fibre: 25 g (EFSA adequate intake, adults).
 *
 * Targets are estimates for healthy adults and are always editable. The app is
 * not designed for minors, pregnancy or medical nutrition therapy.
 */

export const SEXES = ['female', 'male', 'unspecified'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const GOALS = [
  'eat_balanced',
  'understand_food',
  'gain_weight',
  'lose_weight',
  'maintain_weight',
  'build_muscle',
  'increase_protein',
  'organize_meals',
  'compare_products',
  'learn_nutrition',
] as const;
export type Goal = (typeof GOALS)[number];

export const ADULT_MIN_AGE = 18;
export const METHOD_VERSION = 'mifflin_st_jeor_v1';

export const BodyInputsSchema = z.object({
  sex: z.enum(SEXES),
  ageYears: z.number().int().min(ADULT_MIN_AGE).max(110),
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(300),
  activity: z.enum(ACTIVITY_LEVELS),
});
export type BodyInputs = z.infer<typeof BodyInputsSchema>;

export type TargetNote =
  | 'deficit_skipped_low_bmi'
  | 'energy_floor_applied'
  | 'protein_reference_weight_used'
  | 'goal_without_energy_change';

export interface DailyTargets {
  status: 'ok' | 'insufficient_data' | 'minor';
  method: typeof METHOD_VERSION;
  bmrKcal: number | null;
  tdeeKcal: number | null;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  notes: TargetNote[];
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function mifflinStJeor({ sex, ageYears, heightCm, weightKg }: Omit<BodyInputs, 'activity'>): number {
  const sexConstant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexConstant;
}

const GOAL_ENERGY_FACTOR: Partial<Record<Goal, number>> = {
  lose_weight: 0.85,
  gain_weight: 1.1,
  build_muscle: 1.05,
};

const PROTEIN_G_PER_KG: Partial<Record<Goal, number>> = {
  lose_weight: 1.4,
  build_muscle: 1.6,
  increase_protein: 1.6,
};
const DEFAULT_PROTEIN_G_PER_KG = 1.0;
const FAT_ENERGY_SHARE = 0.3;
const FIBER_G = 25;
const ABSOLUTE_ENERGY_FLOOR = 1200;

const EMPTY: Omit<DailyTargets, 'status'> = {
  method: METHOD_VERSION,
  bmrKcal: null,
  tdeeKcal: null,
  energyKcal: null,
  proteinG: null,
  carbsG: null,
  fatG: null,
  fiberG: FIBER_G,
  notes: [],
};

/**
 * Computes daily targets. Returns `insufficient_data` (fibre only) when body
 * data is missing or out of the supported adult range, and `minor` for users
 * under 18 (no energy targets are produced).
 */
export function computeDailyTargets(input: Partial<BodyInputs>, goal: Goal): DailyTargets {
  if (typeof input.ageYears === 'number' && input.ageYears < ADULT_MIN_AGE) {
    return { ...EMPTY, fiberG: null, status: 'minor' };
  }
  const parsed = BodyInputsSchema.safeParse(input);
  if (!parsed.success) return { ...EMPTY, status: 'insufficient_data' };
  const body = parsed.data;
  const notes: TargetNote[] = [];

  const bmr = mifflinStJeor(body);
  const tdee = bmr * ACTIVITY_FACTORS[body.activity];
  const bodyMassIndex = bmi(body.weightKg, body.heightCm);

  let factor = GOAL_ENERGY_FACTOR[goal] ?? 1;
  if (factor < 1 && bodyMassIndex < 18.5) {
    factor = 1;
    notes.push('deficit_skipped_low_bmi');
  }
  if (GOAL_ENERGY_FACTOR[goal] === undefined && goal !== 'maintain_weight') {
    notes.push('goal_without_energy_change');
  }

  let energy = tdee * factor;
  const floor = Math.max(bmr, ABSOLUTE_ENERGY_FLOOR);
  if (factor < 1 && energy < floor) {
    energy = Math.min(floor, tdee);
    notes.push('energy_floor_applied');
  }

  let referenceWeight = body.weightKg;
  if (bodyMassIndex > 25) {
    const m = body.heightCm / 100;
    referenceWeight = 25 * m * m;
    notes.push('protein_reference_weight_used');
  }
  const proteinPerKg = PROTEIN_G_PER_KG[goal] ?? DEFAULT_PROTEIN_G_PER_KG;
  const energyKcal = round(energy / 10) * 10;
  const proteinG = round(referenceWeight * proteinPerKg);
  const fatG = round((energyKcal * FAT_ENERGY_SHARE) / 9);
  const carbsG = Math.max(0, round((energyKcal - proteinG * 4 - fatG * 9) / 4));

  return {
    status: 'ok',
    method: METHOD_VERSION,
    bmrKcal: round(bmr),
    tdeeKcal: round(tdee),
    energyKcal,
    proteinG,
    carbsG,
    fatG,
    fiberG: FIBER_G,
    notes,
  };
}

/** Lowest healthy target weight we accept as a goal (BMI 18.5). */
export function minimumHealthyWeightKg(heightCm: number): number {
  const m = heightCm / 100;
  return round(18.5 * m * m, 1);
}
