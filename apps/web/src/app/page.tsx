import Link from 'next/link';
import { formatNumber, localizedName, SCORE_LEVELS } from '@repo/core';
import { curatedFoodImage } from '@repo/data';
import { Character } from '@/components/art';
import { FoodImage } from '@/components/food-image';
import { ScoreBadge, ScoreRing, scoreTone } from '@/components/score';
import { SearchForm } from '@/components/search-form';
import { RecipeCard } from '@/components/recipe-card';
import { additiveCards, allRecipes, popularFoods, scoredProducts } from '@/lib/data';
import { LOCALE, t } from '@/lib/site';

const DISCOVER = ['copos-de-avena', 'aguacate', 'salmon', 'huevo', 'yogur-natural', 'garbanzos-cocidos', 'platano', 'brocoli'] as const;
const QUICK: { label: string; href: string }[] = [
  { label: 'Avena', href: '/ingredients/copos-de-avena' },
  { label: 'Yogur', href: '/ingredients/yogur-natural' },
  { label: 'Salmón', href: '/ingredients/salmon' },
  { label: 'E330', href: '/additives/e330' },
];
const ADDITIVES = ['e330', 'e171', 'e322', 'e300', 'e440', 'e471'] as const;
const RANGES = { excellent: '80–100', good: '60–79', fair: '40–59', poor: '20–39', limit: '0–19' } as const;

export default async function HomePage() {
  const [foods, products, additives, recipes] = await Promise.all([popularFoods(DISCOVER), scoredProducts(4), additiveCards(ADDITIVES), allRecipes()]);
  const demoFood = foods[0] ?? null;
  const demoProduct = products.find((p) => p.score.status === 'scored' && p.score.score >= 60) ?? null;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-48 h-[620px] bg-[radial-gradient(55%_55%_at_60%_35%,var(--fy-primary-soft),transparent)]"
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-20">
          <div className="fy-rise text-center lg:text-left">
            <h1 className="text-[44px] font-extrabold leading-[1.02] tracking-[-0.045em] text-ink sm:text-[64px]">{t.web.heroTitle}</h1>
            <p className="mx-auto mt-5 max-w-xl text-[18px] leading-relaxed text-muted sm:text-[19px] lg:mx-0">{t.web.heroSubtitle}</p>
            <div className="mx-auto mt-8 max-w-xl lg:mx-0">
              <SearchForm />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
              {QUICK.map((q) => (
                <Link
                  key={q.label}
                  href={q.href}
                  className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-muted transition hover:border-line-strong hover:text-ink"
                >
                  {q.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Product demonstration with real data only */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-label={t.web.demoLabel}>
            <Character expression="smile" size={84} className="absolute -left-2 -top-8 z-10 drop-shadow-xl sm:-left-6" />
            {demoFood ? (
              <Link href={`/ingredients/${demoFood.slug}`} className="card float relative block overflow-hidden p-0 transition hover:-translate-y-0.5">
                <FoodImage
                  src={curatedFoodImage(demoFood.slug)?.wide}
                  alt={demoFood.nameEs}
                  fallback="grains"
                  className="aspect-[4/3] w-full"
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  priority
                />
                <div className="flex items-end justify-between gap-4 p-5">
                  <div>
                    <p className="text-[19px] font-bold tracking-tight text-ink">{demoFood.nameEs}</p>
                    <p className="tabular mt-1 text-[14px] text-muted">
                      {formatNumber(demoFood.nutrientsPer100.energy_kcal ?? 0, LOCALE)} kcal ·{' '}
                      {formatNumber(demoFood.nutrientsPer100.protein_g ?? 0, LOCALE, 1)} g {t.nutrients.protein_g.toLowerCase()} ·{' '}
                      {formatNumber(demoFood.nutrientsPer100.fiber_g ?? 0, LOCALE, 1)} g {t.nutrients.fiber_g.toLowerCase()}
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-faint">{t.web.demoFoodNote}</p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="card float aspect-[4/3]" />
            )}

            {demoProduct && demoProduct.score.status === 'scored' ? (
              <Link
                href={`/products/${demoProduct.product.slug}`}
                className="card float absolute -bottom-10 -right-2 hidden w-56 flex-col items-center gap-1 p-5 sm:flex sm:-right-6"
              >
                <ScoreRing result={demoProduct.score} size={112} />
                <p className="line-clamp-2 text-center text-[13px] font-semibold text-muted">{localizedName(demoProduct.product, LOCALE)}</p>
              </Link>
            ) : (
              <div className="card float absolute -bottom-12 -right-2 hidden w-60 p-5 sm:block sm:-right-6">
                <p className="text-[15px] font-bold text-ink">{t.web.demoScaleTitle}</p>
                <p className="text-[12px] text-muted">{t.web.demoScaleNote}</p>
                <ul className="mt-3 space-y-1.5">
                  {SCORE_LEVELS.map((level) => {
                    const tone = scoreTone(level);
                    return (
                      <li key={level} className="flex items-center gap-2 text-[13px]">
                        <span className="tabular w-14 rounded-full py-0.5 text-center text-[11px] font-bold" style={{ background: tone.soft, color: tone.text }}>
                          {RANGES[level]}
                        </span>
                        <span className="font-medium text-ink">{t.score.levels[level]}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div aria-hidden="true" className="glass float absolute -left-3 bottom-24 hidden items-center gap-2 rounded-full border border-line px-4 py-2.5 text-[14px] font-semibold text-ink sm:flex">
              <svg width="18" height="18" viewBox="0 0 24 24" className="text-primary">
                <path d="M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3M7.5 12h9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              {t.web.scanPill}
            </div>
          </div>
        </div>
      </section>

      {/* Discover foods */}
      {foods.length > 0 && (
        <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6" aria-labelledby="discover">
          <SectionTitle id="discover" title={t.web.discoverTitle} subtitle={t.web.discoverSubtitle} href="/search?q=a" />
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {foods.map((f) => (
              <li key={f.id}>
                <Link href={`/ingredients/${f.slug}`} className="card group block h-full overflow-hidden p-0 transition hover:-translate-y-0.5">
                  <FoodImage src={curatedFoodImage(f.slug)?.square} alt={f.nameEs} fallback={f.category} className="aspect-square w-full" />
                  <div className="p-4">
                    <p className="text-[16px] font-semibold leading-snug text-ink">{f.nameEs}</p>
                    <p className="tabular mt-1 text-[13px] text-muted">
                      {f.nutrientsPer100.energy_kcal != null ? formatNumber(f.nutrientsPer100.energy_kcal, LOCALE) : '—'} kcal ·{' '}
                      {formatNumber(f.nutrientsPer100.protein_g ?? 0, LOCALE, 1)} g {t.nutrients.protein_g.toLowerCase()}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-faint">
            Fotos: Wikimedia Commons (licencias libres) ·{' '}
            <Link href="/creditos" className="underline underline-offset-2 hover:text-ink">
              {t.web.creditsLink}
            </Link>
          </p>
        </section>
      )}

      {/* Real analysed products */}
      {products.length > 0 && (
        <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6" aria-labelledby="products">
          <SectionTitle id="products" title={t.web.productsTitle} subtitle={t.web.productsSubtitle} />
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {products.map(({ product, score }) => (
              <li key={product.id}>
                <Link href={`/products/${product.slug}`} className="card block h-full overflow-hidden p-0 transition hover:-translate-y-0.5">
                  <FoodImage src={product.imageUrl} alt={localizedName(product, LOCALE) ?? product.gtin} fallback="product" fit="contain" className="aspect-square w-full" />
                  <div className="space-y-2 p-4">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{localizedName(product, LOCALE)}</p>
                    {product.brand ? <p className="text-[13px] text-muted">{product.brand}</p> : null}
                    <ScoreBadge result={score} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ingredients & additives */}
      {additives.length > 0 && (
        <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6" aria-labelledby="additives">
          <SectionTitle id="additives" title={t.web.additivesTitle} subtitle={t.web.additivesSubtitle} />
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {additives.map((a) => (
              <li key={a.code}>
                <Link href={`/additives/${a.code}`} className="card flex h-full items-center gap-4 p-5 transition hover:-translate-y-0.5">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${a.euStatus === 'not_authorised' ? 'bg-scale-coral-soft text-scale-coral-text' : 'bg-primary-soft text-primary-text'}`}
                  >
                    {a.eNumber}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold text-ink">{a.nameEs ?? a.eNumber}</span>
                    <span className="block text-[13px] text-muted">
                      {a.euStatus === 'not_authorised'
                        ? t.additive.statusNotAuthorised
                        : a.classes.map((c) => t.additiveClasses[c as keyof typeof t.additiveClasses] ?? c).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Visual recipes (editorial) */}
      {recipes.length > 0 && (
        <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6" aria-labelledby="recipes">
          <SectionTitle id="recipes" title={t.web.recipesTitle} subtitle={t.web.recipesSubtitle} href="/recetas" />
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.slice(0, 3).map((r) => (
              <li key={r.id}>
                <RecipeCard recipe={r} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* How it works */}
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6" aria-labelledby="how">
        <h2 id="how" className="text-[28px] font-bold tracking-tight text-ink">
          {t.web.howItWorks}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {(
            [
              [t.web.how1Title, t.web.how1Body, 'curious'],
              [t.web.how2Title, t.web.how2Body, 'smile'],
              [t.web.how3Title, t.web.how3Body, 'thinking'],
            ] as const
          ).map(([title, body, expression]) => (
            <div key={title} className="card flex gap-4 p-6">
              <Character expression={expression} size={56} className="shrink-0" />
              <div>
                <h3 className="text-[18px] font-bold tracking-tight text-ink">{title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[14px]">
          <Link href="/metodologia" className="font-semibold text-primary-text hover:underline">
            {t.web.methodologyLink}
          </Link>
        </p>
      </section>

      {/* App */}
      <section id="app" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <div className="card relative flex flex-col items-start gap-3 overflow-hidden border-0 bg-[linear-gradient(135deg,var(--fy-primary),var(--fy-primary-pressed))]! p-8 text-on-primary sm:p-12">
          <Character expression="celebrate" size={120} className="absolute -right-4 -top-4 opacity-95 max-sm:hidden" />
          <h2 className="text-[30px] font-extrabold tracking-tight sm:text-[36px]">{t.web.appTitle}</h2>
          <p className="max-w-xl text-[17px] leading-relaxed opacity-90">{t.web.appFeatures}</p>
          <p className="max-w-xl rounded-full bg-white/15 px-4 py-2 text-[14px] font-medium">{t.web.appSoon}</p>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ id, title, subtitle, href }: { id: string; title: string; subtitle?: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-[28px] font-bold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-[15px] text-muted">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="shrink-0 text-[15px] font-semibold text-primary-text hover:underline">
          {t.common.seeAll}
        </Link>
      ) : null}
    </div>
  );
}
