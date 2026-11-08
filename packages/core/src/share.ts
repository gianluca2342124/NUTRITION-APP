import type { NutrientKey, NutrientValues } from './nutrients';
import type { FactorKey, FudyuScoreResult } from './score';

/** Nutrient behind each score reason (claims point to the same nutrient). */
const FACTOR_NUTRIENT: Partial<Record<FactorKey, NutrientKey>> = {
  sugars: 'sugars_g',
  low_sugars: 'sugars_g',
  saturated_fat: 'saturated_fat_g',
  saturated_fat_ratio: 'saturated_fat_g',
  low_saturated_fat: 'saturated_fat_g',
  salt: 'salt_g',
  low_salt: 'salt_g',
  energy: 'energy_kcal',
  fiber: 'fiber_g',
  protein: 'protein_g',
};

const FALLBACK: NutrientKey[] = ['energy_kcal', 'sugars_g', 'saturated_fat_g', 'salt_g', 'protein_g', 'fiber_g'];

/**
 * The three facts for a share card: the nutrients behind the score's main
 * reasons first, then energy, sugars, saturated fat, salt, protein, fibre.
 * Only known values (never "0" for unknown).
 */
export function shareFacts(nutrients: NutrientValues, score: FudyuScoreResult, max = 3): NutrientKey[] {
  const fromReasons = score.status === 'scored' ? score.factors.map((f) => FACTOR_NUTRIENT[f.key]).filter((k): k is NutrientKey => !!k) : [];
  const picked: NutrientKey[] = [];
  for (const key of [...fromReasons, ...FALLBACK]) {
    if (picked.length >= max) break;
    if (!picked.includes(key) && nutrients[key] != null) picked.push(key);
  }
  return picked;
}
