import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { displayENumber, localizedName, scaleNutrients, type MealType } from '@repo/core';
import { AddToDiaryCard } from '@/components/add-to-diary';
import { NutrientTable } from '@/components/nutrition';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, Notice, Row, Screen, Skeleton, Text } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { matchFromProduct } from '@/lib/matches';
import { useHealthProfile } from '@/lib/profile-data';
import { toggleCompare, useCompareIds } from '@/lib/stores';
import { radius, space, usePalette } from '@/lib/theme';

export default function ProductScreen() {
  const { t, f, locale } = useT();
  const p = usePalette();
  const { code, meal } = useLocalSearchParams<{ code: string; meal?: string }>();
  const compareIds = useCompareIds();
  const health = useHealthProfile();
  const lookup = useQuery({ queryKey: ['product', code], queryFn: () => apiClient().lookupProduct(code), retry: 1 });

  const header = (
    <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
      <IconButton icon="chevronLeft" label={t.common.back} onPress={() => router.back()} />
    </Row>
  );

  if (lookup.isLoading) {
    return (
      <Screen>
        {header}
        <Text variant="secondary" color="textSecondary" style={{ marginTop: space.lg }}>
          {t.scan.lookingUp}
        </Text>
        <Skeleton height={220} style={{ marginTop: space.md, borderRadius: radius.lg }} />
        <Skeleton height={28} width="70%" style={{ marginTop: space.md }} />
        <Skeleton height={120} style={{ marginTop: space.md, borderRadius: radius.lg }} />
      </Screen>
    );
  }
  if (lookup.isError) {
    return (
      <Screen>
        {header}
        <ErrorState message={errorMessage(lookup.error, t)} onRetry={() => lookup.refetch()} retryLabel={t.common.retry} />
      </Screen>
    );
  }
  const result = lookup.data!;
  if (result.status !== 'found') {
    return (
      <Screen>
        {header}
        <EmptyState
          icon="barcode"
          title={result.status === 'invalid_code' ? t.scan.invalidCode : t.product.notFoundTitle}
          body={result.status === 'not_found' ? `${t.product.notFoundBody}\n\nEAN ${result.gtin}` : undefined}
          action={
            result.status === 'not_found' ? (
              <Button title={t.product.scanLabel} icon="label" onPress={() => router.replace({ pathname: '/scan', params: { mode: 'label', gtin: result.gtin } })} />
            ) : undefined
          }
        />
      </Screen>
    );
  }

  const product = result.product;
  const name = localizedName(product, locale) ?? product.gtin;
  const userAllergies = health.data?.allergies ?? [];
  const flagged = product.allergens.filter((a) => userAllergies.includes(a));
  const ingredients = product.ingredientsTexts[locale] ?? product.ingredientsText;
  const unit = product.basis === '100ml' ? 'ml' : 'g';
  const inCompare = compareIds.includes(product.id);

  return (
    <Screen>
      {header}
      <View style={{ alignItems: 'center', marginTop: space.sm }}>
        <View style={{ width: 200, height: 200, borderRadius: radius.lg, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={{ width: 180, height: 180 }} contentFit="contain" accessibilityLabel={name} />
          ) : (
            <Text variant="caption" color="textTertiary">
              —
            </Text>
          )}
        </View>
      </View>
      {product.brand && (
        <Text variant="secondaryStrong" color="textSecondary" style={{ marginTop: space.md, textTransform: 'uppercase' }}>
          {product.brand}
        </Text>
      )}
      <Text variant="title">{name}</Text>
      <Text variant="secondary" color="textSecondary">
        {[product.quantityText, `EAN ${product.gtin}`].filter(Boolean).join(' · ')}
      </Text>

      {flagged.length > 0 && (
        <View style={{ marginTop: space.md }}>
          <Notice tone="warning" text={f(t.product.allergenWarning, { list: flagged.map((a) => t.allergens[a]).join(', ') })} />
        </View>
      )}

      <Row gap={space.xs} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
        {product.nutriscoreGrade && <Badge text={`Nutri-Score ${product.nutriscoreGrade.toUpperCase()}`} />}
        {product.novaGroup && <Badge text={`NOVA ${product.novaGroup} · ${t.product.novaGroups[String(product.novaGroup) as '1']}`} />}
      </Row>
      {(product.nutriscoreGrade || product.novaGroup) && (
        <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
          {[product.nutriscoreGrade ? t.product.nutriscoreSource : null, product.novaGroup ? t.product.novaSource : null].filter(Boolean).join(' ')}
        </Text>
      )}

      <Row gap={space.sm} style={{ marginTop: space.md }}>
        <Button
          title={inCompare ? `${t.product.compare} ✓` : t.product.compare}
          icon="compare"
          variant="secondary"
          size="md"
          style={{ flex: 1 }}
          onPress={() => {
            if (!inCompare) toggleCompare(product.id);
            router.push('/compare');
          }}
        />
      </Row>

      <View style={{ marginTop: space.md }}>
        {product.nutritionAvailable ? (
          <AddToDiaryCard
            match={matchFromProduct(product, locale)}
            defaultGrams={product.servingQuantity ?? 100}
            netQuantity={product.netQuantity}
            meal={(meal as MealType) || null}
            method="barcode"
          />
        ) : (
          <Notice tone="warning" text={t.product.nutritionMissing} />
        )}
      </View>

      {product.warnings.length > 0 && (
        <View style={{ marginTop: space.md, gap: space.xs }}>
          {product.warnings.map((w) => (
            <Notice key={w} tone="info" text={t.product.warnings[w]} />
          ))}
        </View>
      )}

      {product.nutritionAvailable && (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Text variant="section">{t.product.nutrition}</Text>
          <NutrientTable
            columns={[
              { title: product.basis === '100ml' ? t.common.per100ml : t.common.per100g, values: product.nutrientsPer100 },
              ...(product.servingQuantity ? [{ title: `${product.servingQuantity} ${unit}`, values: scaleNutrients(product.nutrientsPer100, product.servingQuantity) }] : []),
            ]}
          />
        </View>
      )}

      <Card style={{ marginTop: space.lg, gap: space.sm }}>
        <Text variant="cardTitle">{t.product.ingredients}</Text>
        <Text variant="secondary" color="textSecondary">
          {ingredients ?? t.product.ingredientsMissing}
        </Text>
        <Text variant="cardTitle" style={{ marginTop: space.sm }}>
          {t.product.allergens}
        </Text>
        <Text variant="secondary" color="textSecondary">
          {product.allergens.length ? product.allergens.map((a) => t.allergens[a]).join(', ') : t.product.noAllergens}
        </Text>
        {product.traces.length > 0 && (
          <Text variant="secondary" color="textSecondary">
            {t.product.traces}: {product.traces.map((a) => t.allergens[a]).join(', ')}
          </Text>
        )}
        <Text variant="cardTitle" style={{ marginTop: space.sm }}>
          {t.product.additives}
        </Text>
        {product.additives.length ? (
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {product.additives.map((code) => (
              <Pressable key={code} accessibilityRole="link" onPress={() => router.push(`/additive/${code}`)}>
                <Badge text={displayENumber(code)} />
              </Pressable>
            ))}
          </Row>
        ) : (
          <Text variant="secondary" color="textSecondary">
            {t.product.noAdditives}
          </Text>
        )}
      </Card>

      <View style={{ marginTop: space.lg, gap: space.xs }}>
        {product.countries.length > 0 && !product.countries.includes('spain') && (
          <Text variant="caption" color="textTertiary">
            {f(t.product.countriesNote, { countries: product.countries.slice(0, 4).join(', ') })}
          </Text>
        )}
        <Text variant="caption" color="textTertiary">
          {f(t.product.dataSource, { source: 'Open Food Facts' })} · {product.license}
          {product.sourceLastModified ? ` · ${t.common.updated} ${product.sourceLastModified.slice(0, 10)}` : ''}
        </Text>
        <Text variant="caption" color="textTertiary">
          {t.disclaimer.notMedical}
        </Text>
      </View>
    </Screen>
  );
}
