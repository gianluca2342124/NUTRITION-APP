import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { displayENumber, formatNumber, localizedName, scaleNutrients } from '@repo/core';
import { format } from '@repo/i18n';
import { Breadcrumbs, Pill } from '@/components/breadcrumbs';
import { NutritionTable } from '@/components/nutrition-table';
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
    title: `${name}${p.brand ? ` (${p.brand})` : ''}: ingredientes y nutrientes`,
    description: `Información nutricional, ingredientes, alérgenos y aditivos de ${name}${p.brand ? ` de ${p.brand}` : ''}. Datos de Open Food Facts.`,
    alternates: { canonical: `/products/${p.slug}` },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

const NOVA_TONE = { 1: 'success', 2: 'neutral', 3: 'neutral', 4: 'warning' } as const;

export default async function ProductPage({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params;
  const p = await productBySlug(slug);
  if (!p) notFound();
  const name = localizedName(p, LOCALE) ?? p.gtin;
  const unit = p.basis === '100ml' ? 'ml' : 'g';
  const columns = [{ title: p.basis === '100ml' ? t.common.per100ml : t.common.per100g, values: p.nutrientsPer100 }];
  if (p.servingQuantity) {
    columns.push({ title: `${t.common.perServing} (${formatNumber(p.servingQuantity, LOCALE)} ${unit})`, values: scaleNutrients(p.nutrientsPer100, p.servingQuantity) });
  }
  const ingredients = p.ingredientsTexts[LOCALE] ?? p.ingredientsText;

  return (
    <article className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <Breadcrumbs
        items={[
          { name: 'Inicio', href: '/' },
          { name: 'Productos', href: '/search?q=' + encodeURIComponent(p.brand ?? name) },
          { name, href: `/products/${p.slug}` },
        ]}
      />
      <div className="mt-6 grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="card flex aspect-square items-center justify-center overflow-hidden p-6">
          {p.imageUrl ? (
            <Image src={p.imageUrl} alt={name} width={400} height={400} className="h-full w-full object-contain" />
          ) : (
            <span className="text-[14px] text-faint">Sin imagen</span>
          )}
        </div>
        <header>
          {p.brand && <p className="text-[15px] font-semibold uppercase tracking-wide text-muted">{p.brand}</p>}
          <h1 className="mt-1 text-[34px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[42px]">{name}</h1>
          <p className="tabular mt-2 text-[15px] text-muted">
            {[p.quantityText, `EAN ${p.gtin}`].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {p.nutriscoreGrade && <Pill tone="primary">Nutri-Score {p.nutriscoreGrade.toUpperCase()}</Pill>}
            {p.novaGroup && <Pill tone={NOVA_TONE[p.novaGroup as 1 | 2 | 3 | 4]}>NOVA {p.novaGroup} · {t.product.novaGroups[String(p.novaGroup) as '1']}</Pill>}
            {p.additives.length > 0 && <Pill>{format(t.compare.additivesCount, { count: p.additives.length })}</Pill>}
          </div>
          {(p.nutriscoreGrade || p.novaGroup) && (
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-faint">
              {p.nutriscoreGrade ? t.product.nutriscoreSource : ''} {p.novaGroup ? t.product.novaSource : ''}
            </p>
          )}
          {p.warnings.length > 0 && (
            <ul className="mt-4 space-y-1">
              {p.warnings.map((w) => (
                <li key={w} className="text-[14px] text-warning-text">
                  • {t.product.warnings[w]}
                </li>
              ))}
            </ul>
          )}
        </header>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-[22px] font-bold tracking-tight text-ink">{t.product.nutrition}</h2>
        {p.nutritionAvailable ? <NutritionTable columns={columns} /> : <p className="card p-5 text-muted">{t.product.nutritionMissing}</p>}
      </section>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-[18px] font-bold text-ink">{t.product.ingredients}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{ingredients ?? t.product.ingredientsMissing}</p>
        </section>
        <section className="card space-y-5 p-6">
          <div>
            <h2 className="text-[18px] font-bold text-ink">{t.product.allergens}</h2>
            <p className="mt-2 text-[15px] text-muted">
              {p.allergens.length ? p.allergens.map((a) => t.allergens[a]).join(', ') : t.product.noAllergens}
            </p>
            {p.traces.length > 0 && (
              <p className="mt-1 text-[14px] text-muted">
                {t.product.traces}: {p.traces.map((a) => t.allergens[a]).join(', ')}
              </p>
            )}
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-ink">{t.product.additives}</h2>
            {p.additives.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {p.additives.map((code) => (
                  <li key={code}>
                    <Link href={`/additives/${code}`} className="inline-flex rounded-full bg-surface-muted px-3 py-1 text-[14px] font-semibold text-ink hover:bg-primary-soft">
                      {displayENumber(code)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[15px] text-muted">{t.product.noAdditives}</p>
            )}
          </div>
        </section>
      </div>

      <footer className="mt-10 space-y-2 text-[14px] leading-relaxed text-muted">
        {p.countries.length > 0 && !p.countries.includes('spain') && (
          <p>{format(t.product.countriesNote, { countries: p.countries.slice(0, 5).join(', ') })}</p>
        )}
        <p>
          {format(t.product.dataSource, { source: 'Open Food Facts' })} ·{' '}
          {p.sourceUrl && (
            <a href={p.sourceUrl} className="underline underline-offset-2 hover:text-ink" rel="noopener">
              {t.common.source}
            </a>
          )}{' '}
          · {p.license}
          {p.sourceLastModified && ` · ${t.common.updated} ${p.sourceLastModified.slice(0, 10)}`}
        </p>
        <p>{t.disclaimer.notMedical}</p>
      </footer>
    </article>
  );
}
