import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { formatNumber, type NutrientKey, type NutrientValues } from '@repo/core';
import { NUTRIENT_STATS, motion, type NutrientStat } from '@repo/design';
import { Icon, type IconName } from './icons';
import { useCountUp } from './motion';
import { Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { radius, space, usePalette, type Palette } from '@/lib/theme';

/** Decimals that read naturally for each nutrient (EU label style). */
function digits(key: NutrientKey, value: number): number {
  if (key === 'energy_kcal') return 0;
  if (key === 'salt_g') return value < 1 ? 2 : 1;
  return value >= 100 ? 0 : 1;
}

/**
 * One stat of the product card: icon, accent, big number, unit, small label.
 * Read-only: unknown values show "Sin dato" — never zero. Changes animate briefly.
 */
export function StatTile({ stat, value, width }: { stat: NutrientStat; value: number | null; width: number | `${number}%` }) {
  const p = usePalette();
  const { t, locale } = useT();
  const accent = p[stat.color as keyof Palette];
  const shown = useCountUp(value, motion.micro + 120);
  const label = t.stats.labels[stat.key];
  const text = value == null ? null : formatNumber(shown ?? value, locale, digits(stat.key, value));
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value == null ? t.stats.unknown : `${formatNumber(value, locale, digits(stat.key, value))} ${stat.unit}`}`}
      style={{
        width,
        borderRadius: radius.md,
        backgroundColor: p.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: p.border,
        paddingHorizontal: space.sm,
        paddingVertical: space.sm,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: `${accent}1F`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={stat.icon as IconName} size={15} color={accent} strokeWidth={2.2} />
        </View>
        <Text variant="eyebrow" color="textSecondary" numberOfLines={1} style={{ flex: 1, fontSize: 10.5, letterSpacing: 0.4 }}>
          {label}
        </Text>
      </View>
      {text == null ? (
        <Text variant="bodyStrong" color="textTertiary">
          {t.stats.unknown}
        </Text>
      ) : (
        <Text variant="metric" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
          {text}
          <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
            {' '}
            {stat.unit}
          </Text>
        </Text>
      )}
    </View>
  );
}

/** Eight-stat grid: two columns on phones, four on wide screens. */
export function NutrientGrid({
  values,
  keys,
}: {
  values: NutrientValues;
  /** Subset/order of nutrients (defaults to all eight). */
  keys?: readonly NutrientKey[];
}) {
  const { width } = useWindowDimensions();
  const columns = width >= 600 ? 4 : 2;
  const gap = space.xs;
  const stats = keys ? NUTRIENT_STATS.filter((s) => keys.includes(s.key)) : NUTRIENT_STATS;
  const tileWidth = `${(100 - ((columns - 1) * 2)) / columns}%` as `${number}%`;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: gap }}>
      {stats.map((stat) => (
        <StatTile key={stat.key} stat={stat} value={values[stat.key]} width={tileWidth} />
      ))}
    </View>
  );
}

/** "Por 100 g" / "Mi cantidad" switch, plus a labelled action to change the amount. */
export function BasisToggle({
  mode,
  onMode,
  basis,
  amountLabel,
  onEditAmount,
}: {
  mode: 'per100' | 'mine';
  onMode: (m: 'per100' | 'mine') => void;
  basis: 'g' | 'ml';
  amountLabel: string;
  onEditAmount: () => void;
}) {
  const p = usePalette();
  const { t } = useT();
  const options: { value: 'per100' | 'mine'; label: string }[] = [
    { value: 'per100', label: basis === 'ml' ? t.stats.per100ml : t.stats.per100g },
    { value: 'mine', label: amountLabel },
  ];
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', backgroundColor: p.surfaceMuted, borderRadius: radius.pill, padding: 3 }} accessibilityRole="tablist">
        {options.map((o) => {
          const active = o.value === mode;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (active) return;
                haptic.selection();
                onMode(o.value);
              }}
              style={{ flex: 1, minHeight: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? p.surface : 'transparent', paddingHorizontal: space.xs }}
            >
              <Text variant="caption" numberOfLines={1} style={{ fontWeight: active ? '700' : '600', color: active ? p.ink : p.textSecondary }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.stats.changeAmount}
        onPress={() => {
          haptic.light();
          onEditAmount();
        }}
        hitSlop={6}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, alignSelf: 'flex-end', backgroundColor: p.primarySoft, opacity: pressed ? 0.6 : 1 })}
      >
        <Icon name="scale" size={16} color={p.primaryText} />
        <Text variant="caption" style={{ color: p.primaryText, fontWeight: '700' }} numberOfLines={1}>
          {t.stats.changeAmount}
        </Text>
      </Pressable>
    </View>
  );
}
