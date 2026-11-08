import { describe, expect, it } from 'vitest';
import { nutrients } from './nutrients';
import { recipeMatches, recipeNutrition, recipeTags, type Recipe } from './recipes';

const ing = (slug: string, grams: number, per100: Parameters<typeof nutrients>[0]) => ({
  position: 0,
  foodId: slug,
  foodSlug: slug,
  foodNameEs: slug,
  foodNameEn: slug,
  category: 'other',
  basis: '100g' as const,
  grams,
  labelEs: slug,
  labelEn: slug,
  per100: nutrients(per100),
});

const recipe: Recipe = {
  id: 'r1',
  slug: 'yogur-con-avena',
  titleEs: 'Yogur con avena',
  titleEn: 'Yogurt with oats',
  summaryEs: null,
  summaryEn: null,
  minutes: 3,
  servings: 2,
  mealTypes: ['breakfast', 'snack'],
  vegetarian: true,
  stepsEs: [],
  stepsEn: [],
  imageKey: null,
  ingredients: [
    ing('yogur', 340, { energy_kcal: 59, protein_g: 10.2, carbs_g: 3.6, fat_g: 0.4, fiber_g: 0 }),
    ing('avena', 60, { energy_kcal: 379, protein_g: 13.2, carbs_g: 67.7, fat_g: 6.5, fiber_g: 10.1 }),
  ],
};

describe('recipeNutrition', () => {
  it('sums catalogue values and divides by servings', () => {
    const n = recipeNutrition(recipe);
    expect(n.totalGrams).toBe(400);
    expect(n.total.values.energy_kcal).toBeCloseTo(200.6 + 227.4, 1);
    expect(n.perServing.energy_kcal).toBeCloseTo(214, 0);
    expect(n.per100.fiber_g).toBeCloseTo(1.52, 2);
  });

  it('keeps unknown nutrients as incomplete instead of zero', () => {
    const n = recipeNutrition({ servings: 1, ingredients: [ing('a', 100, { energy_kcal: 100 }), ing('b', 100, { energy_kcal: 50, fiber_g: 2 })] });
    expect(n.total.incomplete).toContain('fiber_g');
  });
});

describe('recipeTags', () => {
  it('justifies protein and fibre tags with EU claim thresholds', () => {
    const n = recipeNutrition(recipe);
    const tags = recipeTags(recipe, n);
    expect(tags).toContain('high_protein'); // 46.5 g protein × 4 / 428 kcal ≈ 43 % of energy
    expect(tags).not.toContain('fiber_source'); // 1.5 g / 100 g
    expect(tags).toEqual(expect.arrayContaining(['quick', 'vegetarian']));
  });

  it('filters by meal, speed, protein and diet', () => {
    const tags = recipeTags(recipe, recipeNutrition(recipe));
    expect(recipeMatches(recipe, tags, 'breakfast')).toBe(true);
    expect(recipeMatches(recipe, tags, 'dinner')).toBe(false);
    expect(recipeMatches(recipe, tags, 'protein')).toBe(true);
    expect(recipeMatches(recipe, tags, 'quick')).toBe(true);
    expect(recipeMatches(recipe, tags, null)).toBe(true);
  });
});
