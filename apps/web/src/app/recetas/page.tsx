import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { RECIPE_FILTERS, recipeMatches, recipeNutrition, recipeTags, type RecipeFilter } from '@repo/core';
import { Character } from '@/components/art';
import { RecipeCard } from '@/components/recipe-card';
import { allRecipes } from '@/lib/data';
import { t } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Recetas sencillas con información nutricional',
  description: 'Recetas editoriales de Fudyu para desayunos, comidas, cenas y snacks, con calorías y nutrientes calculados con datos de USDA.',
  alternates: { canonical: '/recetas' },
};

export default function RecipesPage({ searchParams }: PageProps<'/recetas'>) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <h1 className="text-[38px] font-extrabold tracking-[-0.03em] text-ink sm:text-[46px]">{t.recipes.title}</h1>
      <p className="mt-2 max-w-2xl text-[17px] text-muted">{t.recipes.subtitle}</p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-[28px] bg-surface-muted" />}>
        <RecipeGrid searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function RecipeGrid({ searchParams }: { searchParams: PageProps<'/recetas'>['searchParams'] }) {
  const params = await searchParams;
  const raw = typeof params.f === 'string' ? params.f : null;
  const filter = (RECIPE_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as RecipeFilter) : null;
  const recipes = await allRecipes();
  const shown = recipes.filter((r) => recipeMatches(r, recipeTags(r, recipeNutrition(r)), filter));
  return (
    <>
      <nav aria-label="Filtros" className="mt-6 flex flex-wrap gap-2">
        {[null, ...RECIPE_FILTERS].map((f) => {
          const active = f === filter;
          return (
            <Link
              key={f ?? 'all'}
              href={f ? `/recetas?f=${f}` : '/recetas'}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full px-4 py-2 text-[14px] font-semibold transition ${active ? 'bg-primary text-on-primary' : 'border border-line bg-surface text-muted hover:text-ink'}`}
            >
              {f ? t.recipes.filters[f] : t.recipes.filters.all}
            </Link>
          );
        })}
      </nav>
      {shown.length ? (
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <li key={r.id}>
              <RecipeCard recipe={r} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <Character expression="curious" size={80} />
          <p className="text-[16px] text-muted">{t.recipes.empty}</p>
        </div>
      )}
      <p className="mt-8 text-[13px] text-faint">{t.recipes.editorial}</p>
    </>
  );
}
