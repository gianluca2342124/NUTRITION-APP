import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatNumber, formatNutrient, scaleNutrients } from '@repo/core';
import { format } from '@repo/i18n';
import { Breadcrumbs, Pill } from '@/components/breadcrumbs';
import { NutritionTable } from '@/components/nutrition-table';
import { allFoodSlugs, foodBySlug } from '@/lib/data';
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

export default async function IngredientPage({ params }: PageProps<'/ingredients/[slug]'>) {
  const { slug } = await params;
  const food = await foodBySlug(slug);
  if (!food) notFound();
  const v = food.nutrientsPer100;

  return (
    <article className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
      <Breadcrumbs
        items={[
          { name: 'Inicio', href: '/' },
          { name: t.foodCategories[food.category], href: `/search?q=${encodeURIComponent(food.nameEs.split(' ')[0] ?? '')}` },
          { name: food.nameEs, href: `/ingredients/${food.slug}` },
        ]}
      />
      <header className="mt-6">
        <Pill tone="primary">{t.foodCategories[food.category]}</Pill>
        <h1 className="mt-4 text-[36px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[46px]">{food.nameEs}</h1>
        <p className="mt-1 text-[16px] text-muted">{food.nameEn}</p>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t.web.foodPer100}>
        {(['energy_kcal', 'protein_g', 'carbs_g', 'fat_g'] as const).map((key) => (
          <div key={key} className="card p-4 sm:p-5">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">{t.nutrients[key]}</p>
            <p className="tabular mt-2 text-[26px] font-extrabold tracking-tight text-ink sm:text-[30px]">
              {formatNutrient(key, v[key], LOCALE, { withUnit: false, unknown: '—' })}
              <span className="ml-1 text-[15px] font-medium text-muted">{key === 'energy_kcal' ? 'kcal' : 'g'}</span>
            </p>
            <p className="mt-0.5 text-[13px] text-faint">{t.common.per100g}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-[22px] font-bold tracking-tight text-ink">{t.web.nutritionFacts}</h2>
        <NutritionTable columns={[{ title: t.common.per100g, values: v }]} />
      </section>

      {food.portions.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-[22px] font-bold tracking-tight text-ink">{t.web.householdPortions}</h2>
          <ul className="card divide-y divide-line">
            {food.portions.map((p) => {
              const kcal = scaleNutrients(v, p.grams).energy_kcal;
              return (
                <li key={p.id} className="tabular flex items-center justify-between gap-4 px-5 py-3.5 text-[15px]">
                  <span className="text-ink">
                    {p.labelEs} <span className="text-muted">· {formatNumber(p.grams, LOCALE, 1)} g</span>
                  </span>
                  <span className="font-semibold text-ink">{kcal != null ? `${formatNumber(kcal, LOCALE)} kcal` : '—'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
