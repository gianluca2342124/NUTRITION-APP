import { allergensFromOffTags } from './allergens';
import { normalizeAdditiveCode } from './additives';
import { normalizeBarcode } from './gtin';
import { kjToKcal, nutrients, round, sodiumToSalt, type NutrientValues } from './nutrients';
import type { Basis, Product, ProductWarning } from './products';
import { parseQuantity } from './units';
import { checkNutrientPlausibility } from './label';

/**
 * Normalisation of Open Food Facts (OFF) API v2 product payloads.
 *
 * OFF data is published under the Open Database License (ODbL 1.0); individual
 * contents under the Database Contents License and images under CC BY-SA.
 * Attribution must be shown wherever this data is displayed.
 */
export const OFF_LICENSE = 'ODbL-1.0 (database), DbCL-1.0 (contents), CC BY-SA 3.0 (images)';
export const OFF_ATTRIBUTION = 'Open Food Facts contributors — openfoodfacts.org';

/** Fields requested from the OFF API (keeps responses small). */
export const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_es',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'product_quantity',
  'product_quantity_unit',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'nutrition_data_per',
  'no_nutrition_data',
  'nutriments',
  'categories_tags',
  'categories_hierarchy',
  'countries_tags',
  'ingredients_text',
  'ingredients_text_es',
  'ingredients_text_en',
  'lang',
  'allergens_tags',
  'traces_tags',
  'additives_tags',
  'labels_tags',
  'nutriscore_grade',
  'nutriscore_version',
  'nova_group',
  'image_front_url',
  'image_ingredients_url',
  'image_nutrition_url',
  'last_modified_t',
  'data_quality_errors_tags',
  'obsolete',
  'product_type',
] as const;

type OffNutriments = Record<string, unknown>;
export type OffProduct = Partial<Record<(typeof OFF_FIELDS)[number], unknown>> & { nutriments?: OffNutriments };

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s.length ? s : null;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function stripLangPrefix(tag: string): string {
  return tag.replace(/^[a-z]{2}:/, '');
}

const LIQUID_UNITS = new Set(['ml', 'cl', 'dl', 'l', 'fl_oz']);

function inferBasis(p: OffProduct): Basis {
  const unit = str(p.product_quantity_unit)?.toLowerCase();
  if (unit && LIQUID_UNITS.has(unit)) return '100ml';
  const parsed = parseQuantity(str(p.quantity));
  return parsed?.base === 'ml' ? '100ml' : '100g';
}

function extractNutrients(n: OffNutriments, warnings: Set<ProductWarning>): NutrientValues {
  let energyKcal = num(n['energy-kcal_100g']);
  if (energyKcal == null) {
    const kj = num(n['energy-kj_100g']) ?? (n['energy_unit'] === 'kcal' ? null : num(n['energy_100g']));
    if (kj != null) {
      energyKcal = round(kjToKcal(kj), 1);
      warnings.add('energy_derived_from_kj');
    }
  }
  let salt = num(n['salt_100g']);
  if (salt == null) {
    const sodium = num(n['sodium_100g']);
    if (sodium != null) {
      salt = round(sodiumToSalt(sodium), 3);
      warnings.add('salt_derived_from_sodium');
    }
  }
  return nutrients({
    energy_kcal: energyKcal ?? undefined,
    protein_g: num(n['proteins_100g']) ?? undefined,
    carbs_g: num(n['carbohydrates_100g']) ?? undefined,
    sugars_g: num(n['sugars_100g']) ?? undefined,
    fat_g: num(n['fat_100g']) ?? undefined,
    saturated_fat_g: num(n['saturated-fat_100g']) ?? undefined,
    fiber_g: num(n['fiber_100g']) ?? undefined,
    salt_g: salt ?? undefined,
  });
}

function mostSpecificCategory(hierarchy: string[]): string | null {
  const en = hierarchy.filter((t) => t.startsWith('en:'));
  const last = en[en.length - 1];
  return last ? stripLangPrefix(last) : null;
}

/**
 * Converts an OFF product payload to the platform's Product shape.
 * Returns null when the barcode is invalid or the payload is not a food product.
 */
export function normalizeOffProduct(p: OffProduct): Product | null {
  const code = str(p.code);
  const gtin = code ? normalizeBarcode(code) : null;
  if (!gtin) return null;
  if (p.product_type && p.product_type !== 'food') return null;

  const warnings = new Set<ProductWarning>();
  const n = (p.nutriments ?? {}) as OffNutriments;
  const per100 = extractNutrients(n, warnings);
  const knownCount = Object.values(per100).filter((v) => v != null).length;
  const noNutrition = p.no_nutrition_data === 'on' || p.no_nutrition_data === true;
  const nutritionAvailable = !noNutrition && per100.energy_kcal != null && knownCount >= 4;
  if (!nutritionAvailable) warnings.add('missing_nutrition');
  else if (knownCount < 8) warnings.add('partial_nutrition');

  const basis = inferBasis(p);
  if (nutritionAvailable && checkNutrientPlausibility(per100, basis).length > 0) {
    warnings.add('implausible_values');
  }

  const names: Record<string, string> = {};
  for (const lang of ['es', 'en'] as const) {
    const v = str(p[`product_name_${lang}`]);
    if (v) names[lang] = v;
  }
  const mainLang = str(p.lang) ?? undefined;
  const name = str(p.product_name) ?? str(p.generic_name);
  if (name && mainLang && !names[mainLang]) names[mainLang] = name;

  const ingredientsTexts: Record<string, string> = {};
  for (const lang of ['es', 'en'] as const) {
    const v = str(p[`ingredients_text_${lang}`]);
    if (v) ingredientsTexts[lang] = v;
  }
  const ingredientsText = str(p.ingredients_text);
  if (ingredientsText && mainLang && !ingredientsTexts[mainLang]) ingredientsTexts[mainLang] = ingredientsText;
  if (!ingredientsText && Object.keys(ingredientsTexts).length === 0) warnings.add('missing_ingredients');

  if (strArray(p.data_quality_errors_tags).length > 0) warnings.add('source_quality_errors');
  if (p.obsolete === 'on' || p.obsolete === true) warnings.add('obsolete_product');

  const qty = parseQuantity(str(p.quantity));
  const productQuantity = num(p.product_quantity);
  const productQuantityUnit = str(p.product_quantity_unit)?.toLowerCase();
  let netQuantity: number | null = null;
  let netQuantityUnit: 'g' | 'ml' | null = null;
  if (productQuantity && productQuantity > 0 && (productQuantityUnit === 'g' || productQuantityUnit === 'ml')) {
    netQuantity = productQuantity;
    netQuantityUnit = productQuantityUnit;
  } else if (qty) {
    netQuantity = round(qty.total, 1);
    netQuantityUnit = qty.base;
  }

  const servingQuantity = num(p.serving_quantity);
  const grade = str(p.nutriscore_grade)?.toLowerCase();
  const nova = num(p.nova_group);
  const lastModified = num(p.last_modified_t);

  const additives = Array.from(
    new Set(strArray(p.additives_tags).map((t) => normalizeAdditiveCode(t)).filter((c): c is string => c != null)),
  );

  return {
    gtin,
    name,
    names,
    brand: str(p.brands)?.split(',')[0]?.trim() ?? null,
    quantityText: str(p.quantity),
    netQuantity,
    netQuantityUnit,
    servingSizeText: str(p.serving_size),
    servingQuantity: servingQuantity && servingQuantity > 0 ? servingQuantity : null,
    basis,
    nutrientsPer100: per100,
    nutritionAvailable,
    categories: strArray(p.categories_tags).filter((t) => t.startsWith('en:')).map(stripLangPrefix),
    categoryMain: mostSpecificCategory(strArray(p.categories_hierarchy)),
    countries: strArray(p.countries_tags).map(stripLangPrefix),
    ingredientsText: ingredientsTexts.es ?? ingredientsTexts.en ?? ingredientsText,
    ingredientsTexts,
    allergens: allergensFromOffTags(strArray(p.allergens_tags)),
    traces: allergensFromOffTags(strArray(p.traces_tags)),
    additives,
    labels: strArray(p.labels_tags).filter((t) => t.startsWith('en:')).map(stripLangPrefix),
    nutriscoreGrade: grade && ['a', 'b', 'c', 'd', 'e'].includes(grade) ? (grade as Product['nutriscoreGrade']) : null,
    nutriscoreVersion: str(p.nutriscore_version),
    novaGroup: nova && nova >= 1 && nova <= 4 ? Math.round(nova) : null,
    imageUrl: str(p.image_front_url),
    imageIngredientsUrl: str(p.image_ingredients_url),
    imageNutritionUrl: str(p.image_nutrition_url),
    source: 'open_food_facts',
    sourceId: gtin,
    sourceUrl: `https://world.openfoodfacts.org/product/${gtin}`,
    license: OFF_LICENSE,
    sourceLastModified: lastModified ? new Date(lastModified * 1000).toISOString() : null,
    warnings: Array.from(warnings),
  };
}

export function offProductUrl(gtin: string, fields: readonly string[] = OFF_FIELDS): string {
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(gtin)}.json?fields=${fields.join(',')}`;
}
