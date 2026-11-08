import { z } from 'zod';
import { EU_ALLERGENS } from './allergens';
import { NutrientValuesSchema } from './nutrients';
import { NutriScoreInputsSchema } from './nutriscore';

export const BASES = ['100g', '100ml'] as const;
export type Basis = (typeof BASES)[number];

export const DATA_SOURCES = ['open_food_facts', 'usda_fdc', 'user_contribution', 'label_scan', 'editorial'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const PRODUCT_WARNINGS = [
  'missing_nutrition',
  'partial_nutrition',
  'missing_ingredients',
  'energy_derived_from_kj',
  'salt_derived_from_sodium',
  'source_quality_errors',
  'implausible_values',
  'obsolete_product',
] as const;
export type ProductWarning = (typeof PRODUCT_WARNINGS)[number];

export const ProductSchema = z.object({
  gtin: z.string(),
  name: z.string().nullable(),
  /** Localised names keyed by language code when the source provides them. */
  names: z.record(z.string(), z.string()),
  brand: z.string().nullable(),
  quantityText: z.string().nullable(),
  netQuantity: z.number().positive().nullable(),
  netQuantityUnit: z.enum(['g', 'ml']).nullable(),
  servingSizeText: z.string().nullable(),
  servingQuantity: z.number().positive().nullable(),
  basis: z.enum(BASES),
  nutrientsPer100: NutrientValuesSchema,
  nutritionAvailable: z.boolean(),
  categories: z.array(z.string()),
  categoryMain: z.string().nullable(),
  countries: z.array(z.string()),
  ingredientsText: z.string().nullable(),
  ingredientsTexts: z.record(z.string(), z.string()),
  allergens: z.array(z.enum(EU_ALLERGENS)),
  traces: z.array(z.enum(EU_ALLERGENS)),
  additives: z.array(z.string()),
  labels: z.array(z.string()),
  nutriscoreGrade: z.enum(['a', 'b', 'c', 'd', 'e']).nullable(),
  nutriscoreVersion: z.string().nullable(),
  novaGroup: z.number().int().min(1).max(4).nullable(),
  /** Source-provided inputs for computing the Nutri-Score 2023 ourselves. */
  nutriscoreInputs: NutriScoreInputsSchema.nullable(),
  imageUrl: z.string().nullable(),
  imageIngredientsUrl: z.string().nullable(),
  imageNutritionUrl: z.string().nullable(),
  source: z.enum(DATA_SOURCES),
  sourceId: z.string(),
  sourceUrl: z.string().nullable(),
  license: z.string(),
  sourceLastModified: z.string().nullable(),
  warnings: z.array(z.enum(PRODUCT_WARNINGS)),
});
export type Product = z.infer<typeof ProductSchema>;

export const EU_ADDITIVE_STATUSES = ['authorised', 'not_authorised', 'unknown'] as const;
export type EuAdditiveStatus = (typeof EU_ADDITIVE_STATUSES)[number];

/** What the evaluation needs to know about each additive in a product. */
export const AdditiveInfoSchema = z.object({
  code: z.string(),
  eNumber: z.string(),
  nameEs: z.string().nullable(),
  nameEn: z.string().nullable(),
  classes: z.array(z.string()),
  /** Regulatory status in the EU, only when editorially verified ("unknown" otherwise). */
  euStatus: z.enum(EU_ADDITIVE_STATUSES),
  /** EFSA's re-evaluation estimated intakes above the ADI for some population groups. */
  exposureConcern: z.boolean(),
});
export type AdditiveInfo = z.infer<typeof AdditiveInfoSchema>;

/** Product as served by the API (adds catalogue identity + freshness). */
export const CatalogProductSchema = ProductSchema.extend({
  id: z.string(),
  slug: z.string(),
  importedAt: z.string(),
  updatedAt: z.string(),
  verificationStatus: z.enum(['imported', 'user_submitted', 'pending_review', 'verified', 'rejected']),
  /** Catalogue data for the product's additives (absent when not loaded). */
  additiveInfo: z.array(AdditiveInfoSchema).optional(),
});
export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

export function localizedName(p: { name: string | null; names: Record<string, string> }, locale: string): string | null {
  return p.names[locale] ?? p.name ?? Object.values(p.names)[0] ?? null;
}

/** Tidies a source quantity for display ("400.0 g" → "400 g"); keeps real decimals. */
export function quantityLabel(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.replace(/(\d+)[.,]0+(?=\s*[a-zA-Zµ])/g, '$1').trim() || null;
}
