import { View } from 'react-native';
import { formatNumber, formatNutrient, type NutrientKey, type NutrientValues } from '@repo/core';
import { MetricRing } from './rings';
import { Card, Divider, Row, Text } from './ui';
import { useT } from '@/lib/i18n';
import { space, usePalette } from '@/lib/theme';

const MACROS = [
  { key: 'protein_g', color: 'protein' },
  { key: 'carbs_g', color: 'carbs' },
  { key: 'fat_g', color: 'fat' },
] as const;

/** Three macro tiles with small rings (eaten / target when a target exists). */
export function MacroTiles({ values, targets }: { values: NutrientValues; targets: Partial<Record<NutrientKey, number | null>> }) {
  const p = usePalette();
  const { t, f, locale } = useT();
  return (
    <Row gap={space.sm}>
      {MACROS.map(({ key, color }) => {
        const v = values[key] ?? 0;
        const target = targets[key] ?? null;
        return (
          <Card key={key} style={{ flex: 1, alignItems: 'flex-start', gap: space.xs, paddingVertical: space.md, paddingHorizontal: space.sm + 2 }}>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {t.nutrients[key]}
            </Text>
            <Text variant="cardTitle" style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1}>
              {formatNumber(v, locale, 0)} g
            </Text>
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {target ? f(t.today.ofTarget, { target: `${formatNumber(target, locale)} g` }) : ' '}
            </Text>
            <MetricRing size={48} stroke={6} progress={target ? v / target : null} color={p[color]} label={t.nutrients[key]}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: p[color] }} />
            </MetricRing>
          </Card>
        );
      })}
    </Row>
  );
}

const ROWS: { key: NutrientKey; indent?: boolean }[] = [
  { key: 'energy_kcal' },
  { key: 'fat_g' },
  { key: 'saturated_fat_g', indent: true },
  { key: 'carbs_g' },
  { key: 'sugars_g', indent: true },
  { key: 'fiber_g' },
  { key: 'protein_g' },
  { key: 'salt_g' },
];

/** EU-style nutrient declaration; unknown values are labelled, never zeroed. */
export function NutrientTable({ columns }: { columns: { title: string; values: NutrientValues }[] }) {
  const { t, locale } = useT();
  return (
    <Card padded={false}>
      <Row style={{ paddingHorizontal: space.md, paddingVertical: space.sm, justifyContent: 'flex-end', gap: space.md }}>
        {columns.map((c) => (
          <Text key={c.title} variant="caption" color="textSecondary" style={{ width: 92, textAlign: 'right' }}>
            {c.title}
          </Text>
        ))}
      </Row>
      {ROWS.map((row) => (
        <View key={row.key}>
          <Divider />
          <Row style={{ paddingHorizontal: space.md, paddingVertical: 10, gap: space.md }}>
            <Text
              variant={row.indent ? 'secondary' : 'body'}
              color={row.indent ? 'textSecondary' : 'ink'}
              style={{ flex: 1, paddingLeft: row.indent ? space.md : 0 }}
            >
              {row.key === 'saturated_fat_g' ? t.nutrients.ofWhichSaturates : row.key === 'sugars_g' ? t.nutrients.ofWhichSugars : t.nutrients[row.key]}
            </Text>
            {columns.map((c) => (
              <Text
                key={c.title}
                variant={row.indent ? 'secondary' : 'bodyStrong'}
                color={c.values[row.key] == null ? 'textTertiary' : 'ink'}
                style={{ width: 92, textAlign: 'right', fontVariant: ['tabular-nums'] }}
              >
                {formatNutrient(row.key, c.values[row.key], locale, { unknown: t.common.unknown })}
              </Text>
            ))}
          </Row>
        </View>
      ))}
    </Card>
  );
}

/** Compact one-line macro summary: "P 12 g · H 30 g · G 8 g". */
export function MacroLine({ values }: { values: NutrientValues }) {
  const { t, locale } = useT();
  const part = (k: 'protein_g' | 'carbs_g' | 'fat_g') => `${t.nutrients[k].charAt(0)} ${values[k] == null ? '—' : formatNumber(values[k]!, locale, 0)} g`;
  return (
    <Text variant="caption" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
      {[part('protein_g'), part('carbs_g'), part('fat_g')].join(' · ')}
    </Text>
  );
}
