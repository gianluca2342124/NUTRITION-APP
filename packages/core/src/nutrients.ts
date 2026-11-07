import { z } from 'zod';

/**
 * Core nutrients tracked across the platform. Values are always expressed per
 * basis (100 g / 100 ml) or per consumed amount. `null` means UNKNOWN and must
 * never be silently treated as zero.
 */
export const NUTRIENT_KEYS = [
  'energy_kcal',
  'protein_g',
  'carbs_g',
  'sugars_g',
  'fat_g',
  'saturated_fat_g',
  'fiber_g',
  'salt_g',
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type NutrientValues = { [K in NutrientKey]: number | null };

export const MACRO_KEYS = ['protein_g', 'carbs_g', 'fat_g'] as const satisfies readonly NutrientKey[];

export const NUTRIENT_META: Record<NutrientKey, { unit: 'kcal' | 'g'; parent?: NutrientKey }> = {
  energy_kcal: { unit: 'kcal' },
  protein_g: { unit: 'g' },
  carbs_g: { unit: 'g' },
  sugars_g: { unit: 'g', parent: 'carbs_g' },
  fat_g: { unit: 'g' },
  saturated_fat_g: { unit: 'g', parent: 'fat_g' },
  fiber_g: { unit: 'g' },
  salt_g: { unit: 'g' },
};

const nullableNumber = z.number().finite().nonnegative().nullable();

export const NutrientValuesSchema = z.object({
  energy_kcal: nullableNumber,
  protein_g: nullableNumber,
  carbs_g: nullableNumber,
  sugars_g: nullableNumber,
  fat_g: nullableNumber,
  saturated_fat_g: nullableNumber,
  fiber_g: nullableNumber,
  salt_g: nullableNumber,
});

export const EMPTY_NUTRIENTS: Readonly<NutrientValues> = Object.freeze({
  energy_kcal: null,
  protein_g: null,
  carbs_g: null,
  sugars_g: null,
  fat_g: null,
  saturated_fat_g: null,
  fiber_g: null,
  salt_g: null,
});

/** Builds a full NutrientValues object; missing keys become `null` (unknown). */
export function nutrients(partial: Partial<NutrientValues>): NutrientValues {
  const out = { ...EMPTY_NUTRIENTS } as NutrientValues;
  for (const key of NUTRIENT_KEYS) {
    const v = partial[key];
    out[key] = typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  }
  return out;
}

/** Round half away from zero to `decimals` places. */
export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return (Math.sign(value) * Math.round(Math.abs(value) * f)) / f;
}

/**
 * Scales per-100 values to an amount in grams or millilitres.
 * Unknown values stay unknown.
 */
export function scaleNutrients(per100: NutrientValues, amount: number): NutrientValues {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`Invalid amount: ${amount}`);
  }
  const out = { ...EMPTY_NUTRIENTS } as NutrientValues;
  for (const key of NUTRIENT_KEYS) {
    const v = per100[key];
    out[key] = v == null ? null : round((v * amount) / 100, 2);
  }
  return out;
}

export interface NutrientTotals {
  /** Sum of the known values. `null` only when no item reported the nutrient. */
  values: NutrientValues;
  /** Nutrients for which at least one item is unknown (the total is a lower bound). */
  incomplete: NutrientKey[];
  itemCount: number;
}

export function sumNutrients(list: readonly NutrientValues[]): NutrientTotals {
  const values = { ...EMPTY_NUTRIENTS } as NutrientValues;
  const incomplete: NutrientKey[] = [];
  for (const key of NUTRIENT_KEYS) {
    let sum = 0;
    let known = 0;
    for (const item of list) {
      const v = item[key];
      if (v == null) continue;
      sum += v;
      known += 1;
    }
    values[key] = known === 0 ? null : round(sum, 2);
    if (known > 0 && known < list.length) incomplete.push(key);
  }
  return { values, incomplete, itemCount: list.length };
}

/** kJ → kcal using the EU/FAO factor 1 kcal = 4.184 kJ. */
export const kjToKcal = (kj: number): number => kj / 4.184;
export const kcalToKj = (kcal: number): number => kcal * 4.184;

/** EU Regulation 1169/2011, Annex I(11): salt = sodium × 2.5. */
export const sodiumToSalt = (sodiumG: number): number => sodiumG * 2.5;
export const saltToSodium = (saltG: number): number => saltG / 2.5;

/**
 * Energy estimated from macronutrients with the EU conversion factors
 * (Reg. 1169/2011 Annex XIV): protein 4, carbohydrate 4, fat 9, fibre 2 kcal/g.
 * Used only for plausibility checks, never to replace declared energy.
 */
export function energyFromMacros(v: Pick<NutrientValues, 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g'>): number | null {
  if (v.protein_g == null || v.carbs_g == null || v.fat_g == null) return null;
  return v.protein_g * 4 + v.carbs_g * 4 + v.fat_g * 9 + (v.fiber_g ?? 0) * 2;
}
