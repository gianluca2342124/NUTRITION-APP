import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { formatNumber, normalizeBarcode, type SearchHit, type SearchKind } from '@repo/core';
import { format } from '@repo/i18n';
import { SearchForm } from '@/components/search-form';
import { searchCatalog } from '@/lib/data';
import { LOCALE, t } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Buscar',
  robots: { index: false, follow: true },
};

function hitHref(hit: SearchHit): string {
  if (hit.kind === 'generic_food') return `/ingredients/${hit.slug}`;
  if (hit.kind === 'product') return `/products/${hit.slug}`;
  return `/additives/${hit.id}`;
}

const ORDER: SearchKind[] = ['generic_food', 'product', 'additive'];

async function Results({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  if (q.length < 2) return null;
  const hits = await searchCatalog(q);
  const barcode = normalizeBarcode(q);

  return (
    <div className="mt-10 space-y-10">
      <h1 className="text-[28px] font-bold tracking-tight text-ink">{format(t.web.resultsFor, { query: q })}</h1>
      {barcode && !hits.some((h) => h.kind === 'product') && (
        <p className="card p-5 text-[15px] text-muted">
          {format(t.search.noResults, { query: q })} {t.product.notFoundBody}
        </p>
      )}
      {hits.length === 0 && !barcode && (
        <div className="card p-8 text-center">
          <p className="text-[17px] font-semibold text-ink">{format(t.search.noResults, { query: q })}</p>
          <p className="mt-2 text-[15px] text-muted">{t.search.noResultsHint}</p>
        </div>
      )}
      {ORDER.map((kind) => {
        const group = hits.filter((h) => h.kind === kind);
        if (!group.length) return null;
        return (
          <section key={kind} aria-label={t.search.kinds[kind]}>
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-muted">
              {t.search.kinds[kind]} · {group.length}
            </h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {group.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <Link href={hitHref(hit)} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-muted">
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-semibold text-ink">{hit.title}</span>
                      {hit.subtitle && <span className="block truncate text-[14px] text-muted">{hit.subtitle}</span>}
                    </span>
                    {hit.energyKcalPer100 != null && (
                      <span className="tabular shrink-0 text-right text-[15px] font-semibold text-ink">
                        {formatNumber(hit.energyKcalPer100, LOCALE)} kcal
                        <span className="block text-[12px] font-normal text-muted">{hit.basis === '100ml' ? t.common.per100ml : t.common.per100g}</span>
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

async function SearchBox({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  return <SearchForm size="md" defaultValue={(Array.isArray(raw) ? raw[0] : raw) ?? ''} />;
}

export default function SearchPage(props: PageProps<'/search'>) {
  const searchParams = props.searchParams as Promise<{ q?: string | string[] }>;
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
      <Suspense fallback={<SearchForm size="md" />}>
        <SearchBox searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<div className="mt-10 h-40 animate-pulse rounded-3xl bg-surface-muted" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
