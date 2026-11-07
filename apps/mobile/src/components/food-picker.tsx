import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatNumber, type FoodMatch, type SearchHit } from '@repo/core';
import { Field, IconButton, ListRow, Notice, Row, Text } from './ui';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { matchFromFood, matchFromProduct } from '@/lib/matches';
import { space, usePalette } from '@/lib/theme';

/** Full-screen search to choose the catalogue food (or product) behind an item. */
export function FoodPicker({
  visible,
  initialQuery = '',
  suggestions = [],
  onPick,
  onClose,
}: {
  visible: boolean;
  initialQuery?: string;
  suggestions?: FoodMatch[];
  onPick: (match: FoodMatch) => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const p = usePalette();
  const [q, setQ] = useState(initialQuery);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = q.trim();
  const search = useQuery({
    queryKey: ['search', 'picker', query],
    queryFn: () => apiClient().search(query, ['generic_food', 'product'], 25),
    enabled: visible && query.length >= 2,
  });

  const choose = async (hit: SearchHit) => {
    setLoadingId(hit.id);
    setError(null);
    try {
      if (hit.kind === 'generic_food') onPick(matchFromFood(await apiClient().getGenericFood(hit.id), locale));
      else {
        const product = await apiClient().getProductById(hit.id);
        if (!product.nutritionAvailable) {
          setError(t.product.nutritionMissing);
          return;
        }
        onPick(matchFromProduct(product, locale));
      }
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: p.background }}>
        <Row style={{ padding: space.md, justifyContent: 'space-between' }}>
          <Text variant="section">{t.review.chooseFood}</Text>
          <IconButton icon="close" label={t.common.close} onPress={onClose} />
        </Row>
        <View style={{ paddingHorizontal: space.md, gap: space.sm }}>
          <Field value={q} onChangeText={setQ} placeholder={t.search.placeholder} autoFocus returnKeyType="search" />
          {error && <Notice tone="error" text={error} />}
        </View>
        <FlatList
          data={query.length >= 2 ? (search.data?.hits ?? []) : []}
          keyExtractor={(h) => `${h.kind}:${h.id}`}
          contentContainerStyle={{ padding: space.md, gap: 0 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            query.length < 2 && suggestions.length > 0 ? (
              <View>
                <Text variant="caption" color="textSecondary">
                  {t.review.alternatives}
                </Text>
                {suggestions.map((s) => (
                  <ListRow key={s.id} title={s.name} subtitle={`${formatNumber(s.nutrientsPer100.energy_kcal ?? 0, locale)} kcal · ${t.common.per100g}`} onPress={() => onPick(s)} />
                ))}
              </View>
            ) : search.isFetching ? (
              <ActivityIndicator color={p.primary} style={{ marginTop: space.lg }} />
            ) : search.isError ? (
              <Notice tone="error" text={errorMessage(search.error, t)} />
            ) : undefined
          }
          ListEmptyComponent={
            query.length >= 2 && !search.isFetching && !search.isError ? (
              <Text variant="secondary" color="textSecondary" style={{ marginTop: space.lg }}>
                {t.search.noResultsHint}
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.title}
              subtitle={[item.subtitle, item.energyKcalPer100 != null ? `${formatNumber(item.energyKcalPer100, locale)} kcal` : null].filter(Boolean).join(' · ')}
              right={loadingId === item.id ? <ActivityIndicator color={p.primary} /> : undefined}
              onPress={() => choose(item)}
            />
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
