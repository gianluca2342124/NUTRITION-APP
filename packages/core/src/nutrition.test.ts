import { describe, expect, it } from 'vitest';
import {
  energyFromMacros,
  kjToKcal,
  nutrients,
  round,
  scaleNutrients,
  sodiumToSalt,
  sumNutrients,
} from './nutrients';
import { parseQuantity, toBase } from './units';
import { formatNutrient } from './format';
import { resolveAmount } from './foods';

describe('nutrients', () => {
  it('keeps unknown values as null instead of zero', () => {
    const v = nutrients({ energy_kcal: 100, protein_g: 0 });
    expect(v.energy_kcal).toBe(100);
    expect(v.protein_g).toBe(0);
    expect(v.fiber_g).toBeNull();
  });

  it('rejects negative and non-finite values', () => {
    const v = nutrients({ energy_kcal: -5, fat_g: Number.NaN });
    expect(v.energy_kcal).toBeNull();
    expect(v.fat_g).toBeNull();
  });

  it('scales per-100 values to a consumed amount', () => {
    const per100 = nutrients({ energy_kcal: 130, protein_g: 2.69, carbs_g: 28.17, fat_g: 0.28 });
    const portion = scaleNutrients(per100, 150);
    expect(portion.energy_kcal).toBe(195);
    expect(portion.protein_g).toBe(4.04);
    expect(portion.carbs_g).toBe(42.26);
    expect(portion.fiber_g).toBeNull();
  });

  it('throws on invalid amounts', () => {
    expect(() => scaleNutrients(nutrients({}), -1)).toThrow(RangeError);
  });

  it('sums items and flags incomplete totals', () => {
    const a = nutrients({ energy_kcal: 100, fiber_g: 2 });
    const b = nutrients({ energy_kcal: 50 });
    const totals = sumNutrients([a, b]);
    expect(totals.values.energy_kcal).toBe(150);
    expect(totals.values.fiber_g).toBe(2);
    expect(totals.incomplete).toEqual(['fiber_g']);
    expect(totals.values.protein_g).toBeNull();
  });

  it('converts energy and salt with regulatory factors', () => {
    expect(round(kjToKcal(2228))).toBe(533);
    expect(sodiumToSalt(0.4)).toBeCloseTo(1, 10);
    expect(energyFromMacros({ protein_g: 10, carbs_g: 20, fat_g: 5, fiber_g: 3 })).toBe(171);
  });
});

describe('units', () => {
  it.each([
    ['500 g', 500, 'g'],
    ['400.0 g', 400, 'g'],
    ['1,5 kg', 1500, 'g'],
    ['1.5L', 1500, 'ml'],
    ['75 cl', 750, 'ml'],
    ['6 x 125 g', 750, 'g'],
    ['2×1 L', 2000, 'ml'],
    ['330 ml', 330, 'ml'],
  ])('parses %s', (text, total, base) => {
    const q = parseQuantity(text);
    expect(q?.total).toBeCloseTo(total, 6);
    expect(q?.base).toBe(base);
  });

  it('returns null for ambiguous quantities', () => {
    expect(parseQuantity('1 pack')).toBeNull();
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity(null)).toBeNull();
  });

  it('converts imperial units', () => {
    expect(toBase(1, 'oz').amount).toBeCloseTo(28.35, 2);
  });
});

describe('amount resolution', () => {
  const portions = [{ id: 'large', labelEs: '1 grande', labelEn: '1 large', grams: 50 }];
  it('resolves grams, servings and portions without guessing', () => {
    expect(resolveAmount({ quantity: 120, unit: 'g' }, { basis: '100g' })).toBe(120);
    expect(resolveAmount({ quantity: 2, unit: 'portion', portionId: 'large' }, { basis: '100g', portions })).toBe(100);
    expect(resolveAmount({ quantity: 1, unit: 'serving' }, { basis: '100g', servingQuantity: 30 })).toBe(30);
    expect(resolveAmount({ quantity: 1, unit: 'serving' }, { basis: '100g', servingQuantity: null })).toBeNull();
    expect(resolveAmount({ quantity: 200, unit: 'ml' }, { basis: '100g' })).toBeNull();
  });
});

describe('formatting', () => {
  it('formats nutrients with locale-aware decimals', () => {
    expect(formatNutrient('energy_kcal', 539.4, 'es')).toBe('539 kcal');
    expect(formatNutrient('protein_g', 6.34, 'es')).toBe('6,3 g');
    expect(formatNutrient('protein_g', 6.34, 'en')).toBe('6.3 g');
    expect(formatNutrient('fat_g', 30.9, 'en')).toBe('31 g');
    expect(formatNutrient('salt_g', 0.1075, 'en')).toBe('0.11 g');
    expect(formatNutrient('sugars_g', 0.04, 'en')).toBe('<0.1 g');
    expect(formatNutrient('fiber_g', null, 'en')).toBe('—');
  });
});
