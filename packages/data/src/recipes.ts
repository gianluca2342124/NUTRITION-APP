import type { SupabaseClient } from '@supabase/supabase-js';
import type { MealType, Recipe, RecipeIngredient } from '@repo/core';
import { nutrientsFromRow } from './mappers';

const RECIPE_SELECT =
  'id, slug, title_es, title_en, summary_es, summary_en, minutes, servings, meal_types, vegetarian, steps_es, steps_en, image_key, recipe_ingredients(position, grams, label_es, label_en, generic_foods(id, slug, name_es, name_en, category, basis, energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, salt_g))';

type Row = Record<string, unknown>;

function mapRecipe(r: Row): Recipe {
  const ingredients = ((r.recipe_ingredients as Row[] | null) ?? [])
    .map((i): RecipeIngredient => {
      const f = (Array.isArray(i.generic_foods) ? i.generic_foods[0] : i.generic_foods) as Row;
      return {
        position: Number(i.position),
        foodId: String(f.id),
        foodSlug: String(f.slug),
        foodNameEs: String(f.name_es),
        foodNameEn: String(f.name_en),
        category: String(f.category),
        basis: f.basis === '100ml' ? '100ml' : '100g',
        grams: Number(i.grams),
        labelEs: String(i.label_es),
        labelEn: String(i.label_en),
        per100: nutrientsFromRow(f),
      };
    })
    .sort((a, b) => a.position - b.position);
  return {
    id: String(r.id),
    slug: String(r.slug),
    titleEs: String(r.title_es),
    titleEn: String(r.title_en),
    summaryEs: (r.summary_es as string | null) ?? null,
    summaryEn: (r.summary_en as string | null) ?? null,
    minutes: Number(r.minutes),
    servings: Number(r.servings),
    mealTypes: (r.meal_types as MealType[] | null) ?? [],
    vegetarian: r.vegetarian === true,
    stepsEs: (r.steps_es as string[] | null) ?? [],
    stepsEn: (r.steps_en as string[] | null) ?? [],
    imageKey: (r.image_key as string | null) ?? null,
    ingredients,
  };
}

export async function listRecipes(client: SupabaseClient): Promise<Recipe[]> {
  const { data, error } = await client.from('recipes').select(RECIPE_SELECT).order('minutes');
  if (error) throw error;
  return (data ?? []).map((r) => mapRecipe(r as Row));
}

export async function getRecipe(client: SupabaseClient, slug: string): Promise<Recipe | null> {
  const { data, error } = await client.from('recipes').select(RECIPE_SELECT).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? mapRecipe(data as Row) : null;
}
