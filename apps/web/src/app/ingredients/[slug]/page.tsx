import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatNumber, formatNutrient, scaleNutrients } from '@repo/core';
import { format } from '@repo/i18n';
import { curatedFoodImage } from '@repo/data';
import { PageSkeleton } from '@/components/page-skeleton';
import { Breadcrumbs, Pill } from '@/components/breadcrumbs';
import { Disclosure } from '@/components/disclosure';
import { FoodImage } from '@/components/food-image';
import { NutritionTable } from '@/components/nutrition-table';
import { RecipeCard } from '@/components/recipe-card';
import { allFoodSlugs, allRecipes, foodBySlug } from '@/lib/data';
import { LOCALE, t } from '@/lib/site';

export async function generateStaticParams() {
  const slugs = await allFoodSlugs();
  return slugs.length ? slugs.map((s) => ({ slug: s.slug })) : [{ slug: '__placeholder__' }];
}

export async function generateMetadata({ params }: PageProps<'/ingredients/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const food = await foodBySlug(slug);
  if (!food) return { title: 'No encontrado', robots: { index: false } };
  const v = food.nutrientsPer100;
  const description = `${food.nameEs}: ${formatNutrient('energy_kcal', v.energy_kcal, LOCALE)}, ${formatNutrient('protein_g', v.protein_g, LOCALE)} de proteínas, ${formatNutrient('carbs_g', v.carbs_g, LOCALE)} de hidratos y ${formatNutrient('fat_g', v.fat_g, LOCALE)} de grasas por 100 g. Datos de USDA FoodData Central.`;
  return {
    title: `${food.nameEs}: calorías y nutrientes`,
    description,
    alternates: { canonical: `/ingredients/${food.slug}` },
    openGraph: { title: `${food.nameEs}: calorías y nutrientes`, description },
  };
}

/** The URL-dependent part streams inside Suspense (Partial Prefetching shell). */
export default function IngredientPage({ params }: PageProps<'/ingredients/[slug]'>) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <IngredientContent params={params} />
    </Suspense>
  );
}

async function IngredientContent({ params }: { params: PageProps<'/ingredients/[slug]'>['params'] }) {
  const { slug } = await params;
  const food = await foodBySlug(slug);
  if (!food) notFound();
  const v = food.nutrientsPer100;
  const image = curatedFoodImage(food.slug);
  const related = (await allRecipes()).filter((r) => r.ingredients.some((i) => i.foodSlug === food.slug)).slice(0, 3);
  const compact = (['energy_kcal', 'protein_g', 'carbs_g', 'fat_g'] as const).map((key) => ({
    key,
    value: formatNutrient(key, v[key], LOCALE, { withUnit: false, unknown: '—' }),
    unit: key === 'energy_kcal' ? 'kcal' : 'g',
    label: key === 'energy_kcal' ? '' : t.nutrients[key].toLowerCase(),
  }));

  return (
    <article className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <Breadcrumbs
        items={[
          { name: 'Inicio', href: '/' },
          { name: t.foodCategories[food.category], href: `/search?q=${encodeURIComponent(food.nameEs.split(' ')[0] ?? '')}` },
          { name: food.nameEs, href: `/ingredients/${food.slug}` },
        ]}
      />

      <div className="mt-6 grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <figure>
          <FoodImage src={image?.wide} alt={food.nameEs} fallback={food.category} className="aspect-[4/3] w-full rounded-[28px]" sizes="(min-width: 768px) 45vw, 92vw" priority />
          {image ? (
            <figcaption className="mt-2 text-[12px] text-faint">
              <a href={image.credit.sourceUrl} className="underline underline-offset-2 hover:text-ink" rel="noopener">
                {format(t.web.photoCredit, { author: image.credit.author, license: image.credit.license, source: image.credit.source })}
              </a>
            </figcaption>
          ) : null}
        </figure>

        <div>
          <Pill tone="primary">{t.foodCategories[food.category]}</Pill>
          <h1 className="mt-3 text-[36px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[46px]">{food.nameEs}</h1>
          <p className="mt-1 text-[16px] text-muted">{food.nameEn}</p>
          <p className="mt-5 text-[17px] leading-relaxed text-ink">
            {format(t.web.foodSummary, { name: food.nameEs, kcal: formatNutrient('energy_kcal', v.energy_kcal, LOCALE, { withUnit: false, unknown: '—' }) })}
          </p>

          {/* One compact nutrition block */}
          <p className="card tabular mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1 px-6 py-5 text-[17px] text-ink" aria-label={t.web.foodPer100}>
            {compact.map((c, i) => (
              <span key={c.key} className="whitespace-nowrap">
                {i > 0 ? <span className="mr-2 text-faint">·</span> : null}
                <strong className="text-[22px] font-extrabold tracking-tight">{c.value}</strong> {c.unit} {c.label}
              </span>
            ))}
            <span className="basis-full text-[13px] text-muted">{t.web.foodPer100}</span>
          </p>

          {food.portions.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-[15px] font-semibold text-muted">{t.web.householdPortions}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {food.portions.map((portion) => {
                  const kcal = scaleNutrients(v, portion.grams).energy_kcal;
                  return (
                    <li key={portion.id} className="tabular rounded-full border border-line bg-surface px-4 py-2 text-[14px] text-ink">
                      {portion.labelEs} · {formatNumber(portion.grams, LOCALE, 1)} g
                      <span className="ml-1.5 font-semibold">{kcal != null ? `${formatNumber(kcal, LOCALE)} kcal` : '—'}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          <p className="mt-6 text-[13px] text-faint">{t.web.noScoreForFoods}</p>
        </div>
      </div>

      <section className="mt-12">
        <Disclosure title={t.web.otherNutrients} summary={t.web.foodPer100}>
          <NutritionTable columns={[{ title: t.common.per100g, values: v }]} />
        </Disclosure>
      </section>

      {related.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-[22px] font-bold tracking-tight text-ink">{t.web.recipesTitle}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.id}>
                <RecipeCard recipe={r} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-10 space-y-2 text-[14px] leading-relaxed text-muted">
        <p>
          {format(t.web.sourceLine, { source: 'USDA FoodData Central, SR Legacy', id: food.sourceId, license: food.license })}
          {food.sourceUrl && (
            <>
              {' · '}
              <a href={food.sourceUrl} className="underline underline-offset-2 hover:text-ink" rel="noopener">
                {t.common.source}
              </a>
            </>
          )}
        </p>
        <p>Raciones: medidas domésticas de USDA. Las de bebidas en ml se derivan de la densidad publicada por USDA.</p>
        <p>{t.disclaimer.notMedical}</p>
      </footer>
    </article>
  );
}
