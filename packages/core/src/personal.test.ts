import { describe, expect, it } from 'vitest';
import { nutrients } from './nutrients';
import { personalNotes, type PersonalProduct } from './personal';

const yogurt: PersonalProduct = {
  allergens: ['milk'],
  traces: ['nuts'],
  basis: '100g',
  nutrientsPer100: nutrients({ energy_kcal: 57, protein_g: 10, fat_g: 0.2, carbs_g: 3.5 }),
};

describe('personalNotes', () => {
  it('warns about declared allergens and traces the person listed', () => {
    const notes = personalNotes(yogurt, { goals: [], allergies: ['milk', 'nuts'], diet: null });
    expect(notes.slice(0, 2)).toEqual([
      { key: 'contains_allergen', tone: 'warning', allergens: ['milk'] },
      { key: 'may_contain_allergen', tone: 'warning', allergens: ['nuts'] },
    ]);
  });

  it('says nothing when there is nothing personal to say', () => {
    expect(personalNotes(yogurt, { goals: ['eat_balanced'], allergies: [], diet: 'omnivore' })).toEqual([]);
  });

  it('uses the EU protein claim thresholds for protein goals', () => {
    expect(personalNotes(yogurt, { goals: ['increase_protein'], allergies: [], diet: null })).toEqual([{ key: 'protein_fit', tone: 'positive', value: 70 }]);
    const crisps: PersonalProduct = { allergens: [], traces: [], basis: '100g', nutrientsPer100: nutrients({ energy_kcal: 528, protein_g: 6.2 }) };
    expect(personalNotes(crisps, { goals: ['build_muscle'], allergies: [], diet: null })).toEqual([{ key: 'protein_low', tone: 'neutral', value: 5 }]);
  });

  it('points out energy density for weight-loss goals', () => {
    const spread: PersonalProduct = { allergens: [], traces: [], basis: '100g', nutrientsPer100: nutrients({ energy_kcal: 539 }) };
    expect(personalNotes(spread, { goals: ['lose_weight'], allergies: [], diet: null })).toEqual([{ key: 'energy_dense', tone: 'neutral', value: 539 }]);
  });

  it('only reports animal-origin allergens for vegan and vegetarian diets', () => {
    expect(personalNotes(yogurt, { goals: [], allergies: [], diet: 'vegan' })).toEqual([{ key: 'animal_allergens_vegan', tone: 'neutral', allergens: ['milk'] }]);
    expect(personalNotes(yogurt, { goals: [], allergies: [], diet: 'vegetarian' })).toEqual([]);
  });
});
