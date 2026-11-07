import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatNumber, normalizeAdditiveCode } from '@repo/core';
import { format } from '@repo/i18n';
import { Breadcrumbs, Pill } from '@/components/breadcrumbs';
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
  // Thin, unreviewed records are reachable but kept out of search indexes.
  const indexable = a.reviewStatus === 'reviewed' || !!a.editorialNoteEs;
  return {
    title: `${a.eNumber}${name ? ` · ${name}` : ''}`,
    description: `${a.eNumber}${name ? ` (${name})` : ''}: función tecnológica y referencias de la EFSA.`,
    alternates: { canonical: `/additives/${a.code}` },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export default async function AdditivePage({ params }: PageProps<'/additives/[code]'>) {
  const { code: raw } = await params;
  const code = normalizeAdditiveCode(raw);
  const a = code ? await additiveByCode(code) : null;
  if (!a) notFound();
  const name = a.nameEs ?? a.nameEn;
  const groups = a.efsa?.exposureAboveAdiGroups.map((g) => t.additive.groups[g as keyof typeof t.additive.groups] ?? g) ?? [];

  return (
    <article className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <Breadcrumbs
        items={[
          { name: 'Inicio', href: '/' },
          { name: 'Aditivos', href: '/search?q=E' },
          { name: a.eNumber, href: `/additives/${a.code}` },
        ]}
      />
      <header className="mt-6">
        <div className="flex flex-wrap gap-2">
          {a.classes.map((c) => (
            <Pill key={c} tone="primary">
              {t.additiveClasses[c as keyof typeof t.additiveClasses] ?? c}
            </Pill>
          ))}
          {a.reviewStatus !== 'reviewed' && <Pill tone="warning">{t.additive.notReviewed}</Pill>}
        </div>
        <h1 className="mt-4 text-[40px] font-extrabold leading-tight tracking-[-0.03em] text-ink">
          {a.eNumber}
          {name && <span className="block text-[26px] font-bold text-muted">{name}</span>}
        </h1>
      </header>

      {a.editorialNoteEs && (
        <section className="card mt-8 border-warning! bg-warning-soft! p-6">
          <h2 className="text-[17px] font-bold text-warning-text">{t.additive.editorialNote}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{a.editorialNoteEs}</p>
        </section>
      )}

      {a.efsa && (
        <section className="card mt-6 space-y-4 p-6">
          <h2 className="text-[18px] font-bold text-ink">{t.additive.efsa}</h2>
          {a.efsa.title && (
            <p className="text-[15px] leading-relaxed text-ink">
              {a.efsa.url ? (
                <a href={a.efsa.url} className="underline underline-offset-2 hover:text-primary-text" rel="noopener">
                  {a.efsa.title}
                </a>
              ) : (
                a.efsa.title
              )}
              {a.efsa.date && <span className="text-muted"> ({a.efsa.date.slice(0, 4)})</span>}
            </p>
          )}
          {a.efsa.adiMgPerKgBw != null && (
            <p className="text-[15px] text-ink">
              <span className="font-semibold">{t.additive.adi}:</span>{' '}
              {format(t.additive.adiValue, { value: formatNumber(a.efsa.adiMgPerKgBw, LOCALE, 3) })}
            </p>
          )}
          {groups.length > 0 && <p className="text-[15px] leading-relaxed text-ink">{format(t.additive.exposure, { groups: groups.join(', ') })}</p>}
          <p className="text-[13px] text-faint">{t.additive.efsaNote}</p>
        </section>
      )}

      {!a.editorialNoteEs && <p className="mt-6 text-[15px] text-muted">{t.additive.noEvidence}</p>}

      {a.sources.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[18px] font-bold text-ink">{t.common.sources}</h2>
          <ul className="mt-3 space-y-2 text-[14px] text-muted">
            {a.sources.map((s) => (
              <li key={s.url ?? s.title}>
                {s.publisher}
                {s.publishedOn && ` (${s.publishedOn.slice(0, 4)})`}:{' '}
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
        </section>
      )}
      <p className="mt-8 text-[13px] text-faint">Datos del aditivo: taxonomía de Open Food Facts (ODbL). {t.disclaimer.notMedical}</p>
    </article>
  );
}
