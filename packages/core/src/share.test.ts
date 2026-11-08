import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/off-nutriscore-2023.json';
import { normalizeOffProduct, type OffProduct } from './off';
import { computeFudyuScore } from './score';
import { shareFacts } from './share';

const products = fixture.products as unknown as (OffProduct & { code: string })[];
const product = (code: string) => normalizeOffProduct(products.find((p) => p.code === code)!)!;
const scoreOf = (p: ReturnType<typeof product>) =>
  computeFudyuScore({ basis: p.basis, nutrientsPer100: p.nutrientsPer100, nutritionAvailable: p.nutritionAvailable, nutriscoreInputs: p.nutriscoreInputs, novaGroup: null, ingredientsKnown: true, additives: [] });

describe('share card facts', () => {
  it('leads with the nutrients behind the reasons', () => {
    const nutella = product('3017624010701');
    const facts = shareFacts(nutella.nutrientsPer100, scoreOf(nutella));
    expect(facts).toHaveLength(3);
    expect(facts.slice(0, 2)).toEqual(['sugars_g', 'saturated_fat_g']);
  });

  it('never shows an unknown value and falls back when unscored', () => {
    const nutella = product('3017624010701');
    const values = { ...nutella.nutrientsPer100, sugars_g: null };
    const facts = shareFacts(values, { status: 'unscored', version: 'x', reason: 'missing_nutrients', missing: ['sugars'] });
    expect(facts).not.toContain('sugars_g');
    expect(facts[0]).toBe('energy_kcal');
    expect(new Set(facts).size).toBe(facts.length);
  });
});
