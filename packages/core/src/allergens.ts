/**
 * The 14 allergen groups that must be declared in the EU
 * (Regulation (EU) No 1169/2011, Annex II).
 */
export const EU_ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;
export type Allergen = (typeof EU_ALLERGENS)[number];

const OFF_TAG_TO_ALLERGEN: Record<string, Allergen> = {
  'en:gluten': 'gluten',
  'en:crustaceans': 'crustaceans',
  'en:eggs': 'eggs',
  'en:fish': 'fish',
  'en:peanuts': 'peanuts',
  'en:soybeans': 'soybeans',
  'en:milk': 'milk',
  'en:nuts': 'nuts',
  'en:celery': 'celery',
  'en:mustard': 'mustard',
  'en:sesame-seeds': 'sesame',
  'en:sulphur-dioxide-and-sulphites': 'sulphites',
  'en:lupin': 'lupin',
  'en:molluscs': 'molluscs',
};

export function allergensFromOffTags(tags: readonly string[] | null | undefined): Allergen[] {
  const out = new Set<Allergen>();
  for (const tag of tags ?? []) {
    const a = OFF_TAG_TO_ALLERGEN[tag];
    if (a) out.add(a);
  }
  return EU_ALLERGENS.filter((a) => out.has(a));
}

export function isAllergen(value: string): value is Allergen {
  return (EU_ALLERGENS as readonly string[]).includes(value);
}
