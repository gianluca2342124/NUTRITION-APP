import {
  round,
  validateLabelNutrition,
  type Basis,
  type DraftItem,
  type DraftQuestion,
  type FoodMatch,
  type GenericFood,
  type LabelDraft,
  type LabelModelOutput,
  type LabelNutrition,
  type MealDraft,
  type MealPhotoModelOutput,
  type ParsedLogModelOutput,
  type Portion,
} from '@repo/core';

/**
 * Turns model perception (foods + amounts) into reviewable drafts whose
 * nutrients come exclusively from catalogue data. Pure apart from the injected
 * catalogue lookup, so it is unit-testable without a database.
 */

export interface CatalogLookup {
  foodsBySlug(slugs: string[]): Promise<Map<string, GenericFood>>;
  candidates(query: string, limit: number): Promise<{ food: GenericFood; score: number }[]>;
}

/** Minimum similarity for accepting a fallback text match without user choice. */
export const MATCH_THRESHOLD = 0.6;

type Locale = 'es' | 'en';

export function toFoodMatch(food: GenericFood, score: number, locale: Locale): FoodMatch {
  return {
    kind: 'generic_food',
    id: food.id,
    name: locale === 'en' ? food.nameEn : food.nameEs,
    basis: food.basis,
    nutrientsPer100: food.nutrientsPer100,
    source: food.source,
    sourceId: food.sourceId,
    score: Math.max(0, Math.min(1, round(score, 3))),
    portions: food.portions,
    servingQuantity: null,
  };
}

async function resolveFood(
  slug: string | null,
  query: string,
  bySlug: Map<string, GenericFood>,
  catalog: CatalogLookup,
  locale: Locale,
): Promise<{ match: FoodMatch | null; alternatives: FoodMatch[] }> {
  const candidates = (await catalog.candidates(query, 4)).map((c) => toFoodMatch(c.food, c.score, locale));
  const exact = slug ? bySlug.get(slug) : undefined;
  if (exact) {
    return { match: toFoodMatch(exact, 1, locale), alternatives: candidates.filter((c) => c.id !== exact.id).slice(0, 3) };
  }
  const best = candidates[0];
  if (best && best.score >= MATCH_THRESHOLD) return { match: best, alternatives: candidates.slice(1, 4) };
  return { match: null, alternatives: candidates.slice(0, 3) };
}

/* ------------------------------- photo drafts ------------------------------ */

export async function buildPhotoDraft(args: {
  output: MealPhotoModelOutput;
  locale: Locale;
  catalog: CatalogLookup;
  draftId: string;
  cached: boolean;
}): Promise<MealDraft> {
  const { output, locale, catalog } = args;
  const slugs = [
    ...output.items.map((i) => i.catalog_slug),
    ...output.questions.map((q) => q.if_yes_catalog_slug),
  ].filter((s): s is string => !!s);
  const bySlug = await catalog.foodsBySlug(Array.from(new Set(slugs)));

  const items: DraftItem[] = await Promise.all(
    output.items.map(async (it, idx) => {
      const { match, alternatives } = await resolveFood(it.catalog_slug, it.food_query, bySlug, catalog, locale);
      return {
        key: `i${idx}`,
        label: locale === 'en' ? it.name_en : it.name_es,
        foodQuery: it.food_query,
        grams: it.estimated_grams,
        gramsRange: [it.min_grams, it.max_grams] as [number, number],
        quantityLabel: null,
        amountIsEstimate: true,
        confidence: it.confidence,
        visible: true,
        match,
        alternatives,
      };
    }),
  );

  const questions: DraftQuestion[] = await Promise.all(
    output.questions.map(async (q, idx) => {
      const { match, alternatives } = await resolveFood(q.if_yes_catalog_slug, q.if_yes_food_query, bySlug, catalog, locale);
      return {
        id: q.id || `q${idx}`,
        text: locale === 'en' ? q.question_en : q.question_es,
        item: {
          key: `q${idx}`,
          label: locale === 'en' ? q.if_yes_name_en : q.if_yes_name_es,
          foodQuery: q.if_yes_food_query,
          grams: q.if_yes_grams,
          gramsRange: null,
          quantityLabel: null,
          amountIsEstimate: true,
          confidence: null,
          visible: false,
          match,
          alternatives,
        },
      };
    }),
  );

  const notices: MealDraft['notices'] = [];
  if (!output.is_food || output.image_issue === 'not_food') notices.push('not_food');
  if (output.image_issue === 'blurry') notices.push('image_blurry');
  if (output.image_issue === 'too_dark') notices.push('image_too_dark');
  if (output.image_issue === 'partial_view') notices.push('partial_view');
  if (items.some((i) => i.confidence === 'low')) notices.push('low_confidence');
  if (items.some((i) => !i.match)) notices.push('unmatched_items');
  if (items.length) notices.push('quantities_estimated');

  return {
    draftId: args.draftId,
    source: 'photo',
    title: (locale === 'en' ? output.meal_name_en : output.meal_name_es) || '',
    mealType: null,
    dayOffset: 0,
    items,
    questions,
    notices,
    clarification: null,
    transcript: null,
    cached: args.cached,
  };
}

/* --------------------------- spoken / typed drafts -------------------------- */

const HOUSEHOLD_UNIT_PATTERNS: Record<string, RegExp> = {
  tablespoon: /\b(tbsp|tablespoon)\b/i,
  teaspoon: /\btsp\b/i,
  cup: /\bcup\b/i,
  slice: /\bslice\b/i,
  glass: /\bglass\b/i,
};

/** Typical single unit of a food ("1 medium apple"), never a volume measure. */
export function pickUnitPortion(portions: readonly Portion[]): Portion | null {
  const units = portions.filter((p) => !/\b(cup|tbsp|tsp|tablespoon|ml|NLEA)\b/i.test(p.labelEn));
  return units.find((p) => /\bmedium\b/i.test(p.labelEn)) ?? units[0] ?? null;
}

function portionLabel(qty: number, portion: Portion, locale: Locale): string {
  const label = (locale === 'en' ? portion.labelEn : portion.labelEs).replace(/^1\s+/, '');
  return `${String(qty).replace('.', locale === 'es' ? ',' : '.')} × ${label}`;
}

export function resolveSpokenAmount(
  item: ParsedLogModelOutput['items'][number],
  match: FoodMatch | null,
  locale: Locale,
): { grams: number; isEstimate: boolean; quantityLabel: string | null } {
  const fallback = () => ({
    grams: item.estimated_grams ?? (match ? (pickUnitPortion(match.portions)?.grams ?? 100) : 100),
    isEstimate: true,
    quantityLabel: null,
  });
  const q = item.quantity;
  const unit = item.unit;
  if (!item.quantity_specified || q == null || unit == null) return fallback();

  if (unit === 'g') return { grams: q, isEstimate: false, quantityLabel: `${q} g` };
  if (unit === 'ml') {
    if (match?.basis === '100ml') return { grams: q, isEstimate: false, quantityLabel: `${q} ml` };
    const per100ml = match?.portions.find((p) => p.labelEn === '100 ml');
    if (per100ml) return { grams: round((q * per100ml.grams) / 100, 1), isEstimate: false, quantityLabel: `${q} ml` };
    return { grams: q, isEstimate: true, quantityLabel: `${q} ml` };
  }
  if (!match) return fallback();

  let portion: Portion | null = null;
  if (unit === 'unit') portion = pickUnitPortion(match.portions);
  else if (HOUSEHOLD_UNIT_PATTERNS[unit]) portion = match.portions.find((p) => HOUSEHOLD_UNIT_PATTERNS[unit]!.test(p.labelEn)) ?? null;
  if (!portion) return fallback();
  return { grams: round(q * portion.grams, 1), isEstimate: true, quantityLabel: portionLabel(q, portion, locale) };
}

export async function buildParsedDraft(args: {
  output: ParsedLogModelOutput;
  locale: Locale;
  catalog: CatalogLookup;
  draftId: string;
  source: 'voice' | 'text';
  transcript: string | null;
}): Promise<MealDraft> {
  const { output, locale, catalog } = args;
  const slugs = output.items.map((i) => i.catalog_slug).filter((s): s is string => !!s);
  const bySlug = await catalog.foodsBySlug(Array.from(new Set(slugs)));

  const items: DraftItem[] = await Promise.all(
    output.items.map(async (it, idx) => {
      const { match, alternatives } = await resolveFood(it.catalog_slug, it.food_query, bySlug, catalog, locale);
      const amount = resolveSpokenAmount(it, match, locale);
      return {
        key: `i${idx}`,
        label: locale === 'en' ? it.name_en : it.name_es,
        foodQuery: it.food_query,
        grams: amount.grams,
        gramsRange: null,
        quantityLabel: amount.quantityLabel,
        amountIsEstimate: amount.isEstimate,
        confidence: null,
        visible: true,
        match,
        alternatives,
      };
    }),
  );

  const notices: MealDraft['notices'] = [];
  if (output.intent !== 'log_food') notices.push('not_a_food_log');
  const clarification = locale === 'en' ? output.clarification_en : output.clarification_es;
  if (clarification) notices.push('clarification_needed');
  if (items.some((i) => !i.match)) notices.push('unmatched_items');
  if (items.some((i) => i.amountIsEstimate)) notices.push('quantities_estimated');

  return {
    draftId: args.draftId,
    source: args.source,
    title: items
      .slice(0, 3)
      .map((i) => i.label)
      .join(', '),
    mealType: output.meal_type,
    dayOffset: output.day_offset,
    items,
    questions: [],
    notices,
    clarification: clarification ?? null,
    transcript: args.transcript,
    cached: false,
  };
}

/* ------------------------------- label drafts ------------------------------ */

export function buildLabelDraft(output: LabelModelOutput, draftId: string): LabelDraft {
  const basis: LabelDraft['basis'] =
    output.basis === 'per_100g' ? '100g' : output.basis === 'per_100ml' ? '100ml' : output.basis === 'per_serving' ? 'serving' : 'unknown';

  let per100: LabelNutrition | null = null;
  let target: Basis | null = null;
  if (basis === '100g' || basis === '100ml') {
    per100 = output.nutrition;
    target = basis;
  } else if (basis === 'serving' && output.serving_size_g) {
    const factor = 100 / output.serving_size_g;
    per100 = Object.fromEntries(
      Object.entries(output.nutrition).map(([k, v]) => [k, v == null ? null : round(v * factor, 3)]),
    ) as LabelNutrition;
    target = '100g';
  }

  const validation = per100 && target ? validateLabelNutrition(per100, target) : validateLabelNutrition(output.nutrition, '100g');
  return {
    draftId,
    legibility: output.legibility,
    basis,
    servingSizeG: output.serving_size_g,
    productName: output.product_name,
    brand: output.brand,
    netQuantityText: output.net_quantity_text,
    raw: output.nutrition,
    nutrientsPer100: per100 && target ? validation.nutrients : null,
    issues: per100 ? validation.issues : validation.issues.filter((i) => i.code !== 'macros_exceed_basis' && i.code !== 'value_out_of_range'),
    ingredientsText: output.ingredients_text,
    allergens: output.allergens_mentioned,
    lowConfidenceFields: output.low_confidence_fields,
  };
}
