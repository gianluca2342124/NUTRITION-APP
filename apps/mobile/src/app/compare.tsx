import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { compareItems, computeFudyuScore, formatNutrient, localizedName, scoreInputFromProduct, type CatalogProduct } from '@repo/core';
import { FoodImage } from '@/components/food-image';
import { ScoreDial } from '@/components/score';
import { Icon } from '@/components/icons';
import { Button, Card, Divider, IconButton, Notice, PressableScale, Row, Screen, Text, haptic } from '@/components/ui';
import { trackActivity } from '@/lib/activity';
import { apiClient } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useProfile } from '@/lib/queries';
import { compareStore, useCompareIds } from '@/lib/stores';
import { radius, space, usePalette } from '@/lib/theme';

export default function CompareScreen() {
  const { t, f, locale } = useT();
  const p = usePalette();
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

  const scanAnother = () => {
    haptic.light();
    router.push({ pathname: '/scan', params: { mode: 'barcode', compare: '1' } });
  };

  if (products.length < 2) {
    const first = products[0];
    return (
      <Screen>
        {header}
        <Row gap={space.sm} style={{ marginTop: space.md, alignItems: 'stretch' }}>
          {first ? (
            <Card style={{ flex: 1, alignItems: 'center', gap: space.xs }}>
              <FoodImage uri={first.imageUrl} fallback="product" width={84} height={84} fit="contain" radius={16} />
              <Text variant="secondaryStrong" align="center" numberOfLines={2}>
                {localizedName(first, locale) ?? first.gtin}
              </Text>
              <CompareScore product={first} />
            </Card>
          ) : null}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t.compare.scanAnother}
            onPress={scanAnother}
            style={{ flex: 1, minHeight: 220, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: p.borderStrong, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.md }}
          >
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="barcode" size={28} color={p.onPrimary} />
            </View>
            <Text variant="bodyStrong" align="center" style={{ color: p.primaryText }}>
              {first ? t.compare.scanAnother : t.compare.scanFirst}
            </Text>
          </PressableScale>
        </Row>
        <Text variant="secondary" color="textSecondary" align="center" style={{ marginTop: space.md }}>
          {t.compare.pickTwo}
        </Text>
        <Button title={t.common.search} icon="search" variant="ghost" size="md" style={{ marginTop: space.xs }} onPress={() => router.navigate('/explore')} />
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
  // Only the score is compared here: the higher Fudyu Score gets a small badge.
  const [sa, sb] = products.map((x) => computeFudyuScore(scoreInputFromProduct(x)));
  const best = sa?.status === 'scored' && sb?.status === 'scored' && sa.score !== sb.score ? (sa.score > sb.score ? 0 : 1) : -1;

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
            {best === i ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: p.secondarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Icon name="check" size={12} color={p.secondaryText} strokeWidth={2.6} />
                <Text variant="micro" style={{ color: p.secondaryText }}>
                  {t.compare.higherScore}
                </Text>
              </View>
            ) : null}
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
