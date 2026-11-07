import { describe, expect, it } from 'vitest';
import { normalizeOffProduct, offProductUrl, type OffProduct } from './off';

/**
 * Fixture: trimmed copy of the public Open Food Facts record for barcode
 * 3017624010701 (fields as returned by API v2, November 2026). Test data only.
 */
const nutellaFixture: OffProduct = {
  code: '3017624010701',
  product_name: 'Nutella',
  brands: 'Ferrero',
  quantity: '400.0 g',
  product_quantity: 400,
  product_quantity_unit: 'g',
  nutrition_data_per: '100g',
  nutriments: {
    'energy-kcal_100g': 539,
    'energy-kj_100g': 2228,
    fat_100g: 30.9,
    'saturated-fat_100g': 10.6,
    carbohydrates_100g: 57.5,
    sugars_100g: 56.3,
    proteins_100g: 6.3,
    salt_100g: 0.1075,
    sodium_100g: 0.043,
  },
  categories_tags: ['en:breakfasts', 'en:spreads', 'en:sweet-spreads', 'fr:pates-a-tartiner', 'en:hazelnut-spreads'],
  categories_hierarchy: ['en:breakfasts', 'en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'],
  countries_tags: ['en:france', 'en:united-kingdom'],
  ingredients_text: 'Sugar, palm oil, hazelnuts 13%…',
  lang: 'en',
  allergens_tags: ['en:nuts'],
  traces_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
  additives_tags: [],
  nutriscore_grade: 'e',
  nutriscore_version: '2023',
  image_front_url: 'https://images.openfoodfacts.org/images/products/301/762/401/0701/front_en.100.400.jpg',
  last_modified_t: 1790963552,
  data_quality_errors_tags: [],
  product_type: 'food',
};

describe('normalizeOffProduct', () => {
  it('maps the OFF payload to the platform product shape', () => {
    const p = normalizeOffProduct(nutellaFixture);
    expect(p).not.toBeNull();
    expect(p!.gtin).toBe('3017624010701');
    expect(p!.brand).toBe('Ferrero');
    expect(p!.basis).toBe('100g');
    expect(p!.netQuantity).toBe(400);
    expect(p!.nutrientsPer100.energy_kcal).toBe(539);
    expect(p!.nutrientsPer100.fiber_g).toBeNull();
    expect(p!.nutritionAvailable).toBe(true);
    expect(p!.warnings).toContain('partial_nutrition');
    expect(p!.allergens).toEqual(['nuts']);
    expect(p!.traces).toEqual(['soybeans', 'milk', 'nuts']);
    expect(p!.categories).not.toContain('pates-a-tartiner');
    expect(p!.categoryMain).toBe('hazelnut-spreads');
    expect(p!.nutriscoreGrade).toBe('e');
    expect(p!.novaGroup).toBeNull();
    expect(p!.names.en).toBe('Nutella');
    expect(p!.license).toContain('ODbL');
    expect(p!.sourceLastModified).toBe(new Date(1790963552 * 1000).toISOString());
  });

  it('derives kcal from kJ and salt from sodium, and says so', () => {
    const p = normalizeOffProduct({
      ...nutellaFixture,
      nutriments: { 'energy-kj_100g': 418.4, sodium_100g: 0.4, proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 20 },
    });
    expect(p!.nutrientsPer100.energy_kcal).toBe(100);
    expect(p!.nutrientsPer100.salt_g).toBe(1);
    expect(p!.warnings).toEqual(expect.arrayContaining(['energy_derived_from_kj', 'salt_derived_from_sodium']));
  });

  it('treats liquids per 100 ml', () => {
    const p = normalizeOffProduct({ ...nutellaFixture, quantity: '1 L', product_quantity: 1000, product_quantity_unit: 'ml' });
    expect(p!.basis).toBe('100ml');
    expect(p!.netQuantityUnit).toBe('ml');
  });

  it('marks missing nutrition instead of inventing values', () => {
    const p = normalizeOffProduct({ ...nutellaFixture, nutriments: {}, ingredients_text: '' });
    expect(p!.nutritionAvailable).toBe(false);
    expect(p!.nutrientsPer100.energy_kcal).toBeNull();
    expect(p!.warnings).toEqual(expect.arrayContaining(['missing_nutrition', 'missing_ingredients']));
  });

  it('rejects invalid barcodes and non-food products', () => {
    expect(normalizeOffProduct({ ...nutellaFixture, code: '123' })).toBeNull();
    expect(normalizeOffProduct({ ...nutellaFixture, product_type: 'beauty' })).toBeNull();
  });

  it('builds a field-limited API URL', () => {
    expect(offProductUrl('3017624010701')).toMatch(/^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/3017624010701\.json\?fields=code,/);
  });
});
