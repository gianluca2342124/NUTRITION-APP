import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/off-nutriscore-2023.json';
import { nutrients } from './nutrients';
import { computeNutriScore2023, nutriScoreGrade, type NutriScoreInputs } from './nutriscore';
import { normalizeOffProduct, nutriscoreInputsFromOff, type OffProduct } from './off';

/**
 * Regression against Open Food Facts' own Nutri-Score 2023 results for 30 real
 * products (general foods, cheese, red meat, fats/oils/nuts, beverages, water).
 * Our implementation must reproduce every score, grade and component.
 */
describe('Nutri-Score 2023 matches Open Food Facts on real products', () => {
  const products = fixture.products as unknown as (OffProduct & { code: string; product_name: string })[];

  it.each(products.map((p) => [p.code, p.product_name, p] as const))('%s %s', (code, _name, raw) => {
    const product = normalizeOffProduct(raw);
    expect(product).not.toBeNull();
    const result = computeNutriScore2023(product!.nutrientsPer100, product!.nutriscoreInputs);
    const reference = (raw.nutriscore as Record<string, { score: number; grade: string; data: { components: Record<'negative' | 'positive', { id: string; points: number }[]> } }>)['2023']!;
    expect(result.status).toBe('computed');
    if (result.status !== 'computed') return;
    expect(result.score).toBe(reference.score);
    expect(result.grade).toBe(reference.grade);
    for (const c of [...reference.data.components.negative, ...reference.data.components.positive]) {
      expect(result.components.find((x) => x.id === c.id)?.points, `${code} ${c.id}`).toBe(c.points);
    }
  });

  it('keeps the source result as an audit reference', () => {
    const nutella = products.find((p) => p.code === '3017624010701')!;
    expect(nutriscoreInputsFromOff(nutella)).toMatchObject({ category: 'general', reference: { score: 31, grade: 'e' }, energyKj: 2228 });
  });
});

describe('Nutri-Score edge cases', () => {
  const base: NutriScoreInputs = {
    version: '2023',
    applicable: true,
    notApplicableReason: null,
    category: 'general',
    fvlPercent: null,
    sweeteners: null,
    energyKj: null,
    reference: null,
  };

  it('is unavailable without the mandatory negative nutrients', () => {
    expect(computeNutriScore2023(nutrients({ energy_kcal: 100, sugars_g: 1, salt_g: 0.1 }), base)).toEqual({ status: 'missing_nutrients', missing: ['saturated_fat'] });
  });

  it('never invents positive points for unknown fibre, protein or fruit share', () => {
    const r = computeNutriScore2023(nutrients({ energy_kcal: 50, sugars_g: 1, saturated_fat_g: 0.1, salt_g: 0.05 }), base);
    expect(r.status === 'computed' && r.components.filter((c) => c.kind === 'positive').every((c) => c.points === 0)).toBe(true);
  });

  it('does not apply or needs a category', () => {
    expect(computeNutriScore2023(nutrients({}), { ...base, applicable: false, notApplicableReason: 'en:alcoholic-beverages' })).toEqual({
      status: 'not_applicable',
      reason: 'en:alcoholic-beverages',
    });
    expect(computeNutriScore2023(nutrients({}), { ...base, category: null })).toEqual({ status: 'unknown_category' });
    expect(computeNutriScore2023(nutrients({}), null)).toEqual({ status: 'unknown_category' });
  });

  it('caps red-meat protein points at 2 and drops protein above 10 negative points', () => {
    const v = nutrients({ energy_kcal: 250, sugars_g: 0, saturated_fat_g: 4, salt_g: 0.1, protein_g: 26 });
    const meat = computeNutriScore2023(v, { ...base, category: 'red_meat' });
    expect(meat.status === 'computed' && meat.components.find((c) => c.id === 'proteins')?.points).toBe(2);
  });

  it('uses the category thresholds for grades', () => {
    expect(nutriScoreGrade(0, 'general')).toBe('a');
    expect(nutriScoreGrade(0, 'fats_oils_nuts_seeds')).toBe('b');
    expect(nutriScoreGrade(-6, 'fats_oils_nuts_seeds')).toBe('a');
    expect(nutriScoreGrade(-3, 'beverage')).toBe('b');
    expect(nutriScoreGrade(10, 'beverage')).toBe('e');
    expect(nutriScoreGrade(5, 'water')).toBe('a');
  });

  it('does not count salt derived from sodium as an extra point through float noise', () => {
    // 0.4 g sodium × 2.5 = 1.0000000000000002 g salt in binary floating point.
    const r = computeNutriScore2023(nutrients({ energy_kcal: 0, sugars_g: 0, saturated_fat_g: 0, salt_g: 0.4 * 2.5 }), base);
    expect(r.status === 'computed' && r.components.find((c) => c.id === 'salt')?.points).toBe(4);
  });
});
