import { useState } from 'react';
import { View } from 'react-native';
import { MEAL_TYPES, defaultMealForDate, formatNumber, scaleNutrients, type FoodMatch, type MealType } from '@repo/core';
import { AmountPicker, amountOptions } from './amount-picker';
import { MacroLine } from './nutrition';
import { Button, Card, Notice, Row, SegmentedControl, Text, haptic } from './ui';
import { errorMessage } from '@/lib/errors';
import { uuid } from '@/lib/ids';
import { useT } from '@/lib/i18n';
import { today, useSaveMeal } from '@/lib/queries';
import { space } from '@/lib/theme';

/**
 * Amount selection and an idempotent save for one catalogue item. Compact
 * mode (Today is chronological) files the meal by time instead of asking.
 */
export function AddToDiaryCard({
  match,
  defaultGrams,
  netQuantity,
  meal: initialMeal,
  method,
  onSaved,
  bare = false,
  compact = false,
  date,
  consumedAt,
}: {
  /** Inside a bottom sheet: no card chrome and no repeated title. */
  bare?: boolean;
  /** Hide the meal selector (meal inferred from the time). */
  compact?: boolean;
  match: FoodMatch;
  defaultGrams: number;
  netQuantity?: number | null;
  meal?: MealType | null;
  method: 'barcode' | 'search';
  /** Local day to log on (defaults to today) and the moment it was eaten. */
  date?: string;
  consumedAt?: string | null;
  onSaved?: (entryId: string) => void;
}) {
  const { t, locale } = useT();
  const save = useSaveMeal();
  const [grams, setGrams] = useState(defaultGrams);
  const [label, setLabel] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealType>(initialMeal ?? defaultMealForDate(consumedAt ? new Date(consumedAt) : new Date()));
  // One id per screen visit: double taps and retries never duplicate the entry.
  const [ids] = useState(() => ({ entry: uuid(), item: uuid() }));
  const [saved, setSaved] = useState(false);
  const values = scaleNutrients(match.nutrientsPer100, grams);

  const onSave = async () => {
    await save.mutateAsync({
      id: ids.entry,
      consumedOn: date ?? today(),
      consumedAt: consumedAt ?? new Date().toISOString(),
      mealType: meal,
      method,
      items: [
        {
          id: ids.item,
          foodKind: match.kind,
          genericFoodId: match.kind === 'generic_food' ? match.id : null,
          productId: match.kind === 'product' ? match.id : null,
          displayName: match.name,
          amount: grams,
          quantityLabel: label,
          isEstimate: false,
        },
      ],
    });
    haptic.success();
    setSaved(true);
    onSaved?.(ids.entry);
  };

  const body = (
    <>
      {bare ? null : <Text variant="cardTitle">{t.food.addTitle}</Text>}
      <AmountPicker
        value={grams}
        basis={match.basis}
        options={amountOptions({
          locale,
          portions: match.portions,
          servingQuantity: match.servingQuantity,
          netQuantity,
          basis: match.basis,
          t: { serving: t.product.serving, package: t.product.package },
        })}
        onChange={(g, l) => {
          setGrams(g);
          setLabel(l);
          setSaved(false);
        }}
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {formatNumber(values.energy_kcal ?? 0, locale)} kcal
          </Text>
          <MacroLine values={values} />
        </View>
      </Row>
      {compact ? null : <SegmentedControl value={meal} onChange={setMeal} options={MEAL_TYPES.map((m) => ({ value: m, label: t.meals[m] }))} />}
      {save.isError && <Notice tone="error" text={errorMessage(save.error, t)} />}
      {saved ? (
        <Notice tone="success" text={t.review.saved} />
      ) : (
        <Button title={t.product.addToDay} icon="plus" onPress={onSave} loading={save.isPending} />
      )}
    </>
  );
  return bare ? <View style={{ gap: space.md }}>{body}</View> : <Card style={{ gap: space.md }}>{body}</Card>;
}
