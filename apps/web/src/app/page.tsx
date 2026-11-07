import Link from 'next/link';
import { formatNumber } from '@repo/core';
import { SearchForm } from '@/components/search-form';
import { popularFoods } from '@/lib/data';
import { LOCALE, t } from '@/lib/site';

const POPULAR = [
  'arroz-blanco-cocido',
  'huevo',
  'aguacate',
  'pechuga-de-pollo',
  'yogur-griego',
  'garbanzos-cocidos',
  'aceite-de-oliva',
  'platano',
] as const;

const QUICK = ['Avena', 'Yogur griego', 'Salmón', 'E330'];

export default async function HomePage() {
  const foods = await popularFoods(POPULAR);
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] bg-[radial-gradient(60%_60%_at_50%_30%,var(--fy-primary-soft),transparent)]"
        />
        <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
          <h1 className="text-[44px] font-extrabold leading-[1.02] tracking-[-0.045em] text-ink sm:text-[68px]">
            {t.web.heroTitle}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[18px] leading-relaxed text-muted sm:text-[20px]">{t.web.heroSubtitle}</p>
          <div className="mx-auto mt-10 max-w-2xl">
            <SearchForm />
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {QUICK.map((q) => (
              <Link
                key={q}
                href={`/search?q=${encodeURIComponent(q)}`}
                className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-medium text-muted hover:border-line-strong hover:text-ink"
              >
                {q}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="how">
        <h2 id="how" className="sr-only">
          {t.web.howItWorks}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [t.web.how1Title, t.web.how1Body, '01'],
            [t.web.how2Title, t.web.how2Body, '02'],
            [t.web.how3Title, t.web.how3Body, '03'],
          ].map(([title, body, n]) => (
            <div key={n} className="card p-7">
              <span className="text-[13px] font-bold tracking-wide text-primary-text">{n}</span>
              <h3 className="mt-3 text-[20px] font-bold tracking-tight text-ink">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {foods.length > 0 && (
        <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6" aria-labelledby="popular">
          <div className="flex items-end justify-between gap-4">
            <h2 id="popular" className="text-[28px] font-bold tracking-tight text-ink">
              {t.web.popularFoods}
            </h2>
            <Link href="/search?q=a" className="text-[15px] font-semibold text-primary-text hover:underline">
              {t.common.seeAll}
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {foods.map((f) => (
              <li key={f.id}>
                <Link href={`/ingredients/${f.slug}`} className="card block h-full p-5 transition hover:-translate-y-0.5 hover:border-line-strong">
                  <p className="text-[16px] font-semibold leading-snug text-ink">{f.nameEs}</p>
                  <p className="tabular mt-4 text-[26px] font-extrabold tracking-tight text-ink">
                    {f.nutrientsPer100.energy_kcal != null ? formatNumber(f.nutrientsPer100.energy_kcal, LOCALE) : '—'}
                    <span className="ml-1 text-[14px] font-medium text-muted">kcal</span>
                  </p>
                  <p className="tabular mt-1 text-[13px] text-muted">
                    {t.common.per100g} · {formatNumber(f.nutrientsPer100.protein_g ?? 0, LOCALE, 1)} g {t.nutrients.protein_g.toLowerCase()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="app" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <div className="card flex flex-col items-start gap-4 bg-[linear-gradient(135deg,var(--fy-primary),#1E4FE6)]! p-8 text-on-primary sm:p-12">
          <h2 className="text-[30px] font-extrabold tracking-tight sm:text-[36px]">{t.web.getApp}</h2>
          <p className="max-w-xl text-[17px] leading-relaxed opacity-90">{t.web.appSoon}</p>
        </div>
      </section>
    </>
  );
}
