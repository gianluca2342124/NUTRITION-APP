import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { computeFudyuScore, formatNumber, localizedName, scaleNutrients, scoreInputFromProduct } from '@repo/core';
import { format } from '@repo/i18n';
import { PageSkeleton } from '@/components/page-skeleton';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Disclosure } from '@/components/disclosure';
import { FoodImage } from '@/components/food-image';
import { NutritionTable } from '@/components/nutrition-table';
import { ScoreReasons, ScoreRing } from '@/components/score';
import { indexableProducts, productBySlug } from '@/lib/data';
import { LOCALE, t } from '@/lib/site';

export async function generateStaticParams() {
  const products = await indexableProducts();
  return products.length ? products.slice(0, 200).map((p) => ({ slug: p.slug })) : [{ slug: '__placeholder__' }];
}

export async function generateMetadata({ params }: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const p = await productBySlug(slug);
  if (!p) return { title: 'No encontrado', robots: { index: false } };
  const name = localizedName(p, LOCALE) ?? p.gtin;
  const indexable = p.nutritionAvailable && !!p.name;
  return {
    title: `${name}${p.brand ? ` (${p.brand})` : ''}: Fudyu Score, ingredientes y nutrientes`,
    description: `Fudyu Score, información nutricional, ingredientes, alérgenos y aditivos de ${name}${p.brand ? ` de ${p.brand}` : ''}. Datos de Open Food Facts.`,
    alternates: { canonical: `/products/${p.slug}` },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

/** The URL-dependent part streams inside Suspense (Partial Prefetching shell). */
export default function ProductPage({ params }: PageProps<'/products/[slug]'>) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: { params: PageProps<'/products/[slug]'>['params'] }) {
  const { slug } = await params;
  const p = await productBySlug(slug);
  if (!p) notFound();
  const name = localizedName(p, LOCALE) ?? p.gtin;
  const unit = p.basis === '100ml' ? 'ml' : 'g';
  const score = computeFudyuScore(scoreInputFromProduct(p));
  const columns = [{ title: p.basis === '100ml' ? t.common.per100ml : t.common.per100g, values: p.nutrientsPer100 }];
  if (p.servingQuantity) {
    columns.push({ title: `${t.common.perServing} (${formatNumber(p.servingQuantity, LOCALE)} ${unit})`, values: scaleNutrients(p.nutrientsPer100, p.servingQuantity) });
  }
  const ingredients = p.ingredientsTexts[LOCALE] ?? p.ingredientsText;
  const additives = p.additiveInfo ?? [];

  return (
    <article className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <Breadcrumbs
        items={[
          { name: 'Inicio', href: '/' },
          { name: 'Productos', href: '/search?q=' + encodeURIComponent(p.brand ?? name) },
          { name, href: `/products/${p.slug}` },
        ]}
      />

      {/* Two columns: image | identity, score, reasons, actions */}
      <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="card overflow-hidden p-0 lg:sticky lg:top-24">
          <FoodImage src={p.imageUrl} alt={name} fallback="product" fit="contain" className="aspect-square w-full" sizes="(min-width: 1024px) 40vw, 90vw" priority />
        </div>
        <div className="space-y-6">
          <header>
            {p.brand ? <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{p.brand}</p> : null}
            <h1 className="mt-1 text-[34px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[42px]">{name}</h1>
            <p className="tabular mt-1 text-[15px] text-muted">{[p.quantityText, `EAN ${p.gtin}`].filter(Boolean).join(' · ')}</p>
          </header>

          <section aria-label={t.score.title} className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
            <ScoreRing result={score} size={168} />
            <div className="flex-1 space-y-4">
              {score.status === 'scored' ? <ScoreReasons result={score} unit={unit} /> : null}
              <Link href="/metodologia" className="inline-block text-[14px] font-semibold text-primary-text hover:underline">
                {t.score.methodology}
              </Link>
            </div>
          </section>

          {p.allergens.length > 0 ? (
            <p className="rounded-2xl bg-warning-soft px-5 py-4 text-[15px] text-warning-text">
              <strong className="font-semibold">{t.product.allergens}:</strong> {p.allergens.map((a) => t.allergens[a]).join(', ')}
              {p.traces.length ? ` · ${t.product.traces}: ${p.traces.map((a) => t.allergens[a]).join(', ')}` : ''}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link href="/#app" className="rounded-full bg-primary px-5 py-3 text-[15px] font-semibold text-on-primary hover:bg-primary-pressed">
              {t.product.compare}
            </Link>
            <p className="self-center text-[14px] text-muted">{t.web.productActions}</p>
          </div>
        </div>
      </div>

      {/* Details on demand */}
      <h2 className="mt-14 text-[26px] font-bold tracking-tight text-ink">{t.web.analysisTitle}</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {p.nutritionAvailable ? (
          <Disclosure title={t.product.nutrition} summary={format(t.product.nutritionSummary, { kcal: formatNumber(p.nutrientsPer100.energy_kcal ?? 0, LOCALE), protein: formatNumber(p.nutrientsPer100.protein_g ?? 0, LOCALE, 1), unit })} open>
            <NutritionTable columns={columns} />
          </Disclosure>
        ) : (
          <p className="card p-5 text-[15px] text-muted">{t.product.nutritionMissing}</p>
        )}
        <div className="space-y-3">
          <Disclosure title={t.product.ingredients} summary={ingredients ? ingredients.slice(0, 80) : t.product.ingredientsMissing}>
            <p className="text-[15px] leading-relaxed text-muted">{ingredients ?? t.product.ingredientsMissing}</p>
          </Disclosure>
          <Disclosure
            title={t.product.additives}
            summary={additives.length === 0 ? t.product.noAdditives : additives.length === 1 ? t.product.additivesCountOne : format(t.product.additivesCountMany, { count: additives.length })}
          >
            {additives.length ? (
              <ul className="divide-y divide-line">
                {additives.map((a) => (
                  <li key={a.code}>
                    <Link href={`/additives/${a.code}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary-text">
                      <span>
                        <span className="block text-[15px] font-semibold text-ink">{a.nameEs ?? a.eNumber}</span>
                        <span className="block text-[13px] text-muted">
                          {[a.eNumber, ...a.classes.slice(0, 1).map((c) => t.additiveClasses[c as keyof typeof t.additiveClasses] ?? c)].join(' · ')}
                        </span>
                      </span>
                      {a.euStatus === 'not_authorised' ? (
                        <span className="rounded-full bg-scale-coral-soft px-3 py-1 text-[12px] font-semibold text-scale-coral-text">{t.product.notAuthorisedChip}</span>
                      ) : a.exposureConcern ? (
                        <span className="rounded-full bg-scale-amber-soft px-3 py-1 text-[12px] font-semibold text-scale-amber-text">{t.product.exposureChip}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-muted">{t.product.noAdditives}</p>
            )}
          </Disclosure>
          <Disclosure
            title={t.product.processing}
            summary={p.novaGroup ? `NOVA ${p.novaGroup} · ${t.product.novaGroups[String(p.novaGroup) as '1']}` : t.product.processingUnknown}
          >
            <p className="text-[15px] text-muted">{p.novaGroup ? `${t.product.novaGroups[String(p.novaGroup) as '1']}. ${t.product.novaSource}` : t.product.processingUnknown}</p>
          </Disclosure>
          {score.status === 'scored' ? (
            <Disclosure title={format(t.score.nutriscoreTitle, { grade: score.nutriscore.grade.toUpperCase() })} summary={format(t.score.nutritionPart, { value: score.nutritionScore })}>
              <p className="text-[14px] text-muted">{format(t.score.nutriscoreBody, { points: score.nutriscore.score })}</p>
              <ul className="mt-3 space-y-1.5 text-[14px]">
                {score.nutriscore.components.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3">
                    <span className="text-ink">
                      {t.score.components[c.id]}
                      {c.value == null ? <span className="text-faint"> · {t.common.unknown}</span> : null}
                    </span>
                    <span className="tabular font-semibold text-muted">
                      {c.counted ? `${c.kind === 'negative' ? '−' : '+'}${format(t.score.pointsOf, { points: c.points, max: c.max })}` : t.score.notCounted}
                    </span>
                  </li>
                ))}
              </ul>
              {score.unknown.length ? (
                <p className="mt-3 text-[13px] text-faint">{format(t.score.unknownData, { list: score.unknown.map((u) => t.score.unknownItems[u]).join(', ') })}</p>
              ) : null}
            </Disclosure>
          ) : null}
        </div>
      </div>

      <footer className="mt-10 space-y-1 text-[13px] text-faint">
        <p>
          {format(t.product.dataSource, { source: 'Open Food Facts' })} · {p.license}
          {p.sourceLastModified ? ` · ${t.common.updated} ${p.sourceLastModified.slice(0, 10)}` : ''}
          {p.sourceUrl ? (
            <>
              {' · '}
              <a href={p.sourceUrl} className="underline underline-offset-2 hover:text-ink">
                {t.common.source}
              </a>
            </>
          ) : null}
        </p>
        {p.imageUrl ? <p>{t.product.imageCredit}</p> : null}
        {p.warnings.map((w) => (
          <p key={w}>{t.product.warnings[w]}</p>
        ))}
        <p>{t.score.disclaimer}</p>
      </footer>
    </article>
  );
}
