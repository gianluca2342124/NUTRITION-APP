import { z } from 'zod';
import { EU_ALLERGENS } from './allergens';
import { PortionSchema } from './foods';
import { LABEL_ISSUES, LabelNutritionSchema } from './label';
import { MEAL_TYPES } from './meals';
import { NutrientValuesSchema } from './nutrients';
import { BASES, DATA_SOURCES } from './products';

/**
 * Contracts for AI-assisted flows.
 *
 * Design rule: models PERCEIVE (identify foods, estimate portions, read labels);
 * nutrient values always come from catalogue data and deterministic code.
 * "*ModelOutput" schemas validate raw model output on the server; "*Draft"
 * schemas are what the API returns to clients for user review.
 */

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const MealPhotoModelOutputSchema = z.object({
  is_food: z.boolean(),
  image_issue: z.enum(['none', 'blurry', 'too_dark', 'not_food', 'partial_view', 'other']),
  meal_name_es: z.string().max(80),
  meal_name_en: z.string().max(80),
  items: z
    .array(
      z.object({
        name_es: shortText(60),
        name_en: shortText(60),
        /** Slug of the closest catalogue food, or null when none fits. */
        catalog_slug: z.string().max(80).nullable(),
        food_query: shortText(80),
        estimated_grams: z.number().min(1).max(2000),
        min_grams: z.number().min(0).max(2000),
        max_grams: z.number().min(1).max(3000),
        confidence: ConfidenceSchema,
      }),
    )
    .max(15),
  questions: z
    .array(
      z.object({
        id: shortText(40),
        question_es: shortText(140),
        question_en: shortText(140),
        if_yes_name_es: shortText(60),
        if_yes_name_en: shortText(60),
        if_yes_catalog_slug: z.string().max(80).nullable(),
        if_yes_food_query: shortText(80),
        if_yes_grams: z.number().min(1).max(500),
      }),
    )
    .max(3),
});
export type MealPhotoModelOutput = z.infer<typeof MealPhotoModelOutputSchema>;

export const SPOKEN_UNITS = ['g', 'ml', 'unit', 'serving', 'cup', 'tablespoon', 'teaspoon', 'slice', 'glass', 'bowl'] as const;

export const ParsedLogModelOutputSchema = z.object({
  intent: z.enum(['log_food', 'question', 'other']),
  meal_type: z.enum(MEAL_TYPES).nullable(),
  day_offset: z.number().int().min(-7).max(0),
  items: z
    .array(
      z.object({
        spoken_text: z.string().max(120),
        name_es: shortText(60),
        name_en: shortText(60),
        catalog_slug: z.string().max(80).nullable(),
        food_query: shortText(80),
        quantity: z.number().positive().nullable(),
        unit: z.enum(SPOKEN_UNITS).nullable(),
        quantity_specified: z.boolean(),
        estimated_grams: z.number().min(0).max(3000).nullable(),
      }),
    )
    .max(15),
  clarification_es: z.string().max(200).nullable(),
  clarification_en: z.string().max(200).nullable(),
});
export type ParsedLogModelOutput = z.infer<typeof ParsedLogModelOutputSchema>;

export const LabelModelOutputSchema = z.object({
  legibility: z.enum(['good', 'partial', 'unreadable']),
  basis: z.enum(['per_100g', 'per_100ml', 'per_serving', 'unknown']),
  serving_size_g: z.number().positive().max(5000).nullable(),
  product_name: z.string().max(120).nullable(),
  brand: z.string().max(80).nullable(),
  net_quantity_text: z.string().max(40).nullable(),
  nutrition: LabelNutritionSchema,
  ingredients_text: z.string().max(3000).nullable(),
  allergens_mentioned: z.array(z.enum(EU_ALLERGENS)),
  low_confidence_fields: z.array(z.string().max(40)).max(20),
});
export type LabelModelOutput = z.infer<typeof LabelModelOutputSchema>;

/* ----------------------------- client contracts ---------------------------- */

export const FoodMatchSchema = z.object({
  kind: z.enum(['generic_food', 'product']),
  id: z.string(),
  name: z.string(),
  basis: z.enum(BASES),
  nutrientsPer100: NutrientValuesSchema,
  source: z.enum(DATA_SOURCES),
  sourceId: z.string(),
  score: z.number().min(0).max(1),
  portions: z.array(PortionSchema),
  servingQuantity: z.number().positive().nullable(),
});
export type FoodMatch = z.infer<typeof FoodMatchSchema>;

export const DraftItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  foodQuery: z.string(),
  /** Amount in grams (or ml for liquids) of the matched food's basis. */
  grams: z.number().nonnegative(),
  gramsRange: z.tuple([z.number(), z.number()]).nullable(),
  /** Human-readable amount as stated ("2 × huevo mediano"), when known. */
  quantityLabel: z.string().nullable(),
  amountIsEstimate: z.boolean(),
  confidence: ConfidenceSchema.nullable(),
  visible: z.boolean(),
  match: FoodMatchSchema.nullable(),
  alternatives: z.array(FoodMatchSchema),
});
export type DraftItem = z.infer<typeof DraftItemSchema>;

export const DraftQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  item: DraftItemSchema,
});
export type DraftQuestion = z.infer<typeof DraftQuestionSchema>;

export const DRAFT_NOTICES = [
  'image_blurry',
  'image_too_dark',
  'not_food',
  'partial_view',
  'low_confidence',
  'unmatched_items',
  'quantities_estimated',
  'clarification_needed',
  'not_a_food_log',
] as const;

export const MealDraftSchema = z.object({
  draftId: z.string(),
  source: z.enum(['photo', 'voice', 'text']),
  title: z.string(),
  mealType: z.enum(MEAL_TYPES).nullable(),
  dayOffset: z.number().int(),
  items: z.array(DraftItemSchema),
  questions: z.array(DraftQuestionSchema),
  notices: z.array(z.enum(DRAFT_NOTICES)),
  clarification: z.string().nullable(),
  transcript: z.string().nullable(),
  cached: z.boolean(),
});
export type MealDraft = z.infer<typeof MealDraftSchema>;

export const LabelIssueSchema = z.object({ code: z.enum(LABEL_ISSUES), fields: z.array(z.string()) });

export const LabelDraftSchema = z.object({
  draftId: z.string(),
  legibility: z.enum(['good', 'partial', 'unreadable']),
  basis: z.enum(['100g', '100ml', 'serving', 'unknown']),
  servingSizeG: z.number().nullable(),
  productName: z.string().nullable(),
  brand: z.string().nullable(),
  netQuantityText: z.string().nullable(),
  raw: LabelNutritionSchema,
  /** Per-100 values, null when the basis could not be determined. */
  nutrientsPer100: NutrientValuesSchema.nullable(),
  issues: z.array(LabelIssueSchema),
  ingredientsText: z.string().nullable(),
  allergens: z.array(z.enum(EU_ALLERGENS)),
  lowConfidenceFields: z.array(z.string()),
});
export type LabelDraft = z.infer<typeof LabelDraftSchema>;

export const TranscriptSchema = z.object({ text: z.string(), language: z.string().nullable() });
export type Transcript = z.infer<typeof TranscriptSchema>;
