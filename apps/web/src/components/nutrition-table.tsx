import { formatNutrient, type NutrientKey, type NutrientValues } from '@repo/core';
import { LOCALE, t } from '@/lib/site';

const ROWS: { key: NutrientKey; indent?: boolean; label?: string }[] = [
  { key: 'energy_kcal' },
  { key: 'fat_g' },
  { key: 'saturated_fat_g', indent: true, label: t.nutrients.ofWhichSaturates },
  { key: 'carbs_g' },
  { key: 'sugars_g', indent: true, label: t.nutrients.ofWhichSugars },
  { key: 'fiber_g' },
  { key: 'protein_g' },
  { key: 'salt_g' },
];

/**
 * EU-style nutrition declaration. Unknown values are shown as "Sin dato",
 * never as zero.
 */
export function NutritionTable({
  columns,
}: {
  columns: { title: string; values: NutrientValues }[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <table className="tabular w-full text-[15px]">
        <thead className="bg-surface-muted text-left text-[13px] uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">
              <span className="sr-only">{t.web.nutritionFacts}</span>
            </th>
            {columns.map((c) => (
              <th key={c.title} className="px-4 py-3 text-right font-semibold">
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key} className="border-t border-line">
              <th scope="row" className={`px-4 py-2.5 text-left font-normal ${row.indent ? 'pl-8 text-muted' : 'font-medium text-ink'}`}>
                {row.label ?? t.nutrients[row.key]}
              </th>
              {columns.map((c) => (
                <td key={c.title} className={`px-4 py-2.5 text-right ${c.values[row.key] == null ? 'text-faint' : 'text-ink'}`}>
                  {formatNutrient(row.key, c.values[row.key], LOCALE, { unknown: t.common.unknown })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
