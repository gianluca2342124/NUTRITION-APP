import type { Allergen } from './allergens';
import type { NutrientValues } from './nutrients';
import type { Basis } from './products';
import type { DietPattern } from './profile';
import type { Goal } from './targets';

/**
 * "Para ti": how a product fits the person's declared allergies, diet and
 * goals. Separate from the Fudyu Score (which is the same for everyone) and
 * never changes it. Only declared data is used; nothing is inferred.
 */

export interface PersonalContext {
  goals: readonly Goal[];
  allergies: readonly Allergen[];
  diet: DietPattern | null;
}

export type PersonalNoteKey =
  | 'contains_allergen'
  | 'may_contain_allergen'
  | 'animal_allergens_vegan'
  | 'animal_allergens_vegetarian'
  | 'protein_fit'
  | 'protein_low'
  | 'energy_dense'
  | 'energy_light';

export interface PersonalNote {
  key: PersonalNoteKey;
  tone: 'warning' | 'positive' | 'neutral';
  allergens?: Allergen[];
  value?: number;
}

export interface PersonalProduct {
  allergens: readonly Allergen[];
  traces: readonly Allergen[];
  nutrientsPer100: NutrientValues;
  basis: Basis;
}

const ANIMAL_ALLERGENS: Allergen[] = ['milk', 'eggs', 'fish', 'crustaceans', 'molluscs'];
const SEAFOOD_ALLERGENS: Allergen[] = ['fish', 'crustaceans', 'molluscs'];

export function personalNotes(product: PersonalProduct, ctx: PersonalContext): PersonalNote[] {
  const notes: PersonalNote[] = [];
  const contains = product.allergens.filter((a) => ctx.allergies.includes(a));
  if (contains.length) notes.push({ key: 'contains_allergen', tone: 'warning', allergens: contains });
  const traces = product.traces.filter((a) => ctx.allergies.includes(a) && !contains.includes(a));
  if (traces.length) notes.push({ key: 'may_contain_allergen', tone: 'warning', allergens: traces });

  if (ctx.diet === 'vegan') {
    const animal = product.allergens.filter((a) => ANIMAL_ALLERGENS.includes(a));
    if (animal.length) notes.push({ key: 'animal_allergens_vegan', tone: 'neutral', allergens: animal });
  } else if (ctx.diet === 'vegetarian') {
    const seafood = product.allergens.filter((a) => SEAFOOD_ALLERGENS.includes(a));
    if (seafood.length) notes.push({ key: 'animal_allergens_vegetarian', tone: 'neutral', allergens: seafood });
  }

  const v = product.nutrientsPer100;
  const kcal = v.energy_kcal;
  if ((ctx.goals.includes('increase_protein') || ctx.goals.includes('build_muscle')) && v.protein_g != null && kcal != null && kcal > 0) {
    const share = Math.round(((v.protein_g * 4) / kcal) * 100);
    // Regulation (EC) 1924/2006: "high protein" ≥ 20 % of energy; "source of protein" ≥ 12 %.
    if (share >= 20) notes.push({ key: 'protein_fit', tone: 'positive', value: share });
    else if (share < 12) notes.push({ key: 'protein_low', tone: 'neutral', value: share });
  }
  if (ctx.goals.includes('lose_weight') && kcal != null) {
    const liquid = product.basis === '100ml';
    if (kcal >= (liquid ? 70 : 400)) notes.push({ key: 'energy_dense', tone: 'neutral', value: Math.round(kcal) });
    else if (kcal <= (liquid ? 20 : 40)) notes.push({ key: 'energy_light', tone: 'positive', value: Math.round(kcal) });
  }
  return notes;
}
