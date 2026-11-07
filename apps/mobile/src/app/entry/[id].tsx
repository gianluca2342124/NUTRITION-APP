import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { MEAL_TYPES, formatNumber, scaleNutrients, type MealType } from '@repo/core';
import { getEntry, type DiaryEntry } from '@repo/data';
import { AmountPicker } from '@/components/amount-picker';
import { MacroLine } from '@/components/nutrition';
import { Button, Card, ErrorState, IconButton, Notice, Row, Screen, SegmentedControl, Skeleton, Text } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { useDeleteEntry, useDeleteItem, useUpdateEntry, useUpdateItem } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

function confirm(message: string, onYes: () => void, yes: string, no: string) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message)) onYes();
    return;
  }
  Alert.alert('', message, [
    { text: no, style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

export default function EntryScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useQuery({ queryKey: ['entry', id], queryFn: () => getEntry(supabase(), id) });
  const close = () => router.back();

  if (entry.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Skeleton height={32} width="60%" style={{ marginTop: space.lg }} />
      </Screen>
    );
  }
  if (entry.isError || !entry.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ErrorState message={errorMessage(entry.error, t)} onRetry={close} retryLabel={t.common.close} />
      </Screen>
    );
  }
  return <EntryEditor entry={entry.data} onChanged={() => entry.refetch()} onClose={close} />;
}

function EntryEditor({ entry: e, onChanged, onClose: close }: { entry: DiaryEntry; onChanged: () => void; onClose: () => void }) {
  const { t, locale } = useT();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const deleteEntry = useDeleteEntry();
  const updateEntry = useUpdateEntry();
  const [amounts, setAmounts] = useState<Record<string, number>>(() => Object.fromEntries(e.items.map((i) => [i.id, i.amount])));
  const [meal, setMeal] = useState<MealType>(e.mealType);
  const [error, setError] = useState<string | null>(null);

  const saveChanges = async () => {
    setError(null);
    try {
      for (const item of e.items) {
        const next = amounts[item.id];
        if (next != null && Math.abs(next - item.amount) > 0.001) {
          await updateItem.mutateAsync({ id: item.id, amount: next, label: null });
        }
      }
      if (meal !== e.mealType) await updateEntry.mutateAsync({ id: e.id, mealType: meal });
      close();
    } catch (err) {
      setError(errorMessage(err, t));
    }
  };

  return (
    <Screen edges={['top', 'bottom']} bottomInset={40}>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
        <Text variant="title" style={{ flex: 1 }} numberOfLines={2}>
          {e.title || e.items.map((i) => i.displayName).join(', ')}
        </Text>
        <IconButton icon="close" label={t.common.close} onPress={close} />
      </Row>
      <View style={{ marginTop: space.md }}>
        <SegmentedControl value={meal} onChange={setMeal} options={MEAL_TYPES.map((m) => ({ value: m, label: t.meals[m] }))} />
      </View>

      {e.items.map((item) => {
        const amount = amounts[item.id] ?? item.amount;
        const values = scaleNutrients(item.per100, amount);
        return (
          <Card key={item.id} style={{ marginTop: space.sm, gap: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="cardTitle">{item.displayName}</Text>
                <Text variant="caption" color="textSecondary">
                  {item.quantityLabel ?? ''}
                  {item.isEstimate ? ` · ${t.common.estimate}` : ''}
                </Text>
              </View>
              <IconButton
                icon="trash"
                size={36}
                label={t.common.delete}
                onPress={() =>
                  confirm(`${t.common.delete} “${item.displayName}”?`, () => deleteItem.mutate(item.id, { onSuccess: onChanged }), t.common.delete, t.common.cancel)
                }
              />
            </Row>
            <AmountPicker value={amount} basis={item.basis} options={[]} onChange={(g) => setAmounts((a) => ({ ...a, [item.id]: g }))} />
            <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
              {formatNumber(values.energy_kcal ?? 0, locale)} kcal
            </Text>
            <MacroLine values={values} />
          </Card>
        );
      })}

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        {error && <Notice tone="error" text={error} />}
        <Button title={t.common.save} icon="check" onPress={saveChanges} loading={updateItem.isPending || updateEntry.isPending} />
        <Button
          title={t.common.delete}
          icon="trash"
          variant="danger"
          onPress={() => confirm(t.common.delete + '?', () => deleteEntry.mutate(e.id, { onSuccess: close }), t.common.delete, t.common.cancel)}
        />
      </View>
    </Screen>
  );
}
