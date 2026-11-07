import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { submitContribution } from '@repo/data';
import {
  MEAL_TYPES,
  defaultMealForDate,
  formatNumber,
  scaleNutrients,
  validateLabelNutrition,
  type Basis,
  type LabelNutrition,
  type MealType,
} from '@repo/core';
import { AmountPicker } from '@/components/amount-picker';
import { Button, Card, Choice, EmptyState, Field, IconButton, Notice, Row, Screen, SegmentedControl, Text, haptic } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { uuid } from '@/lib/ids';
import { useT } from '@/lib/i18n';
import { today, useSaveMeal } from '@/lib/queries';
import { labelStore, useLabelDraft } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { space, usePalette } from '@/lib/theme';

const FIELDS: { key: keyof LabelNutrition; unit: string }[] = [
  { key: 'energy_kcal', unit: 'kcal' },
  { key: 'energy_kj', unit: 'kJ' },
  { key: 'fat_g', unit: 'g' },
  { key: 'saturated_fat_g', unit: 'g' },
  { key: 'carbs_g', unit: 'g' },
  { key: 'sugars_g', unit: 'g' },
  { key: 'fiber_g', unit: 'g' },
  { key: 'protein_g', unit: 'g' },
  { key: 'salt_g', unit: 'g' },
];

export default function LabelScreen() {
  const { t, locale } = useT();
  const p = usePalette();
  const pending = useLabelDraft();
  const save = useSaveMeal();
  const draft = pending?.draft ?? null;

  const initialRaw = (): LabelNutrition => {
    if (!draft) return {} as LabelNutrition;
    if (draft.nutrientsPer100 && draft.basis === 'serving') {
      // Values were converted to per-100 server-side; edit them in that basis.
      const n = draft.nutrientsPer100;
      return { ...draft.raw, energy_kcal: n.energy_kcal, energy_kj: null, fat_g: n.fat_g, saturated_fat_g: n.saturated_fat_g, carbs_g: n.carbs_g, sugars_g: n.sugars_g, fiber_g: n.fiber_g, protein_g: n.protein_g, salt_g: n.salt_g, sodium_g: null };
    }
    return draft.raw;
  };

  const [raw, setRaw] = useState<LabelNutrition>(initialRaw);
  const [basis, setBasis] = useState<Basis | null>(draft?.basis === '100ml' ? '100ml' : draft?.basis === '100g' || draft?.basis === 'serving' ? '100g' : null);
  const [name, setName] = useState(draft?.productName ?? '');
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState<MealType>(defaultMealForDate(new Date()));
  const [ids] = useState(() => ({ entry: uuid(), item: uuid() }));
  const [contributed, setContributed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => (basis ? validateLabelNutrition(raw, basis) : null), [raw, basis]);

  if (!draft) {
    return (
      <Screen>
        <EmptyState icon="label" title={t.label.title} action={<Button title={t.common.close} onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const set = (key: keyof LabelNutrition, text: string) => {
    const n = Number(text.replace(',', '.'));
    setRaw((r) => ({ ...r, [key]: text.trim() === '' || !Number.isFinite(n) ? null : n }));
  };

  const canLog = !!validation && validation.nutrients.energy_kcal != null && !validation.issues.some((i) => i.code === 'macros_exceed_basis' || i.code === 'value_out_of_range');

  const logIt = async () => {
    if (!validation || !basis) return;
    setError(null);
    try {
      await save.mutateAsync({
        id: ids.entry,
        consumedOn: today(),
        consumedAt: new Date().toISOString(),
        mealType: meal,
        method: 'label',
        items: [
          {
            id: ids.item,
            foodKind: 'custom',
            displayName: name.trim() || t.label.title,
            amount: grams,
            per100: validation.nutrients,
            dataSource: 'label_scan',
          },
        ],
      });
      haptic.success();
      labelStore.set(null);
      router.back();
    } catch (e) {
      setError(errorMessage(e, t));
    }
  };

  const contribute = async () => {
    setError(null);
    try {
      await submitContribution(supabase(), {
        kind: 'label_scan',
        gtin: pending?.gtin ?? null,
        payload: { productName: name || null, brand: draft.brand, basis, nutrition: raw, ingredientsText: draft.ingredientsText, allergens: draft.allergens, netQuantityText: draft.netQuantityText },
      });
      setContributed(true);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  };

  return (
    <Screen edges={['top', 'bottom']} bottomInset={40}>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">{t.label.title}</Text>
          <Text variant="secondary" color="textSecondary">
            {t.label.subtitle}
          </Text>
        </View>
        <IconButton icon="close" label={t.common.close} onPress={() => router.back()} />
      </Row>

      {draft.legibility === 'unreadable' && (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          <Notice tone="warning" text={t.label.unreadable} />
          <Button title={t.product.scanLabel} icon="camera" variant="secondary" onPress={() => router.replace({ pathname: '/scan', params: { mode: 'label', gtin: pending?.gtin ?? '' } })} />
        </View>
      )}

      <View style={{ marginTop: space.md, gap: space.md }}>
        <Field label={t.label.productName} value={name} onChangeText={setName} />
        {draft.basis === 'unknown' && <Notice tone="warning" text={t.label.basisUnknown} />}
        <Row gap={space.xs}>
          <Choice compact label={t.common.per100g} selected={basis === '100g'} onPress={() => setBasis('100g')} />
          <Choice compact label={t.common.per100ml} selected={basis === '100ml'} onPress={() => setBasis('100ml')} />
        </Row>
      </View>

      <Card style={{ marginTop: space.md, gap: space.sm }}>
        {FIELDS.map(({ key, unit }) => {
          const low = draft.lowConfidenceFields.includes(key);
          return (
            <View key={key}>
              <Field
                label={`${key === 'energy_kj' ? 'Energía' : t.nutrients[key as keyof typeof t.nutrients] ?? key}${low ? ` · ${t.label.lowConfidence}` : ''}`}
                value={raw[key] == null ? '' : String(raw[key]).replace('.', locale === 'es' ? ',' : '.')}
                onChangeText={(v) => set(key, v)}
                keyboardType="decimal-pad"
                suffix={unit}
                style={low ? { color: p.warningText } : undefined}
              />
            </View>
          );
        })}
      </Card>

      {validation && validation.issues.length > 0 && (
        <View style={{ marginTop: space.md, gap: space.xs }}>
          {validation.issues.map((i) => (
            <Notice key={i.code} tone="warning" text={t.label.issues[i.code]} />
          ))}
        </View>
      )}

      {draft.ingredientsText ? (
        <Card style={{ marginTop: space.md, gap: space.xs }}>
          <Text variant="cardTitle">{t.product.ingredients}</Text>
          <Text variant="secondary" color="textSecondary">
            {draft.ingredientsText}
          </Text>
        </Card>
      ) : null}

      {canLog && validation && basis && (
        <Card style={{ marginTop: space.md, gap: space.md }}>
          <Text variant="cardTitle">{t.label.logIt}</Text>
          <AmountPicker value={grams} basis={basis} options={[]} onChange={(g) => setGrams(g)} />
          <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {formatNumber(scaleNutrients(validation.nutrients, grams).energy_kcal ?? 0, locale)} kcal
          </Text>
          <SegmentedControl value={meal} onChange={setMeal} options={MEAL_TYPES.map((m) => ({ value: m, label: t.meals[m] }))} />
          <Button title={t.product.addToDiary} icon="plus" onPress={logIt} loading={save.isPending} />
        </Card>
      )}

      {pending?.gtin ? (
        <View style={{ marginTop: space.md, gap: space.xs }}>
          {contributed ? (
            <Notice tone="success" text={t.label.contributed} />
          ) : (
            <>
              <Button title={t.label.contribute} variant="secondary" icon="download" onPress={contribute} disabled={!validation} />
              <Text variant="caption" color="textTertiary" align="center">
                {t.label.contributeHint}
              </Text>
            </>
          )}
        </View>
      ) : null}
      {error && (
        <View style={{ marginTop: space.sm }}>
          <Notice tone="error" text={error} />
        </View>
      )}
    </Screen>
  );
}
