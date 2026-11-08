import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/off-nutriscore-2023.json';
import { nutrients } from './nutrients';
import type { NutriScoreInputs } from './nutriscore';
import { normalizeOffProduct, type OffProduct } from './off';
import { computeFudyuScore, FUDYU_SCORE_VERSION, nutritionScoreFromPoints, scoreLevel, topFactors, type ScoreAdditive, type ScoreInput } from './score';

const products = fixture.products as unknown as (OffProduct & { code: string; nova_group?: number })[];

function inputFor(code: string, overrides: Partial<ScoreInput> = {}): ScoreInput {
  const raw = products.find((p) => p.code === code)!;
  const p = normalizeOffProduct(raw)!;
  return {
    basis: p.basis,
    nutrientsPer100: p.nutrientsPer100,
    nutritionAvailable: p.nutritionAvailable,
    nutriscoreInputs: p.nutriscoreInputs,
    novaGroup: null,
    ingredientsKnown: true,
    additives: [],
    ...overrides,
  };
}

const e171: ScoreAdditive = { code: 'e171', eNumber: 'E171', euStatus: 'not_authorised', exposureConcern: false };
const exposure = (n: number): ScoreAdditive => ({ code: `e${n}`, eNumber: `E${n}`, euStatus: 'unknown', exposureConcern: true });
const plain: ScoreAdditive = { code: 'e330', eNumber: 'E330', euStatus: 'unknown', exposureConcern: false };

describe('levels', () => {
  it('uses the published ranges', () => {
    expect([100, 80, 79, 60, 59, 40, 39, 20, 19, 0].map(scoreLevel)).toEqual([
      'excellent', 'excellent', 'good', 'good', 'fair', 'fair', 'poor', 'poor', 'limit', 'limit',
    ]);
  });
});

describe('nutrition mapping keeps every grade inside its level', () => {
  it.each([
    [-20, 'general', 100], [0, 'general', 80], [1, 'general', 79], [2, 'general', 60], [3, 'general', 59],
    [10, 'general', 40], [11, 'general', 39], [18, 'general', 20], [19, 'general', 19], [40, 'general', 0], [55, 'general', 0],
    [-6, 'fats_oils_nuts_seeds', 80], [-5, 'fats_oils_nuts_seeds', 79], [2, 'fats_oils_nuts_seeds', 60],
    [2, 'beverage', 60], [3, 'beverage', 59], [9, 'beverage', 20], [10, 'beverage', 19], [0, 'water', 100],
  ] as const)('%i points (%s) → %i', (points, category, expected) => {
    expect(nutritionScoreFromPoints(points, category)).toBeCloseTo(expected, 6);
  });

  it('matches the Nutri-Score grade for all 30 real products when there are no adjustments', () => {
    const levelOf = { a: 'excellent', b: 'good', c: 'fair', d: 'poor', e: 'limit' } as const;
    for (const raw of products) {
      const r = computeFudyuScore(inputFor(raw.code));
      const grade = (raw.nutriscore as Record<string, { grade: keyof typeof levelOf }>)['2023']!.grade;
      expect(r.status, raw.code).toBe('scored');
      if (r.status === 'scored') expect(r.level, raw.code).toBe(levelOf[grade]);
    }
  });
});

describe('Fudyu Score', () => {
  it('scores rolled oats as a good option with real reasons', () => {
    const r = computeFudyuScore(inputFor('3229820019307', { novaGroup: 1 }));
    expect(r).toMatchObject({ status: 'scored', version: FUDYU_SCORE_VERSION, score: 85, level: 'excellent', adjustments: [] });
    if (r.status !== 'scored') return;
    const keys = topFactors(r).map((f) => f.key);
    expect(keys.slice(0, 2)).toEqual(['fiber', 'protein']);
    // NOVA 1 does not change the number, so it is not a reason (it shows under "Procesamiento").
    expect(r.factors.map((f) => f.key)).not.toContain('minimally_processed');
    expect(computeFudyuScore(inputFor('3229820019307', { novaGroup: null }))).toMatchObject({ score: 85 });
  });

  it('explains a spread high in sugars and saturated fat', () => {
    const r = computeFudyuScore(inputFor('3017624010701', { novaGroup: 4 }));
    expect(r).toMatchObject({ status: 'scored', score: 0, level: 'limit', nutritionScore: 8 });
    if (r.status !== 'scored') return;
    const top = topFactors(r);
    expect(top.map((f) => f.key)).toEqual(['sugars', 'saturated_fat', 'ultra_processed']);
    expect(top[0]).toMatchObject({ sign: -1, intensity: 'very_high', value: 56.3, unit: 'g' });
  });

  it('flags sweeteners in a sugar-free soda without hiding that it has no sugar', () => {
    const r = computeFudyuScore(inputFor('5449000131805', { novaGroup: 4 }));
    expect(r).toMatchObject({ status: 'scored', level: 'fair' });
    if (r.status !== 'scored') return;
    expect(topFactors(r).map((f) => f.key)).toEqual(['sweeteners', 'ultra_processed', 'low_sugars']);
  });

  it('gives water the top of the scale', () => {
    const r = computeFudyuScore(inputFor('8412042502312', { novaGroup: 1 }));
    expect(r).toMatchObject({ status: 'scored', score: 100, level: 'excellent' });
  });

  it('penalises only additives with a documented issue, never authorised additives as such', () => {
    const base = computeFudyuScore(inputFor('3229820019307'));
    const withPlain = computeFudyuScore(inputFor('3229820019307', { additives: [plain] }));
    const withE171 = computeFudyuScore(inputFor('3229820019307', { additives: [plain, e171] }));
    if (base.status !== 'scored' || withPlain.status !== 'scored' || withE171.status !== 'scored') throw new Error('unscored');
    expect(withPlain.score).toBe(base.score);
    expect(withE171.score).toBe(base.score - 15);
    expect(withE171.adjustments).toEqual([{ key: 'additive_not_authorised', points: -15, codes: ['E171'] }]);
  });

  it('caps the exposure adjustment and the total adjustment', () => {
    const three = computeFudyuScore(inputFor('3229820019307', { additives: [exposure(250), exposure(251), exposure(252)] }));
    expect(three.status === 'scored' && three.adjustments).toEqual([{ key: 'additive_exposure', points: -8, codes: ['E250', 'E251', 'E252'] }]);
    const all = computeFudyuScore(inputFor('3229820019307', { novaGroup: 4, additives: [e171, exposure(250), exposure(251)] }));
    if (all.status !== 'scored') throw new Error('unscored');
    expect(all.nutritionScore - all.score).toBe(25);
  });

  it('says what it could not assess instead of filling the gaps', () => {
    const r = computeFudyuScore(inputFor('3229820019307', { novaGroup: null, ingredientsKnown: false, additives: null }));
    expect(r.status === 'scored' && r.unknown).toEqual(expect.arrayContaining(['processing', 'additives']));
  });

  it('returns "unscored" (never 0) when the data is not enough', () => {
    const base = inputFor('3229820019307');
    expect(computeFudyuScore({ ...base, nutritionAvailable: false })).toMatchObject({ status: 'unscored', reason: 'no_nutrition' });
    expect(computeFudyuScore({ ...base, nutrientsPer100: nutrients({ energy_kcal: 362, sugars_g: 1.7, salt_g: 0.02 }) })).toMatchObject({
      status: 'unscored',
      reason: 'missing_nutrients',
      missing: ['saturated_fat'],
    });
    expect(computeFudyuScore({ ...base, nutriscoreInputs: null })).toMatchObject({ status: 'unscored', reason: 'unknown_category' });
    const notApplicable: NutriScoreInputs = { ...base.nutriscoreInputs!, applicable: false, notApplicableReason: 'en:alcoholic-beverages' };
    expect(computeFudyuScore({ ...base, nutriscoreInputs: notApplicable })).toMatchObject({ status: 'unscored', reason: 'not_applicable' });
  });

  it('is deterministic', () => {
    const a = computeFudyuScore(inputFor('8480000047403', { novaGroup: 2 }));
    const b = computeFudyuScore(inputFor('8480000047403', { novaGroup: 2 }));
    expect(a).toEqual(b);
  });
});

describe('audit: reasons only reflect what moves the number', () => {
  const scored = () =>
    products.flatMap((raw) =>
      [null, 1, 4].map((nova) => computeFudyuScore(inputFor(raw.code, { novaGroup: nova }))).filter((r) => r.status === 'scored'),
    ) as Extract<ReturnType<typeof computeFudyuScore>, { status: 'scored' }>[];
  const NEG: Record<string, string[]> = {
    sugars: ['sugars'],
    saturated_fat: ['saturated_fat', 'energy_from_saturated_fat'],
    saturated_fat_ratio: ['saturated_fat_ratio'],
    salt: ['salt'],
    energy: ['energy'],
    sweeteners: ['non_nutritive_sweeteners'],
  };
  const POS: Record<string, string> = { fiber: 'fiber', protein: 'proteins', fruits_vegetables_legumes: 'fruits_vegetables_legumes' };

  it('never repeats a reason, and shows at most one saturated-fat reason', () => {
    for (const r of scored()) {
      const keys = r.factors.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.filter((k) => k === 'saturated_fat' || k === 'saturated_fat_ratio').length).toBeLessThanOrEqual(1);
    }
  });

  it('every reason against is a component that scored points or an applied adjustment', () => {
    for (const r of scored()) {
      for (const f of r.factors.filter((x) => x.sign < 0)) {
        const adjustment = r.adjustments.some((a) => a.key === f.key);
        const component = r.nutriscore.components.some((c) => (NEG[f.key] ?? []).includes(c.id) && c.counted && c.points > 0);
        expect(adjustment || component, f.key).toBe(true);
      }
    }
  });

  it('every reason in favour earned points or kept that nutrient from counting against', () => {
    for (const r of scored()) {
      const against = new Set(r.factors.filter((x) => x.sign < 0).map((x) => x.key));
      for (const f of r.factors.filter((x) => x.sign > 0)) {
        if (POS[f.key]) {
          expect(r.nutriscore.components.some((c) => c.id === POS[f.key] && c.counted && c.points > 0), f.key).toBe(true);
        } else if (f.key === 'low_sugars') expect(against.has('sugars')).toBe(false);
        else if (f.key === 'low_salt') expect(against.has('salt')).toBe(false);
        else if (f.key === 'low_saturated_fat') expect(against.has('saturated_fat') || against.has('saturated_fat_ratio')).toBe(false);
        else expect(f.key).toBe('water');
      }
    }
  });

  it('adjustments are never nutrients, so no nutrient is counted twice', () => {
    for (const r of scored()) for (const a of r.adjustments) expect(['ultra_processed', 'additive_not_authorised', 'additive_exposure']).toContain(a.key);
  });

  it('more sugar, salt or saturated fat never raises the score; more fibre or protein never lowers it', () => {
    const base = inputFor('3229820019307');
    const at = (patch: Partial<ScoreInput['nutrientsPer100']>) => {
      const r = computeFudyuScore({ ...base, nutrientsPer100: { ...base.nutrientsPer100, ...patch } });
      return r.status === 'scored' ? r.score : NaN;
    };
    const series = (key: keyof ScoreInput['nutrientsPer100'], values: number[]) => values.map((v) => at({ [key]: v }));
    const nonIncreasing = (xs: number[]) => xs.every((x, i) => i === 0 || x <= xs[i - 1]!);
    const nonDecreasing = (xs: number[]) => xs.every((x, i) => i === 0 || x >= xs[i - 1]!);
    const grid = Array.from({ length: 31 }, (_, i) => i * 2);
    expect(nonIncreasing(series('sugars_g', grid))).toBe(true);
    expect(nonIncreasing(series('saturated_fat_g', grid.map((x) => x / 2)))).toBe(true);
    expect(nonIncreasing(series('salt_g', grid.map((x) => x / 10)))).toBe(true);
    expect(nonDecreasing(series('fiber_g', grid.map((x) => x / 4)))).toBe(true);
    expect(nonDecreasing(series('protein_g', grid.map((x) => x / 2)))).toBe(true);
  });
});
