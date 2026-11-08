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
 * Unknown values show "Sin dato" — never zero. Changes animate briefly.
 */
export function StatTile({
  stat,
  value,
  onEdit,
  width,
}: {
  stat: NutrientStat;
  value: number | null;
  onEdit?: () => void;
  width: number | `${number}%`;
}) {
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
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.stats.editTitle}: ${label}`}
            hitSlop={10}
            onPress={() => {
              haptic.light();
              onEdit();
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Icon name="edit" size={14} color={p.textTertiary} />
          </Pressable>
        ) : null}
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
  onEdit,
  keys,
}: {
  values: NutrientValues;
  onEdit?: (key: NutrientKey) => void;
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
        <StatTile key={stat.key} stat={stat} value={values[stat.key]} width={tileWidth} onEdit={onEdit ? () => onEdit(stat.key) : undefined} />
      ))}
    </View>
  );
}

/** "Por 100 g" / "Mi cantidad" switch with the current amount and a pencil to change it. */
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <View style={{ flexDirection: 'row', flex: 1, backgroundColor: p.surfaceMuted, borderRadius: radius.pill, padding: 3 }} accessibilityRole="tablist">
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
        accessibilityLabel={t.stats.editAmountTitle}
        onPress={() => {
          haptic.light();
          onEditAmount();
        }}
        hitSlop={8}
        style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
      >
        <Icon name="edit" size={18} color={p.primaryText} />
      </Pressable>
    </View>
  );
}
