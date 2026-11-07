import { describe, expect, it } from 'vitest';
import { expandUpcE, isValidGtin, normalizeBarcode } from './gtin';
import { computeDailyTargets, minimumHealthyWeightKg, mifflinStJeor } from './targets';
import { normalizeAdditiveCode, parseAdditiveClasses } from './additives';
import { allergensFromOffTags } from './allergens';
import { validateLabelNutrition } from './label';
import { compareItems, type ComparableItem } from './compare';
import { nutrients } from './nutrients';
import { defaultMealForHour, addDays, dateRange } from './meals';

describe('gtin', () => {
  it('validates check digits', () => {
    expect(isValidGtin('3017624010701')).toBe(true);
    expect(isValidGtin('3017624010702')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true);
    expect(isValidGtin('12345')).toBe(false);
  });

  it('normalises UPC-A and GTIN-14 to EAN-13', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452');
    expect(normalizeBarcode('03017624010701')).toBe('3017624010701');
    expect(normalizeBarcode(' 3017-6240-10701 ')).toBe('3017624010701');
    expect(normalizeBarcode('3017624010702')).toBeNull();
  });

  it('expands UPC-E', () => {
    expect(expandUpcE('04252614')).toBe('042100005264');
    expect(normalizeBarcode('04252614', 'upc_e')).toBe('0042100005264');
  });
});

describe('daily targets', () => {
  const base = { sex: 'female' as const, ageYears: 30, heightCm: 165, weightKg: 62, activity: 'moderate' as const };

  it('uses Mifflin-St Jeor', () => {
    expect(mifflinStJeor(base)).toBeCloseTo(10 * 62 + 6.25 * 165 - 5 * 30 - 161, 6);
  });

  it('computes maintenance targets with macro split', () => {
    const t = computeDailyTargets(base, 'maintain_weight');
    expect(t.status).toBe('ok');
    // BMR 1340.25 kcal × 1.55 (moderate) = 2077.4 → rounded to 2080 kcal.
    expect(t.bmrKcal).toBe(1340);
    expect(t.energyKcal).toBe(2080);
    expect(t.fatG).toBe(69);
    expect(t.proteinG).toBe(62);
    expect(t.carbsG).toBe(303);
    expect(t.fiberG).toBe(25);
    expect((t.carbsG ?? 0) * 4 + (t.proteinG ?? 0) * 4 + (t.fatG ?? 0) * 9).toBeLessThanOrEqual(2090);
  });

  it('applies a moderate deficit but never below the floor', () => {
    const t = computeDailyTargets({ ...base, weightKg: 50, heightCm: 155, activity: 'sedentary', ageYears: 60 }, 'lose_weight');
    expect(t.energyKcal).toBeGreaterThanOrEqual(1200);
    expect(t.notes).toContain('energy_floor_applied');
  });

  it('never applies a deficit when BMI is under 18.5', () => {
    const t = computeDailyTargets({ ...base, weightKg: 48, heightCm: 170 }, 'lose_weight');
    expect(t.notes).toContain('deficit_skipped_low_bmi');
    expect(t.energyKcal).toBe(t.tdeeKcal != null ? Math.round(t.tdeeKcal / 10) * 10 : null);
  });

  it('refuses to compute energy targets for minors', () => {
    const t = computeDailyTargets({ ...base, ageYears: 16 }, 'lose_weight');
    expect(t.status).toBe('minor');
    expect(t.energyKcal).toBeNull();
  });

  it('reports insufficient data instead of guessing', () => {
    const t = computeDailyTargets({ sex: 'male', ageYears: 40 }, 'eat_balanced');
    expect(t.status).toBe('insufficient_data');
    expect(t.energyKcal).toBeNull();
  });

  it('uses a reference weight for protein when BMI > 25', () => {
    const t = computeDailyTargets({ ...base, weightKg: 100 }, 'build_muscle');
    expect(t.notes).toContain('protein_reference_weight_used');
    expect(t.proteinG).toBe(Math.round(25 * 1.65 * 1.65 * 1.6));
  });

  it('computes the minimum healthy target weight', () => {
    expect(minimumHealthyWeightKg(170)).toBe(53.5);
  });
});

describe('additives and allergens', () => {
  it('normalises additive codes', () => {
    expect(normalizeAdditiveCode('en:e322i')).toBe('e322i');
    expect(normalizeAdditiveCode('E 330')).toBe('e330');
    expect(normalizeAdditiveCode('E160a')).toBe('e160a');
    expect(normalizeAdditiveCode('en:sugar')).toBeNull();
  });

  it('parses additive classes', () => {
    expect(parseAdditiveClasses('en:antioxidant, en:emulsifier, en:unknown')).toEqual(['antioxidant', 'emulsifier']);
  });

  it('maps OFF allergen tags to EU allergen groups', () => {
    expect(allergensFromOffTags(['en:milk', 'en:sesame-seeds', 'en:other'])).toEqual(['milk', 'sesame']);
  });
});

describe('label validation', () => {
  const raw = {
    energy_kj: 2228,
    energy_kcal: 539,
    fat_g: 30.9,
    saturated_fat_g: 10.6,
    carbs_g: 57.5,
    sugars_g: 56.3,
    fiber_g: null,
    protein_g: 6.3,
    salt_g: 0.107,
    sodium_g: null,
  };

  it('accepts a consistent label', () => {
    const r = validateLabelNutrition(raw, '100g');
    expect(r.issues).toEqual([]);
    expect(r.nutrients.energy_kcal).toBe(539);
    expect(r.nutrients.fiber_g).toBeNull();
  });

  it('flags misread values', () => {
    const r = validateLabelNutrition({ ...raw, energy_kcal: 2228, sugars_g: 75 }, '100g');
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('kj_kcal_mismatch');
    expect(codes).toContain('sugars_exceed_carbs');
  });

  it('derives kcal and salt when only kJ and sodium are present', () => {
    const r = validateLabelNutrition({ ...raw, energy_kcal: null, salt_g: null, sodium_g: 0.4 }, '100g');
    expect(r.nutrients.energy_kcal).toBe(532.5);
    expect(r.nutrients.salt_g).toBe(1);
  });

  it('flags a missing energy value', () => {
    const r = validateLabelNutrition({ ...raw, energy_kcal: null, energy_kj: null }, '100g');
    expect(r.issues.map((i) => i.code)).toContain('missing_energy');
  });
});

describe('comparison', () => {
  const yogurtA: ComparableItem = {
    id: 'a',
    name: 'A',
    basis: '100g',
    nutrientsPer100: nutrients({ energy_kcal: 59, protein_g: 10.2, carbs_g: 3.6, sugars_g: 3.2, fat_g: 0.4, saturated_fat_g: 0.1, fiber_g: 0, salt_g: 0.09 }),
    categories: ['dairies', 'yogurts', 'greek-style-yogurts'],
    additives: [],
    novaGroup: 1,
    netQuantity: 500,
  };
  const yogurtB: ComparableItem = {
    ...yogurtA,
    id: 'b',
    name: 'B',
    nutrientsPer100: nutrients({ energy_kcal: 97, protein_g: 3.5, carbs_g: 13, sugars_g: 12.5, fat_g: 3, saturated_fat_g: 2, fiber_g: 0, salt_g: 0.1 }),
    categories: ['dairies', 'yogurts', 'flavoured-yogurts'],
    additives: ['e440', 'e330'],
    novaGroup: 4,
  };

  it('produces neutral pairwise statements ordered by goal', () => {
    const c = compareItems([yogurtA, yogurtB], 'increase_protein');
    expect(c.comparable).toBe(true);
    expect(c.issues).toEqual([]);
    expect(c.statements[0]).toMatchObject({ key: 'protein_g', moreIndex: 0 });
    expect(c.statements.find((s) => s.key === 'sugars_g')).toMatchObject({ moreIndex: 1 });
    expect(c.statements.find((s) => s.key === 'salt_g')).toBeUndefined();
    expect(c.additiveCounts).toEqual([0, 2]);
  });

  it('flags products that are not comparable', () => {
    const juice: ComparableItem = { ...yogurtB, id: 'c', basis: '100ml', categories: ['beverages', 'juices'] };
    const c = compareItems([yogurtA, juice]);
    expect(c.comparable).toBe(false);
    expect(c.issues).toContain('different_basis');
    expect(c.issues).toContain('different_category');
    expect(c.statements).toEqual([]);
  });
});

describe('meals and dates', () => {
  it('suggests meals for Spanish eating times', () => {
    expect(defaultMealForHour(8)).toBe('breakfast');
    expect(defaultMealForHour(14.5)).toBe('lunch');
    expect(defaultMealForHour(18)).toBe('snack');
    expect(defaultMealForHour(21.5)).toBe('dinner');
  });

  it('handles date arithmetic across month boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(dateRange('2026-11-01', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  });
});
