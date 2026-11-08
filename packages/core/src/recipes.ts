import type { MealType } from './meals';
import { scaleNutrients, sumNutrients, type NutrientTotals, type NutrientValues } from './nutrients';
import type { Basis } from './products';

/** Editorial recipe with catalogue-linked ingredients (grams for the whole recipe). */
export interface RecipeIngredient {
  position: number;
  foodId: string;
  foodSlug: string;
  foodNameEs: string;
  foodNameEn: string;
  category: string;
  basis: Basis;
  grams: number;
  labelEs: string;
  labelEn: string;
  per100: NutrientValues;
}

export interface Recipe {
  id: string;
  slug: string;
  titleEs: string;
  titleEn: string;
  summaryEs: string | null;
  summaryEn: string | null;
  minutes: number;
  servings: number;
  mealTypes: MealType[];
  vegetarian: boolean;
  stepsEs: string[];
  stepsEn: string[];
  imageKey: string | null;
  ingredients: RecipeIngredient[];
}

export interface RecipeNutrition {
  /** Sum for the whole recipe (incomplete keys listed when an ingredient lacks a value). */
  total: NutrientTotals;
  perServing: NutrientValues;
  /** Per 100 g of the finished recipe (used for claim thresholds). */
  per100: NutrientValues;
  totalGrams: number;
}

/** Nutrition computed only from catalogue data — never typed by hand. */
export function recipeNutrition(recipe: Pick<Recipe, 'servings' | 'ingredients'>): RecipeNutrition {
  const total = sumNutrients(recipe.ingredients.map((i) => scaleNutrients(i.per100, i.grams)));
  const totalGrams = recipe.ingredients.reduce((s, i) => s + i.grams, 0);
  return {
    total,
    perServing: scaleNutrients(total.values, 100 / recipe.servings),
    per100: totalGrams > 0 ? scaleNutrients(total.values, (100 / totalGrams) * 100) : total.values,
    totalGrams,
  };
}

export const RECIPE_FILTERS = ['breakfast', 'lunch', 'dinner', 'snack', 'quick', 'protein', 'vegetarian'] as const;
export type RecipeFilter = (typeof RECIPE_FILTERS)[number];

export type RecipeTag = 'quick' | 'vegetarian' | 'high_protein' | 'protein_source' | 'high_fiber' | 'fiber_source';

/** Quick means 20 minutes or less (the "Cenas en 20 minutos" collection). */
export const QUICK_MINUTES = 20;

/**
 * Nutrition tags justified by the data, using the thresholds of Regulation (EC)
 * No 1924/2006 (protein share of energy; fibre per 100 g).
 */
export function recipeTags(recipe: Pick<Recipe, 'minutes' | 'vegetarian'>, n: RecipeNutrition): RecipeTag[] {
  const tags: RecipeTag[] = [];
  const kcal = n.total.values.energy_kcal;
  const protein = n.total.values.protein_g;
  if (kcal && protein != null) {
    const share = (protein * 4) / kcal;
    if (share >= 0.2) tags.push('high_protein');
    else if (share >= 0.12) tags.push('protein_source');
  }
  const fiber = n.per100.fiber_g;
  if (fiber != null && !n.total.incomplete.includes('fiber_g')) {
    if (fiber >= 6) tags.push('high_fiber');
    else if (fiber >= 3) tags.push('fiber_source');
  }
  if (recipe.minutes <= QUICK_MINUTES) tags.push('quick');
  if (recipe.vegetarian) tags.push('vegetarian');
  return tags;
}

export function recipeMatches(recipe: Recipe, tags: readonly RecipeTag[], filter: RecipeFilter | null): boolean {
  if (!filter) return true;
  switch (filter) {
    case 'quick':
      return tags.includes('quick');
    case 'protein':
      return tags.includes('high_protein');
    case 'vegetarian':
      return recipe.vegetarian;
    default:
      return recipe.mealTypes.includes(filter);
  }
}
