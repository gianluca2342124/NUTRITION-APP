import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { compareItems, computeFudyuScore, formatNutrient, localizedName, scoreInputFromProduct, type CatalogProduct } from '@repo/core';
import { FoodImage } from '@/components/food-image';
import { ScoreDial } from '@/components/score';
import { Button, Card, Divider, EmptyState, IconButton, Notice, Row, Screen, Text } from '@/components/ui';
import { trackActivity } from '@/lib/activity';
import { apiClient } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useProfile } from '@/lib/queries';
import { compareStore, useCompareIds } from '@/lib/stores';
import { space } from '@/lib/theme';

export default function CompareScreen() {
  const { t, f, locale } = useT();
  const ids = useCompareIds();
  const profile = useProfile();
  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: ['product-id', id], queryFn: () => apiClient().getProductById(id) })),
  });
  const products = results.map((r) => r.data).filter((x): x is CatalogProduct => !!x);
  const pairKey = products.length >= 2 ? products.map((x) => x.id).sort().join(',') : null;

  useEffect(() => {
    if (pairKey) trackActivity('comparison', pairKey);
  }, [pairKey]);

  const header = (
    <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
      <IconButton icon="chevronLeft" label={t.common.back} onPress={() => router.back()} />
      <Text variant="cardTitle">{t.compare.title}</Text>
      <View style={{ width: 44 }} />
    </Row>
  );

  if (products.length < 2) {
    return (
      <Screen>
        {header}
        {products[0] && (
          <Card style={{ marginTop: space.md }}>
            <Text variant="bodyStrong">{localizedName(products[0], locale) ?? products[0].gtin}</Text>
            <Text variant="secondary" color="textSecondary">
              {products[0].brand}
            </Text>
          </Card>
        )}
        <EmptyState
          icon="compare"
          title={t.compare.pickTwo}
          action={
            <View style={{ gap: space.sm }}>
              <Button title={t.scan.modeBarcode} icon="barcode" onPress={() => router.push({ pathname: '/scan', params: { mode: 'barcode' } })} />
              <Button title={t.common.search} icon="search" variant="secondary" onPress={() => router.push('/explore')} />
            </View>
          }
        />
      </Screen>
    );
  }

  const [a, b] = products as [CatalogProduct, CatalogProduct];
  const names = [localizedName(a, locale) ?? a.gtin, localizedName(b, locale) ?? b.gtin];
  const result = compareItems(
    products.map((x, i) => ({ id: x.id, name: names[i]!, basis: x.basis, nutrientsPer100: x.nutrientsPer100, categories: x.categories, additives: x.additives, novaGroup: x.novaGroup, netQuantity: x.netQuantity })),
    profile.data?.primaryGoal ?? null,
  );
  const unit = result.basis === '100ml' ? 'ml' : 'g';

  return (
    <Screen>
      {header}
      <Row gap={space.sm} style={{ marginTop: space.md, alignItems: 'stretch' }}>
        {products.map((x, i) => (
          <Card key={x.id} style={{ flex: 1, alignItems: 'center', gap: space.xs }}>
            <FoodImage uri={x.imageUrl} fallback="product" width={84} height={84} fit="contain" radius={16} />
            <Text variant="secondaryStrong" align="center" numberOfLines={2}>
              {names[i]}
            </Text>
            <Text variant="caption" color="textSecondary" align="center" numberOfLines={1}>
              {x.brand}
            </Text>
            <CompareScore product={x} />
            <Button title={t.common.remove} variant="ghost" size="md" onPress={() => compareStore.set(ids.filter((id) => id !== x.id))} />
          </Card>
        ))}
      </Row>

      <View style={{ marginTop: space.md, gap: space.xs }}>
        {result.issues.includes('different_basis') && <Notice tone="warning" text={t.compare.notComparableBasis} />}
        {result.issues.includes('different_category') && <Notice tone="info" text={t.compare.differentCategory} />}
        {result.issues.includes('missing_nutrition') && <Notice tone="info" text={t.compare.missingNutrition} />}
      </View>

      {result.statements.length > 0 ? (
        <Card style={{ marginTop: space.md, gap: space.sm }}>
          {result.statements.slice(0, 4).map((s) => (
            <Text key={s.key} variant="body">
              {f(t.compare.more, {
                name: names[s.moreIndex]!,
                nutrient: t.nutrients[s.key].toLowerCase(),
                unit,
                a: formatNutrient(s.key, s.more, locale),
                b: formatNutrient(s.key, s.less, locale),
              })}
            </Text>
          ))}
        </Card>
      ) : result.comparable ? (
        <View style={{ marginTop: space.md }}>
          <Notice tone="info" text={t.compare.noDifferences} />
        </View>
      ) : null}

      <Card style={{ marginTop: space.md }} padded={false}>
        {result.rows.map((row, idx) => (
          <View key={row.key}>
            {idx > 0 && <Divider />}
            <Row style={{ paddingHorizontal: space.md, paddingVertical: 10 }}>
              <Text variant="secondary" color="textSecondary" style={{ flex: 1 }}>
                {t.nutrients[row.key]}
              </Text>
              {row.values.map((v, i) => (
                <Text
                  key={i}
                  variant={row.highest === i ? 'bodyStrong' : 'body'}
                  color={v == null ? 'textTertiary' : 'ink'}
                  style={{ width: 96, textAlign: 'right', fontVariant: ['tabular-nums'] }}
                >
                  {formatNutrient(row.key, v, locale, { unknown: t.common.unknown })}
                </Text>
              ))}
            </Row>
          </View>
        ))}
        <Divider />
        <Row style={{ paddingHorizontal: space.md, paddingVertical: 10 }}>
          <Text variant="secondary" color="textSecondary" style={{ flex: 1 }}>
            {t.product.additives}
          </Text>
          {result.additiveCounts.map((c, i) => (
            <Text key={i} variant="body" style={{ width: 96, textAlign: 'right' }}>
              {c}
            </Text>
          ))}
        </Row>
        <Divider />
        <Row style={{ paddingHorizontal: space.md, paddingVertical: 10 }}>
          <Text variant="secondary" color="textSecondary" style={{ flex: 1 }}>
            NOVA
          </Text>
          {result.novaGroups.map((g, i) => (
            <Text key={i} variant="body" color={g == null ? 'textTertiary' : 'ink'} style={{ width: 96, textAlign: 'right' }}>
              {g ?? '—'}
            </Text>
          ))}
        </Row>
      </Card>
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.md }}>
        {result.basis === '100ml' ? t.common.per100ml : t.common.per100g} · {t.compare.noFinalVerdict}
      </Text>
    </Screen>
  );
}

function CompareScore({ product }: { product: CatalogProduct }) {
  const r = computeFudyuScore(scoreInputFromProduct(product));
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <ScoreDial result={r} size={92} />
    </View>
  );
}
