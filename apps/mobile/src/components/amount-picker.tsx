import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { formatNumber, type Basis, type Portion } from '@repo/core';
import { Choice, Field, IconButton, Row, Text } from './ui';
import { useT } from '@/lib/i18n';
import { space } from '@/lib/theme';

export interface AmountOption {
  key: string;
  label: string;
  grams: number;
}

/** Builds the selectable amounts for a food: household portions, serving, pack. */
export function amountOptions(args: {
  locale: string;
  portions?: readonly Portion[];
  servingQuantity?: number | null;
  netQuantity?: number | null;
  basis: Basis;
  t: { serving: string; package: string };
}): AmountOption[] {
  const unit = args.basis === '100ml' ? 'ml' : 'g';
  const out: AmountOption[] = (args.portions ?? []).map((p) => ({
    key: p.id,
    label: `${args.locale === 'en' ? p.labelEn : p.labelEs} · ${formatNumber(p.grams, args.locale, 0)} g`,
    grams: p.grams,
  }));
  if (args.servingQuantity) {
    out.push({ key: 'serving', label: args.t.serving.replace('{value}', `${formatNumber(args.servingQuantity, args.locale)} ${unit}`), grams: args.servingQuantity });
  }
  if (args.netQuantity && args.netQuantity <= 2000) {
    out.push({ key: 'package', label: args.t.package.replace('{value}', `${formatNumber(args.netQuantity, args.locale)} ${unit}`), grams: args.netQuantity });
  }
  return out;
}

/** Amount editor: exact grams/ml plus quick options. Calls back with grams and a label. */
export function AmountPicker({
  value,
  basis,
  options,
  onChange,
}: {
  value: number;
  basis: Basis;
  options: AmountOption[];
  onChange: (grams: number, label: string | null) => void;
}) {
  const { t, locale } = useT();
  const [text, setText] = useState(formatNumber(value, locale, 1));
  const [shown, setShown] = useState(value);
  const unit = basis === '100ml' ? 'ml' : 'g';

  // Keep the text field in sync when the value changes from outside (chips, steppers).
  if (shown !== value) {
    setShown(value);
    setText(formatNumber(value, locale, 1));
  }

  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n) && n > 0 && n <= 5000) onChange(n, null);
    else setText(formatNumber(value, locale, 1));
  };

  const step = (delta: number) => onChange(Math.min(5000, Math.max(1, Math.round(value + delta))), null);

  return (
    <View style={{ gap: space.sm }}>
      <Row gap={space.sm}>
        <IconButton icon="minus" label="−10" onPress={() => step(-10)} />
        <View style={{ flex: 1 }}>
          <Field
            value={text}
            onChangeText={setText}
            onEndEditing={(e) => commit(e.nativeEvent.text)}
            onSubmitEditing={(e) => commit(e.nativeEvent.text)}
            keyboardType="decimal-pad"
            returnKeyType="done"
            suffix={unit}
            accessibilityLabel={basis === '100ml' ? t.food.amountMl : t.food.amountGrams}
            style={{ textAlign: 'center', fontSize: 20, fontWeight: '700' }}
          />
        </View>
        <IconButton icon="plus" label="+10" onPress={() => step(10)} />
      </Row>
      {options.length > 0 && (
        <>
          <Text variant="caption" color="textSecondary">
            {t.food.portions}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            {options.map((o) => (
              <Choice key={o.key} compact label={o.label} selected={Math.abs(o.grams - value) < 0.05} onPress={() => onChange(o.grams, o.label.split(' · ')[0] ?? o.label)} />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}
