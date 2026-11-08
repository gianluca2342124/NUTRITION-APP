import { formatNumber, type NutrientKey, type NutrientValues } from '@repo/core';
import { NUTRIENT_ICON_PATHS, NUTRIENT_STATS } from '@repo/design';
import { LOCALE, t } from '@/lib/site';

function digits(key: NutrientKey, value: number): number {
  if (key === 'energy_kcal') return 0;
  if (key === 'salt_g') return value < 1 ? 2 : 1;
  return value >= 100 ? 0 : 1;
}

const cssVar = (token: string) => `var(--fy-${token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)})`;

/** Stat grid of the product card: icon, accent, big number, unit, small label. Unknown → "Sin dato". */
export function NutrientGrid({ values, basis }: { values: NutrientValues; basis: '100g' | '100ml' }) {
  return (
    <section aria-label={basis === '100ml' ? t.stats.per100ml : t.stats.per100g}>
      <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.1em] text-faint">{basis === '100ml' ? t.stats.per100ml : t.stats.per100g}</p>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
        {NUTRIENT_STATS.map((stat) => {
          const v = values[stat.key];
          const color = cssVar(stat.color);
          return (
            <li key={stat.key} className="rounded-[18px] border border-line bg-surface px-3.5 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }} aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    {NUTRIENT_ICON_PATHS[stat.icon].map((d, i) => (
                      <path key={i} d={d} stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                  </svg>
                </span>
                <span className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{t.stats.labels[stat.key]}</span>
              </div>
              {v == null ? (
                <p className="mt-2 text-[15px] font-semibold text-faint">{t.stats.unknown}</p>
              ) : (
                <p className="tabular mt-1.5 text-[26px] font-bold leading-none tracking-[-0.03em] text-ink">
                  {formatNumber(v, LOCALE, digits(stat.key, v))}
                  <span className="ml-1 text-[13px] font-semibold text-muted">{stat.unit}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
