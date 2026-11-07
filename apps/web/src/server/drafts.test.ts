import { describe, expect, it } from 'vitest';
import { nutrients, type GenericFood, type MealPhotoModelOutput, type ParsedLogModelOutput } from '@repo/core';
import { buildLabelDraft, buildParsedDraft, buildPhotoDraft, pickUnitPortion, resolveSpokenAmount, type CatalogLookup } from './drafts';

/**
 * Fixture catalogue for tests. Values mirror the USDA SR Legacy records used
 * in the seed (FDC 169757 rice, 171287 egg, 171413 olive oil, 171265 milk).
 */
function food(slug: string, nameEs: string, nameEn: string, per100: Partial<Record<string, number>>, portions: GenericFood['portions'] = []): GenericFood {
  return {
    id: `id-${slug}`,
    slug,
    nameEs,
    nameEn,
    category: 'other',
    basis: '100g',
    nutrientsPer100: nutrients(per100),
    portions,
    source: 'usda_fdc',
    sourceId: slug,
    sourceUrl: null,
    license: 'CC0',
    sourceVersion: 'SR Legacy 2018-04',
  };
}

const FOODS = [
  food('arroz-blanco-cocido', 'Arroz blanco cocido', 'White rice, long-grain, cooked', { energy_kcal: 130, protein_g: 2.69, carbs_g: 28.17, fat_g: 0.28 }),
  food('huevo', 'Huevo entero crudo', 'Egg, whole, raw', { energy_kcal: 143, protein_g: 12.56 }, [
    { id: 'p1', labelEs: '1 huevo pequeño', labelEn: '1 small', grams: 38 },
    { id: 'p2', labelEs: '1 huevo mediano', labelEn: '1 medium', grams: 44 },
    { id: 'p3', labelEs: '1 huevo grande', labelEn: '1 large', grams: 50 },
  ]),
  food('aceite-de-oliva', 'Aceite de oliva', 'Olive oil', { energy_kcal: 884, fat_g: 100 }, [
    { id: 'p4', labelEs: '1 cucharada', labelEn: '1 tablespoon', grams: 13.5 },
    { id: 'p5', labelEs: '1 taza', labelEn: '1 cup', grams: 216 },
  ]),
  food('leche-entera', 'Leche entera', 'Whole milk (3.25% fat)', { energy_kcal: 61 }, [
    { id: 'p6', labelEs: '100 ml', labelEn: '100 ml', grams: 103.1 },
    { id: 'p7', labelEs: '1 vaso (250 ml)', labelEn: '1 glass (250 ml)', grams: 257.8 },
  ]),
];

const catalog: CatalogLookup = {
  async foodsBySlug(slugs) {
    return new Map(FOODS.filter((f) => slugs.includes(f.slug)).map((f) => [f.slug, f]));
  },
  async candidates(query) {
    const q = query.toLowerCase();
    return FOODS.filter((f) => q.split(' ').some((w) => w.length > 2 && f.nameEn.toLowerCase().includes(w))).map((f) => ({ food: f, score: 0.7 }));
  },
};

describe('photo drafts', () => {
  const output: MealPhotoModelOutput = {
    is_food: true,
    image_issue: 'none',
    meal_name_es: 'Arroz con huevo',
    meal_name_en: 'Rice with egg',
    items: [
      { name_es: 'Arroz', name_en: 'Rice', catalog_slug: 'arroz-blanco-cocido', food_query: 'white rice cooked', estimated_grams: 180, min_grams: 140, max_grams: 220, confidence: 'high' },
      { name_es: 'Plátano frito', name_en: 'Fried plantain', catalog_slug: null, food_query: 'fried plantain', estimated_grams: 80, min_grams: 50, max_grams: 110, confidence: 'low' },
    ],
    questions: [
      {
        id: 'oil',
        question_es: '¿Se cocinó con aceite?',
        question_en: 'Was it cooked with oil?',
        if_yes_name_es: 'Aceite de oliva',
        if_yes_name_en: 'Olive oil',
        if_yes_catalog_slug: 'aceite-de-oliva',
        if_yes_food_query: 'olive oil',
        if_yes_grams: 10,
      },
    ],
  };

  it('matches catalogue foods and flags estimates and unmatched items', async () => {
    const draft = await buildPhotoDraft({ output, locale: 'es', catalog, draftId: 'd1', cached: false });
    expect(draft.title).toBe('Arroz con huevo');
    expect(draft.items[0]!.match?.id).toBe('id-arroz-blanco-cocido');
    expect(draft.items[0]!.match?.score).toBe(1);
    expect(draft.items[0]!.amountIsEstimate).toBe(true);
    expect(draft.items[1]!.match).toBeNull();
    expect(draft.notices).toEqual(expect.arrayContaining(['unmatched_items', 'low_confidence', 'quantities_estimated']));
    expect(draft.questions[0]!.item.match?.name).toBe('Aceite de oliva');
    expect(draft.questions[0]!.item.visible).toBe(false);
  });
});

describe('spoken amounts', () => {
  const egg = { kind: 'generic_food' as const, id: 'id-huevo', name: 'Huevo', basis: '100g' as const, nutrientsPer100: FOODS[1]!.nutrientsPer100, source: 'usda_fdc' as const, sourceId: 'huevo', score: 1, portions: FOODS[1]!.portions, servingQuantity: null };
  const milk = { ...egg, id: 'id-leche', portions: FOODS[3]!.portions };
  const base = { spoken_text: '', name_es: '', name_en: '', catalog_slug: null, food_query: '', estimated_grams: 120 };

  it('uses stated grams exactly', () => {
    expect(resolveSpokenAmount({ ...base, quantity: 150, unit: 'g', quantity_specified: true }, egg, 'es')).toEqual({ grams: 150, isEstimate: false, quantityLabel: '150 g' });
  });

  it('uses the USDA unit weight for counted items and marks it as an estimate', () => {
    expect(resolveSpokenAmount({ ...base, quantity: 2, unit: 'unit', quantity_specified: true }, egg, 'es')).toEqual({ grams: 88, isEstimate: true, quantityLabel: '2 × huevo mediano' });
  });

  it('converts millilitres with density derived from USDA portions', () => {
    expect(resolveSpokenAmount({ ...base, quantity: 200, unit: 'ml', quantity_specified: true }, milk, 'es')).toEqual({ grams: 206.2, isEstimate: false, quantityLabel: '200 ml' });
  });

  it('falls back to the model estimate when no amount was stated', () => {
    expect(resolveSpokenAmount({ ...base, quantity: null, unit: null, quantity_specified: false }, egg, 'es')).toMatchObject({ grams: 120, isEstimate: true });
  });

  it('picks a typical unit portion, never a volume measure', () => {
    expect(pickUnitPortion(FOODS[2]!.portions)).toBeNull();
    expect(pickUnitPortion(FOODS[1]!.portions)?.grams).toBe(44);
  });

  it('builds a parsed draft with meal type and day offset', async () => {
    const output: ParsedLogModelOutput = {
      intent: 'log_food',
      meal_type: 'breakfast',
      day_offset: -1,
      items: [{ spoken_text: 'dos huevos', name_es: 'Huevos', name_en: 'Eggs', catalog_slug: 'huevo', food_query: 'egg', quantity: 2, unit: 'unit', quantity_specified: true, estimated_grams: 100 }],
      clarification_es: null,
      clarification_en: null,
    };
    const draft = await buildParsedDraft({ output, locale: 'es', catalog, draftId: 'd2', source: 'voice', transcript: 'ayer desayuné dos huevos' });
    expect(draft).toMatchObject({ mealType: 'breakfast', dayOffset: -1, source: 'voice', transcript: 'ayer desayuné dos huevos' });
    expect(draft.items[0]).toMatchObject({ grams: 88, quantityLabel: '2 × huevo mediano', amountIsEstimate: true });
  });
});

describe('label drafts', () => {
  const nutrition = { energy_kj: 1046, energy_kcal: 250, fat_g: 10, saturated_fat_g: 2, carbs_g: 30, sugars_g: 5, fiber_g: 3, protein_g: 8, salt_g: 1.2, sodium_g: null };

  it('converts per-serving labels to per 100 g', () => {
    const draft = buildLabelDraft(
      { legibility: 'good', basis: 'per_serving', serving_size_g: 50, product_name: null, brand: null, net_quantity_text: null, nutrition, ingredients_text: null, allergens_mentioned: [], low_confidence_fields: [] },
      'l1',
    );
    expect(draft.basis).toBe('serving');
    expect(draft.nutrientsPer100?.energy_kcal).toBe(500);
    expect(draft.nutrientsPer100?.salt_g).toBe(2.4);
  });

  it('does not invent per-100 values when the basis is unknown', () => {
    const draft = buildLabelDraft(
      { legibility: 'partial', basis: 'unknown', serving_size_g: null, product_name: null, brand: null, net_quantity_text: null, nutrition, ingredients_text: null, allergens_mentioned: [], low_confidence_fields: ['salt_g'] },
      'l2',
    );
    expect(draft.nutrientsPer100).toBeNull();
    expect(draft.lowConfidenceFields).toEqual(['salt_g']);
  });
});
