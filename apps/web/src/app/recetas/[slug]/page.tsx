import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatNumber, recipeNutrition, recipeTags } from '@repo/core';
import { curatedFoodImage } from '@repo/data';
import { format } from '@repo/i18n';
import { PageSkeleton } from '@/components/page-skeleton';
import { Breadcrumbs, Pill } from '@/components/breadcrumbs';
import { FoodImage } from '@/components/food-image';
import { NutritionTable } from '@/components/nutrition-table';
import { allRecipes, recipeBySlug } from '@/lib/data';
import { LOCALE, t } from '@/lib/site';

export async function generateStaticParams() {
  const recipes = await allRecipes();
  return recipes.length ? recipes.map((r) => ({ slug: r.slug })) : [{ slug: '__placeholder__' }];
}

export async function generateMetadata({ params }: PageProps<'/recetas/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const r = await recipeBySlug(slug);
  if (!r) return { title: 'No encontrado', robots: { index: false } };
  return { title: `${r.titleEs}: receta e información nutricional`, description: r.summaryEs ?? undefined, alternates: { canonical: `/recetas/${r.slug}` } };
}

/** The URL-dependent part streams inside Suspense (Partial Prefetching shell). */
export default function RecipePage({ params }: PageProps<'/recetas/[slug]'>) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RecipeContent params={params} />
    </Suspense>
  );
}

async function RecipeContent({ params }: { params: PageProps<'/recetas/[slug]'>['params'] }) {
  const { slug } = await params;
  const r = await recipeBySlug(slug);
  if (!r) notFound();
  const n = recipeNutrition(r);
  const tags = recipeTags(r, n);
  const image = curatedFoodImage(r.imageKey);
  const v = n.perServing;

  return (
    <article className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <Breadcrumbs
        items={[
          { name: 'Inicio', href: '/' },
          { name: t.recipes.title, href: '/recetas' },
          { name: r.titleEs, href: `/recetas/${r.slug}` },
        ]}
      />
      <div className="mt-6 grid grid-cols-1 items-start gap-8 md:grid-cols-2">
        <figure>
          <FoodImage src={image?.wide} alt="" fallback="recipe" className="aspect-[4/3] w-full rounded-[28px]" sizes="(min-width: 768px) 45vw, 92vw" priority />
          {image ? (
            <figcaption className="mt-2 text-[12px] text-faint">
              {t.recipes.illustrativePhoto} ·{' '}
              <a href={image.credit.sourceUrl} className="underline underline-offset-2" rel="noopener">
                {format(t.web.photoCredit, { author: image.credit.author, license: image.credit.license, source: image.credit.source })}
              </a>
            </figcaption>
          ) : null}
        </figure>
        <div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Pill key={tag} tone={tag === 'quick' || tag === 'vegetarian' ? 'neutral' : 'primary'}>
                {t.recipes.tags[tag]}
              </Pill>
            ))}
          </div>
          <h1 className="mt-3 text-[34px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[42px]">{r.titleEs}</h1>
          {r.summaryEs ? <p className="mt-3 text-[17px] leading-relaxed text-muted">{r.summaryEs}</p> : null}
          <p className="tabular mt-4 text-[15px] font-semibold text-ink">
            {format(t.recipes.minutes, { value: r.minutes })} · {r.servings === 1 ? t.recipes.servingOne : format(t.recipes.servings, { value: r.servings })}
          </p>
          <p className="card tabular mt-5 flex flex-wrap items-baseline gap-x-2 px-6 py-5 text-[17px] text-ink">
            <strong className="text-[22px] font-extrabold">{formatNumber(v.energy_kcal ?? 0, LOCALE)}</strong> kcal
            <span className="text-faint">·</span>
            <strong className="text-[22px] font-extrabold">{formatNumber(v.protein_g ?? 0, LOCALE)}</strong> g {t.nutrients.protein_g.toLowerCase()}
            <span className="text-faint">·</span>
            <strong className="text-[22px] font-extrabold">{formatNumber(v.carbs_g ?? 0, LOCALE)}</strong> g {t.nutrients.carbs_g.toLowerCase()}
            <span className="basis-full text-[13px] text-muted">{t.recipes.perServing}</span>
          </p>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.4fr]">
        <section>
          <h2 className="text-[22px] font-bold tracking-tight text-ink">{t.recipes.ingredients}</h2>
          <ul className="card mt-4 divide-y divide-line p-0">
            {r.ingredients.map((i) => (
              <li key={i.position} className="px-5 py-3.5 text-[15px]">
                <Link href={`/ingredients/${i.foodSlug}`} className="text-ink hover:text-primary-text">
                  {i.labelEs}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-[22px] font-bold tracking-tight text-ink">{t.recipes.steps}</h2>
          <ol className="mt-4 space-y-4">
            {r.stepsEs.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[14px] font-bold text-primary-text">{i + 1}</span>
                <p className="pt-1 text-[16px] leading-relaxed text-ink">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-[22px] font-bold tracking-tight text-ink">{t.web.nutritionFacts}</h2>
        <NutritionTable columns={[{ title: t.recipes.perServing, values: v }]} />
      </section>
      <p className="mt-8 text-[13px] text-faint">
        {t.recipes.editorial}. {t.disclaimer.notMedical}
      </p>
    </article>
  );
}
