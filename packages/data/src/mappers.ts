import {
  nutrients,
  NutriScoreInputsSchema,
  type CatalogProduct,
  type GenericFood,
  type NutrientValues,
  type NutriScoreInputs,
  type Portion,
  type Product,
} from '@repo/core';

type Row = Record<string, unknown>;

const n = (v: unknown): number | undefined => {
  if (v == null) return undefined;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : undefined;
};
const s = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const rec = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'))
    : {};

/** Nutrient columns shared by generic_foods, products and food_entry_items. */
export function nutrientsFromRow(row: Row): NutrientValues {
  return nutrients({
    energy_kcal: n(row.energy_kcal),
    protein_g: n(row.protein_g),
    carbs_g: n(row.carbs_g),
    sugars_g: n(row.sugars_g),
    fat_g: n(row.fat_g),
    saturated_fat_g: n(row.saturated_fat_g),
    fiber_g: n(row.fiber_g),
    salt_g: n(row.salt_g),
  });
}

export function nutrientsFromJson(json: unknown): NutrientValues {
  return nutrientsFromRow((json && typeof json === 'object' ? json : {}) as Row);
}

export function mapPortionRow(row: Row): Portion {
  return {
    id: String(row.id),
    labelEs: String(row.label_es),
    labelEn: String(row.label_en),
    grams: n(row.grams) ?? 0,
  };
}

export const GENERIC_FOOD_COLUMNS =
  'id, slug, name_es, name_en, category, basis, energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, salt_g, source, source_id, source_url, source_version, license, generic_food_portions(id, position, label_es, label_en, grams)';

export function mapGenericFoodRow(row: Row): GenericFood {
  const portions = (Array.isArray(row.generic_food_portions) ? (row.generic_food_portions as Row[]) : [])
    .sort((a, b) => (n(a.position) ?? 0) - (n(b.position) ?? 0))
    .map(mapPortionRow);
  return {
    id: String(row.id),
    slug: String(row.slug),
    nameEs: String(row.name_es),
    nameEn: String(row.name_en),
    category: row.category as GenericFood['category'],
    basis: row.basis === '100ml' ? '100ml' : '100g',
    nutrientsPer100: nutrientsFromRow(row),
    portions,
    source: row.source as GenericFood['source'],
    sourceId: String(row.source_id),
    sourceUrl: s(row.source_url),
    license: String(row.license),
    sourceVersion: s(row.source_version),
  };
}

export const PRODUCT_COLUMNS =
  'id, gtin, slug, name, names, brand, quantity_text, net_quantity, net_quantity_unit, serving_size_text, serving_quantity, basis, energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, salt_g, nutrition_available, categories, category_main, countries, ingredients_text, ingredients_texts, allergens, traces, additives, labels, nutriscore_grade, nutriscore_version, nova_group, nutriscore_inputs, image_url, image_ingredients_url, image_nutrition_url, source, source_id, source_url, license, source_last_modified, warnings, verification_status, imported_at, updated_at';

export function mapProductRow(row: Row): CatalogProduct {
  return {
    id: String(row.id),
    slug: String(row.slug),
    gtin: String(row.gtin),
    name: s(row.name),
    names: rec(row.names),
    brand: s(row.brand),
    quantityText: s(row.quantity_text),
    netQuantity: n(row.net_quantity) ?? null,
    netQuantityUnit: row.net_quantity_unit === 'g' || row.net_quantity_unit === 'ml' ? row.net_quantity_unit : null,
    servingSizeText: s(row.serving_size_text),
    servingQuantity: n(row.serving_quantity) ?? null,
    basis: row.basis === '100ml' ? '100ml' : '100g',
    nutrientsPer100: nutrientsFromRow(row),
    nutritionAvailable: row.nutrition_available === true,
    categories: arr(row.categories),
    categoryMain: s(row.category_main),
    countries: arr(row.countries),
    ingredientsText: s(row.ingredients_text),
    ingredientsTexts: rec(row.ingredients_texts),
    allergens: arr(row.allergens) as CatalogProduct['allergens'],
    traces: arr(row.traces) as CatalogProduct['traces'],
    additives: arr(row.additives),
    labels: arr(row.labels),
    nutriscoreGrade: (s(row.nutriscore_grade) as CatalogProduct['nutriscoreGrade']) ?? null,
    nutriscoreVersion: s(row.nutriscore_version),
    novaGroup: n(row.nova_group) ?? null,
    nutriscoreInputs: parseNutriscoreInputs(row.nutriscore_inputs),
    imageUrl: s(row.image_url),
    imageIngredientsUrl: s(row.image_ingredients_url),
    imageNutritionUrl: s(row.image_nutrition_url),
    source: row.source as CatalogProduct['source'],
    sourceId: String(row.source_id),
    sourceUrl: s(row.source_url),
    license: String(row.license),
    sourceLastModified: s(row.source_last_modified),
    warnings: arr(row.warnings) as CatalogProduct['warnings'],
    verificationStatus: row.verification_status as CatalogProduct['verificationStatus'],
    importedAt: String(row.imported_at),
    updatedAt: String(row.updated_at),
  };
}

/** Columns written when importing a normalised product (service role only). */
export function productToRow(p: Product, slug: string): Row {
  const v = p.nutrientsPer100;
  return {
    gtin: p.gtin,
    slug,
    name: p.name,
    names: p.names,
    brand: p.brand,
    quantity_text: p.quantityText,
    net_quantity: p.netQuantity,
    net_quantity_unit: p.netQuantityUnit,
    serving_size_text: p.servingSizeText,
    serving_quantity: p.servingQuantity,
    basis: p.basis,
    energy_kcal: v.energy_kcal,
    protein_g: v.protein_g,
    carbs_g: v.carbs_g,
    sugars_g: v.sugars_g,
    fat_g: v.fat_g,
    saturated_fat_g: v.saturated_fat_g,
    fiber_g: v.fiber_g,
    salt_g: v.salt_g,
    nutrition_available: p.nutritionAvailable,
    categories: p.categories,
    category_main: p.categoryMain,
    countries: p.countries,
    ingredients_text: p.ingredientsText,
    ingredients_texts: p.ingredientsTexts,
    allergens: p.allergens,
    traces: p.traces,
    additives: p.additives,
    labels: p.labels,
    nutriscore_grade: p.nutriscoreGrade,
    nutriscore_version: p.nutriscoreVersion,
    nova_group: p.novaGroup,
    nutriscore_inputs: p.nutriscoreInputs,
    image_url: p.imageUrl,
    image_ingredients_url: p.imageIngredientsUrl,
    image_nutrition_url: p.imageNutritionUrl,
    source: p.source,
    source_id: p.sourceId,
    source_url: p.sourceUrl,
    license: p.license,
    source_last_modified: p.sourceLastModified,
    warnings: p.warnings,
    refreshed_at: new Date().toISOString(),
  };
}

/** URL-safe slug for a product page: "<brand>-<name>-<gtin>". */
export function productSlug(p: Pick<Product, 'gtin' | 'name' | 'brand'>): string {
  const base = [p.brand, p.name]
    .filter(Boolean)
    .join(' ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return base ? `${base}-${p.gtin}` : p.gtin;
}

function parseNutriscoreInputs(value: unknown): NutriScoreInputs | null {
  if (!value) return null;
  const parsed = NutriScoreInputsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
