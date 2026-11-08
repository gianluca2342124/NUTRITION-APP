import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatNumber } from '@repo/core';
import { communityRecipeNutrition } from '@repo/data';
import { format } from '@repo/i18n';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { NutritionTable } from '@/components/nutrition-table';
import { PageSkeleton } from '@/components/page-skeleton';
import { communityRecipeById, publicAuthor, publishedCommunityRecipes } from '@/lib/data';
import { LOCALE, siteUrl, t } from '@/lib/site';

/** Published community recipes only: drafts and recipes in review are never rendered or indexed. */
export async function generateStaticParams() {
  const recipes = await publishedCommunityRecipes();
  return recipes.length ? recipes.map((r) => ({ id: r.id })) : [{ id: '__placeholder__' }];
}

export async function generateMetadata({ params }: PageProps<'/recetas/comunidad/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const r = await communityRecipeById(id);
  if (!r) return { title: 'No encontrado', robots: { index: false } };
  return {
    title: `${r.title}: receta de la comunidad`,
    description: r.summary ?? `${r.title}. Receta de la comunidad de Fudyu con información nutricional calculada.`,
    alternates: { canonical: `/recetas/comunidad/${r.id}` },
  };
}

export default function CommunityRecipePage({ params }: PageProps<'/recetas/comunidad/[id]'>) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<'/recetas/comunidad/[id]'>['params'] }) {
  const { id } = await params;
  const r = await communityRecipeById(id);
  if (!r) notFound();
  const author = await publicAuthor(r.authorId);
  const authorName = author?.displayName ?? (author?.username ? `@${author.username}` : null);
  const n = communityRecipeNutrition(r);
  const v = n.perServing;
  const image = r.imagePath ? `/api/v1/media/community/${r.imagePath}` : null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.title,
    description: r.summary ?? undefined,
    image: image ? [`${siteUrl()}${image}`] : undefined,
    author: { '@type': 'Person', name: authorName ?? t.community.anonymous },
    recipeYield: String(r.servings),
    totalTime: r.minutes ? `PT${r.minutes}M` : undefined,
    recipeIngredient: r.ingredients.map((i) => `${formatNumber(i.grams, LOCALE)} ${i.basis === '100ml' ? 'ml' : 'g'} ${i.label}`),
    recipeInstructions: r.steps.map((text) => ({ '@type': 'HowToStep', text })),
    nutrition: v.energy_kcal != null ? { '@type': 'NutritionInformation', calories: `${Math.round(v.energy_kcal)} kcal` } : undefined,
  };

  return (
    <article className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Breadcrumbs
        items={[
          { name: 'Inicio', href: '/' },
          { name: t.recipes.title, href: '/recetas' },
          { name: r.title, href: `/recetas/comunidad/${r.id}` },
        ]}
      />
      <div className="mt-6 grid grid-cols-1 items-start gap-8 md:grid-cols-2">
        <figure>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="aspect-[4/3] w-full rounded-[28px] object-cover" />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[28px] bg-primary-soft text-[15px] font-semibold text-primary-text">{t.community.anonymous}</div>
          )}
          {image ? <figcaption className="mt-2 text-[12px] text-faint">{t.community.photoByAuthor}</figcaption> : null}
        </figure>
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.1em] text-faint">{t.community.title}</p>
          <h1 className="mt-2 text-[34px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[42px]">{r.title}</h1>
          <p className="mt-2 text-[15px] font-semibold text-muted">{authorName ? format(t.community.by, { name: authorName }) : t.community.anonymous}</p>
          {r.summary ? <p className="mt-3 text-[17px] leading-relaxed text-muted">{r.summary}</p> : null}
          <p className="tabular mt-4 text-[15px] font-semibold text-ink">
            {[r.minutes ? format(t.recipes.minutes, { value: r.minutes }) : null, r.servings === 1 ? t.recipes.servingOne : format(t.recipes.servings, { value: r.servings })].filter(Boolean).join(' · ')}
          </p>
          <p className="card tabular mt-5 flex flex-wrap items-baseline gap-x-2 px-6 py-5 text-[17px] text-ink">
            <strong className="text-[22px] font-extrabold">{v.energy_kcal == null ? '—' : formatNumber(v.energy_kcal, LOCALE)}</strong> kcal
            <span className="text-faint">·</span>
            <strong className="text-[22px] font-extrabold">{v.protein_g == null ? '—' : formatNumber(v.protein_g, LOCALE)}</strong> g {t.nutrients.protein_g.toLowerCase()}
            <span className="basis-full text-[13px] text-muted">{t.recipes.perServing}</span>
          </p>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.4fr]">
        <section>
          <h2 className="text-[22px] font-bold tracking-tight text-ink">{t.recipes.ingredients}</h2>
          <ul className="card mt-4 divide-y divide-line p-0">
            {r.ingredients.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-4 px-5 py-3.5 text-[15px]">
                {i.slug ? (
                  <Link href={`/ingredients/${i.slug}`} className="text-ink hover:text-primary-text">
                    {i.label}
                  </Link>
                ) : (
                  <span className="text-ink">{i.label}</span>
                )}
                <span className="tabular text-muted">
                  {formatNumber(i.grams, LOCALE)} {i.basis === '100ml' ? 'ml' : 'g'}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-[22px] font-bold tracking-tight text-ink">{t.recipes.steps}</h2>
          <ol className="mt-4 space-y-4">
            {r.steps.map((step, i) => (
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
        {t.community.reviewed} {t.disclaimer.notMedical}
      </p>
    </article>
  );
}
