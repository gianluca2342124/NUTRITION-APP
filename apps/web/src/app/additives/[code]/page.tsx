import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatNumber, normalizeAdditiveCode } from '@repo/core';
import { format } from '@repo/i18n';
import { PageSkeleton } from '@/components/page-skeleton';
import { Breadcrumbs, Pill } from '@/components/breadcrumbs';
import { Disclosure } from '@/components/disclosure';
import { additiveByCode } from '@/lib/data';
import { LOCALE, t } from '@/lib/site';

const COMMON = ['e330', 'e322', 'e471', 'e300', 'e440', 'e415', 'e250', 'e951', 'e171', 'e621'];

export function generateStaticParams() {
  return COMMON.map((code) => ({ code }));
}

export async function generateMetadata({ params }: PageProps<'/additives/[code]'>): Promise<Metadata> {
  const { code } = await params;
  const a = await additiveByCode(normalizeAdditiveCode(code) ?? '');
  if (!a) return { title: 'No encontrado', robots: { index: false } };
  const name = a.nameEs ?? a.nameEn ?? '';
  // Thin records (no explanation of our own) are reachable but kept out of search indexes.
  const indexable = a.reviewStatus === 'reviewed' || !!a.editorialNoteEs || !!a.summaryEs;
  return {
    title: `${a.eNumber}${name ? ` · ${name}` : ''}`,
    description: `${a.eNumber}${name ? ` (${name})` : ''}: función tecnológica y referencias de la EFSA.`,
    alternates: { canonical: `/additives/${a.code}` },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

/** The URL-dependent part streams inside Suspense (Partial Prefetching shell). */
export default function AdditivePage({ params }: PageProps<'/additives/[code]'>) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdditiveContent params={params} />
    </Suspense>
  );
}

async function AdditiveContent({ params }: { params: PageProps<'/additives/[code]'>['params'] }) {
  const { code: raw } = await params;
  const code = normalizeAdditiveCode(raw);
  const a = code ? await additiveByCode(code) : null;
  if (!a) notFound();
  const name = a.nameEs ?? a.nameEn ?? a.eNumber;
  const groups = a.efsa?.exposureAboveAdiGroups.map((g) => t.additive.groups[g as keyof typeof t.additive.groups] ?? g) ?? [];
  const notAuthorised = a.euStatus === 'not_authorised';
  const classes = a.classes.map((c) => (t.additiveClasses[c as keyof typeof t.additiveClasses] ?? c).toLowerCase());
  const facts = [
    a.summaryEs,
    !a.summaryEs && classes.length ? format(t.additive.usedAs, { classes: classes.join(', ') }) : null,
    !notAuthorised && a.efsa?.adiMgPerKgBw != null ? format(t.additive.adiFact, { value: formatNumber(a.efsa.adiMgPerKgBw, LOCALE, 3) }) : null,
  ].filter((x): x is string => !!x);
  const meaning = a.implicationEs ?? (groups.length && !notAuthorised ? format(t.additive.exposureFact, { groups: groups.join(', ') }) : null);

  return (
    <article className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <Breadcrumbs
        items={[
          { name: 'Inicio', href: '/' },
          { name: 'Aditivos', href: '/search?q=E' },
          { name: a.eNumber, href: `/additives/${a.code}` },
        ]}
      />

      {/* Hero: understandable name, E-number, main status */}
      <header className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <span
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold ${notAuthorised ? 'bg-scale-coral-soft text-scale-coral-text' : 'bg-primary-soft text-primary-text'}`}
          aria-hidden="true"
        >
          {a.eNumber}
        </span>
        <div>
          <h1 className="text-[38px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[44px]">{name}</h1>
          <p className="text-[20px] font-bold text-muted">{a.eNumber}</p>
        </div>
      </header>
      <div className="mt-5 flex flex-wrap gap-2">
        {notAuthorised ? (
          <span className="rounded-full bg-scale-coral-soft px-3.5 py-1.5 text-[14px] font-semibold text-scale-coral-text">{t.additive.statusNotAuthorised}</span>
        ) : (
          <>
            {a.classes.map((c) => (
              <Pill key={c} tone="primary">
                {t.additiveClasses[c as keyof typeof t.additiveClasses] ?? c}
              </Pill>
            ))}
            {groups.length > 0 ? (
              <span className="rounded-full bg-scale-amber-soft px-3 py-1 text-[13px] font-semibold text-scale-amber-text">{t.additive.statusExposure}</span>
            ) : null}
          </>
        )}
      </div>

      {/* Short explanation */}
      <div className="mt-6 space-y-3 text-[17px] leading-relaxed text-ink">
        {facts.length ? facts.map((fact) => <p key={fact}>{fact}</p>) : <p className="text-muted">{t.additive.noData}</p>}
      </div>

      {meaning ? (
        <section className={`mt-6 rounded-[28px] p-6 ${notAuthorised ? 'bg-scale-coral-soft' : 'card'}`}>
          <h2 className={`text-[17px] font-bold ${notAuthorised ? 'text-scale-coral-text' : 'text-ink'}`}>{t.additive.whatItMeans}</h2>
          <p className={`mt-2 text-[15px] leading-relaxed ${notAuthorised ? 'text-scale-coral-text' : 'text-muted'}`}>{meaning}</p>
        </section>
      ) : null}

      {/* Science and sources on demand */}
      <div className="mt-8 space-y-3">
        {notAuthorised && a.euStatusNoteEs ? (
          <Disclosure title={t.additive.regulationTitle} summary={a.euStatusNoteEs}>
            <p className="text-[15px] leading-relaxed text-muted">{a.euStatusNoteEs}</p>
          </Disclosure>
        ) : null}
        {a.efsa ? (
          <Disclosure title={t.additive.evidenceTitle} summary={a.efsa.date ? format(t.additive.evaluationYear, { year: a.efsa.date.slice(0, 4) }) : a.efsa.title}>
            <div className="space-y-3 text-[15px] leading-relaxed text-ink">
              {a.efsa.title ? (
                <p>
                  {a.efsa.url ? (
                    <a href={a.efsa.url} className="underline underline-offset-2 hover:text-primary-text" rel="noopener">
                      {a.efsa.title}
                    </a>
                  ) : (
                    a.efsa.title
                  )}
                  {a.efsa.date ? <span className="text-muted"> ({a.efsa.date.slice(0, 4)})</span> : null}
                </p>
              ) : null}
              {a.efsa.adiMgPerKgBw != null ? (
                <p>
                  <span className="font-semibold">{t.additive.adi}:</span> {format(t.additive.adiValue, { value: formatNumber(a.efsa.adiMgPerKgBw, LOCALE, 3) })}
                </p>
              ) : null}
              {groups.length > 0 ? <p>{format(t.additive.exposure, { groups: groups.join(', ') })}</p> : null}
              {a.editorialNoteEs ? <p className="text-muted">{a.editorialNoteEs}</p> : null}
              <p className="text-[13px] text-faint">{t.additive.efsaNote}</p>
            </div>
          </Disclosure>
        ) : null}
        {a.sources.length > 0 ? (
          <Disclosure title={t.additive.sourcesTitle} summary={a.sources.map((s) => s.publisher).join(' · ')}>
            <ul className="space-y-2 text-[14px] text-muted">
              {a.sources.map((s) => (
                <li key={s.url ?? s.title}>
                  {s.publisher}
                  {s.publishedOn ? ` (${s.publishedOn.slice(0, 4)})` : ''}:{' '}
                  {s.url ? (
                    <a href={s.url} className="underline underline-offset-2 hover:text-ink" rel="noopener">
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                </li>
              ))}
            </ul>
          </Disclosure>
        ) : null}
      </div>
      <p className="mt-8 text-[13px] text-faint">Datos del aditivo: taxonomía de Open Food Facts (ODbL) y fuentes enlazadas. {t.disclaimer.notMedical}</p>
    </article>
  );
}
