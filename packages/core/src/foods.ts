import { z } from 'zod';
import { NutrientValuesSchema, scaleNutrients, type NutrientValues } from './nutrients';
import { BASES, DATA_SOURCES, type Basis } from './products';

export const FOOD_CATEGORIES = [
  'fruits',
  'vegetables',
  'legumes',
  'grains',
  'dairy',
  'eggs',
  'meat',
  'fish_seafood',
  'fats_oils',
  'nuts_seeds',
  'sweets_snacks',
  'beverages',
  'condiments',
  'prepared',
  'other',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const PortionSchema = z.object({
  id: z.string(),
  labelEs: z.string(),
  labelEn: z.string(),
  grams: z.number().positive(),
});
export type Portion = z.infer<typeof PortionSchema>;

export const GenericFoodSchema = z.object({
  id: z.string(),
  slug: z.string(),
  nameEs: z.string(),
  nameEn: z.string(),
  category: z.enum(FOOD_CATEGORIES),
  basis: z.enum(BASES),
  nutrientsPer100: NutrientValuesSchema,
  portions: z.array(PortionSchema),
  source: z.enum(DATA_SOURCES),
  sourceId: z.string(),
  sourceUrl: z.string().nullable(),
  license: z.string(),
  sourceVersion: z.string().nullable(),
});
export type GenericFood = z.infer<typeof GenericFoodSchema>;

export function genericFoodName(food: { nameEs: string; nameEn: string }, locale: string): string {
  return locale.startsWith('es') ? food.nameEs : food.nameEn;
}

/** Amount units accepted when logging food. */
export const AMOUNT_UNITS = ['g', 'ml', 'serving', 'portion'] as const;
export type AmountUnit = (typeof AMOUNT_UNITS)[number];

export interface AmountInput {
  quantity: number;
  unit: AmountUnit;
  /** Required for unit "portion". */
  portionId?: string;
}

export interface AmountContext {
  basis: Basis;
  servingQuantity?: number | null;
  portions?: readonly Portion[];
}

/**
 * Resolves a logged amount to grams/millilitres of the food's basis.
 * Returns null when the amount cannot be resolved without guessing
 * (e.g. "1 serving" for a product without a declared serving size).
 */
export function resolveAmount(input: AmountInput, ctx: AmountContext): number | null {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return null;
  switch (input.unit) {
    case 'g':
      return ctx.basis === '100g' ? input.quantity : null;
    case 'ml':
      return ctx.basis === '100ml' ? input.quantity : null;
    case 'serving':
      return ctx.servingQuantity ? input.quantity * ctx.servingQuantity : null;
    case 'portion': {
      const p = ctx.portions?.find((x) => x.id === input.portionId);
      return p ? input.quantity * p.grams : null;
    }
    default:
      return null;
  }
}

export function nutrientsForAmount(per100: NutrientValues, amount: number): NutrientValues {
  return scaleNutrients(per100, amount);
}
