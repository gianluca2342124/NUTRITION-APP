import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { formatNumber, normalizeBarcode, type SearchHit, type SearchKind } from '@repo/core';
import { Icon } from '@/components/icons';
import { Button, Card, Choice, EmptyState, Field, ListRow, Notice, Row, Screen, Text } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { useRecentFoods } from '@/lib/queries';
import { space, usePalette } from '@/lib/theme';

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function open(hit: SearchHit) {
  if (hit.kind === 'generic_food') router.push(`/food/${hit.id}`);
  else if (hit.kind === 'product') router.push({ pathname: '/product/[code]', params: { code: hit.slug?.split('-').pop() ?? hit.id } });
  else router.push(`/additive/${hit.id}`);
}

export default function ExploreScreen() {
  const { t, f, locale } = useT();
  const p = usePalette();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<SearchKind | 'all'>('all');
  const query = useDebounced(q.trim());
  const barcode = normalizeBarcode(query);
  const recent = useRecentFoods();
  const search = useQuery({
    queryKey: ['search', query, kind],
    queryFn: () => apiClient().search(query, kind === 'all' ? undefined : [kind], 30),
    enabled: query.length >= 2,
  });

  return (
    <Screen>
      <Text variant="largeTitle" style={{ paddingTop: space.sm }}>
        {t.nav.explore}
      </Text>
      <View style={{ marginTop: space.md }}>
        <Field value={q} onChangeText={setQ} placeholder={t.search.placeholder} returnKeyType="search" autoCorrect={false} accessibilityLabel={t.common.search} />
      </View>
      <Row gap={space.xs} style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
        {(['all', 'generic_food', 'product', 'additive'] as const).map((k) => (
          <Choice key={k} compact label={k === 'all' ? t.common.seeAll : t.search.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </Row>

      {barcode && (
        <Button
          title={t.search.barcodeDetected}
          icon="barcode"
          variant="secondary"
          style={{ marginTop: space.md }}
          onPress={() => router.push({ pathname: '/product/[code]', params: { code: barcode } })}
        />
      )}

      {query.length < 2 ? (
        <>
          {(recent.data?.length ?? 0) > 0 && (
            <View style={{ marginTop: space.lg }}>
              <Text variant="section">{t.search.recent}</Text>
              <Card style={{ marginTop: space.sm, paddingVertical: 0 }}>
                {recent.data!.map((r) => (
                  <ListRow
                    key={`${r.genericFoodId ?? r.productId ?? r.displayName}`}
                    title={r.displayName}
                    subtitle={r.quantityLabel ?? `${formatNumber(r.amount, locale)} ${r.basis === '100ml' ? 'ml' : 'g'}`}
                    onPress={
                      r.genericFoodId
                        ? () => router.push(`/food/${r.genericFoodId}`)
                        : undefined
                    }
                  />
                ))}
              </Card>
            </View>
          )}
          <EmptyState icon="search" title={t.search.placeholder} body={t.search.noResultsHint} />
        </>
      ) : search.isLoading ? (
        <ActivityIndicator color={p.primary} style={{ marginTop: space.xl }} />
      ) : search.isError ? (
        <View style={{ marginTop: space.md }}>
          <Notice tone="error" text={errorMessage(search.error, t)} />
        </View>
      ) : (search.data?.hits.length ?? 0) === 0 ? (
        <EmptyState icon="search" title={f(t.search.noResults, { query })} body={t.search.noResultsHint} />
      ) : (
        <Card style={{ marginTop: space.md, paddingVertical: 0 }}>
          {search.data!.hits.map((hit) => (
            <ListRow
              key={`${hit.kind}:${hit.id}`}
              title={hit.title}
              subtitle={[t.search.kinds[hit.kind], hit.subtitle].filter(Boolean).join(' · ')}
              leading={
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={hit.kind === 'generic_food' ? 'leaf' : hit.kind === 'product' ? 'barcode' : 'label'} size={18} color={p.primaryText} />
                </View>
              }
              right={
                hit.energyKcalPer100 != null ? (
                  <Text variant="secondaryStrong" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatNumber(hit.energyKcalPer100, locale)} kcal
                  </Text>
                ) : undefined
              }
              onPress={() => open(hit)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
