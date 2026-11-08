import Link from 'next/link';
import { formatNumber, recipeNutrition, recipeTags, type Recipe, type RecipeTag } from '@repo/core';
import { curatedFoodImage } from '@repo/data';
import { format } from '@repo/i18n';
import { FoodImage } from './food-image';
import { LOCALE, t } from '@/lib/site';

const NUTRITION_TAGS: RecipeTag[] = ['high_protein', 'high_fiber', 'protein_source', 'fiber_source'];

/** Recipe card: large photo (or illustration), title, time, servings and one data-justified tag. */
export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const n = recipeNutrition(recipe);
  const tags = recipeTags(recipe, n);
  const tag = NUTRITION_TAGS.find((x) => tags.includes(x));
  return (
    <Link href={`/recetas/${recipe.slug}`} className="card group block h-full overflow-hidden p-0 transition hover:-translate-y-0.5">
      <div className="relative">
        <FoodImage src={curatedFoodImage(recipe.imageKey)?.wide} alt="" fallback="recipe" className="aspect-[4/3] w-full" />
        {tag ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-ink shadow-sm">{t.recipes.tags[tag]}</span>
        ) : null}
      </div>
      <div className="p-4">
        <p className="text-[17px] font-semibold leading-snug text-ink">{recipe.titleEs}</p>
        <p className="tabular mt-1 text-[13px] text-muted">
          {format(t.recipes.minutes, { value: recipe.minutes })} · {recipe.servings === 1 ? t.recipes.servingOne : format(t.recipes.servings, { value: recipe.servings })} ·{' '}
          {formatNumber(n.perServing.energy_kcal ?? 0, LOCALE)} kcal/{t.recipes.servingOne.replace('1 ', '')}
        </p>
      </div>
    </Link>
  );
}
