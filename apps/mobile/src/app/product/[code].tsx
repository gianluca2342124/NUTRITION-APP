import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';
import {
  computeFudyuScore,
  formatNumber,
  localizedName,
  personalNotes,
  scaleNutrients,
  scoreInputFromProduct,
  type CatalogProduct,
  type MealType,
} from '@repo/core';
import { AddToDiaryCard } from '@/components/add-to-diary';
import { FudyuCharacter } from '@/components/art';
import { Collapsible } from '@/components/collapsible';
import { FoodImage } from '@/components/food-image';
import { Icon } from '@/components/icons';
import { Appear } from '@/components/motion';
import { NutrientTable } from '@/components/nutrition';
import { AdditiveRow, FudyuScoreRing, PersonalFit, ScoreExplanation } from '@/components/score';
import { BottomSheet } from '@/components/sheet';
import { FriendlyEmptyState } from '@/components/states';
import { Button, Card, ErrorState, IconButton, Notice, Row, Screen, Skeleton, Text } from '@/components/ui';
import { trackActivity } from '@/lib/activity';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { matchFromProduct } from '@/lib/matches';
import { useDiet, useHealthProfile } from '@/lib/profile-data';
import { useProfile } from '@/lib/queries';
import { toggleCompare, useCompareIds } from '@/lib/stores';
import { radius, shadow, space, usePalette } from '@/lib/theme';

export default function ProductScreen() {
  const { t } = useT();
  const { code, meal } = useLocalSearchParams<{ code: string; meal?: string }>();
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
        <View style={{ alignItems: 'center', marginTop: space.xl, gap: space.md }}>
          <FudyuCharacter expression="thinking" size={84} />
          <Text variant="bodyStrong" color="textSecondary">
            {t.product.analyzing}
          </Text>
        </View>
        <Skeleton height={220} style={{ marginTop: space.lg, borderRadius: radius.xl }} />
        <Skeleton height={28} width="70%" style={{ marginTop: space.md }} />
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
        <FriendlyEmptyState
          expression="curious"
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
  return <ProductDetail product={result.product} meal={(meal as MealType) || null} header={header} />;
}

function ProductDetail({ product, meal, header }: { product: CatalogProduct; meal: MealType | null; header: ReactNode }) {
  const { t, f, locale } = useT();
  const p = usePalette();
  const compareIds = useCompareIds();
  const health = useHealthProfile();
  const profile = useProfile();
  const diet = useDiet();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    trackActivity('product_analyzed', product.gtin);
  }, [product.gtin]);

  const score = useMemo(() => computeFudyuScore(scoreInputFromProduct(product)), [product]);
  const notes = useMemo(
    () =>
      personalNotes(product, {
        goals: profile.data ? [profile.data.primaryGoal, ...profile.data.goals] : [],
        allergies: health.data?.allergies ?? [],
        diet: diet.data ?? null,
      }),
    [product, profile.data, health.data, diet.data],
  );

  const name = localizedName(product, locale) ?? product.gtin;
  const unit = product.basis === '100ml' ? 'ml' : 'g';
  const ingredients = product.ingredientsTexts[locale] ?? product.ingredientsText;
  const inCompare = compareIds.includes(product.id);
  const allergenAlert = notes.find((n) => n.key === 'contains_allergen');
  const tracesAlert = notes.find((n) => n.key === 'may_contain_allergen');
  const additives = product.additiveInfo ?? [];
  const v = product.nutrientsPer100;

  return (
    <Screen>
      {header}

      {/* Hero */}
      <Appear index={0}>
        <View style={[{ marginTop: space.sm, borderRadius: radius.xl, backgroundColor: '#FFFFFF', padding: space.md, alignItems: 'center' }, shadow(p, 'card')]}>
          <FoodImage uri={product.imageUrl} fallback="product" width="100%" height={220} fit="contain" radius={radius.lg} label={name} />
        </View>
        <View style={{ marginTop: space.md, gap: 2 }}>
          {product.brand ? (
            <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {product.brand}
            </Text>
          ) : null}
          <Text variant="title" accessibilityRole="header">
            {name}
          </Text>
          {product.quantityText ? (
            <Text variant="secondary" color="textSecondary">
              {product.quantityText}
            </Text>
          ) : null}
        </View>
      </Appear>

      {/* Declared allergens the person marked: always visible, never in an accordion. */}
      {allergenAlert || tracesAlert ? (
        <View style={{ marginTop: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.md, borderRadius: radius.lg, backgroundColor: p.warningSoft }}>
          <FudyuCharacter expression="attention" size={44} animate={false} />
          <View style={{ flex: 1, gap: 2 }}>
            {allergenAlert ? (
              <Text variant="bodyStrong" style={{ color: p.warningText }}>
                {f(t.personal.contains_allergen, { list: allergenAlert.allergens!.map((a) => t.allergens[a].toLowerCase()).join(', ') })}
              </Text>
            ) : null}
            {tracesAlert ? (
              <Text variant="secondary" style={{ color: p.warningText }}>
                {f(t.personal.may_contain_allergen, { list: tracesAlert.allergens!.map((a) => t.allergens[a].toLowerCase()).join(', ') })}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Evaluation first */}
      <Appear index={1}>
        <Card style={{ marginTop: space.md, paddingVertical: space.xl, gap: space.lg }}>
          <FudyuScoreRing result={score} />
          {score.status === 'scored' ? <ScoreExplanation result={score} unit={unit} /> : null}
          <Pressable accessibilityRole="link" onPress={() => router.push('/methodology')} hitSlop={8} style={{ alignSelf: 'center' }}>
            <Text variant="secondaryStrong" color="primaryText">
              {t.score.methodology}
            </Text>
          </Pressable>
        </Card>
      </Appear>

      {/* Actions */}
      <Row gap={space.sm} style={{ marginTop: space.md }}>
        <Button
          title={inCompare ? t.product.compareAdded : t.product.compare}
          icon={inCompare ? 'check' : 'compare'}
          variant="soft"
          size="md"
          style={{ flex: 1 }}
          onPress={() => {
            if (!inCompare) toggleCompare(product.id);
            router.push('/compare');
          }}
        />
        {product.nutritionAvailable ? (
          <Button title={t.product.add} icon="plus" size="md" style={{ flex: 1 }} onPress={() => setAdding(true)} />
        ) : null}
      </Row>
      {!product.nutritionAvailable ? (
        <View style={{ marginTop: space.sm }}>
          <Notice tone="info" text={t.product.nutritionMissing} />
        </View>
      ) : null}

      <View style={{ marginTop: space.md }}>
        <PersonalFit notes={notes} unit={unit} />
      </View>

      {/* Everything else, on demand */}
      <Text variant="section" style={{ marginTop: space.xl, marginBottom: space.sm }}>
        {t.product.analysisTitle}
      </Text>
      <View style={{ gap: space.sm }}>
        {product.nutritionAvailable ? (
          <Collapsible
            title={t.product.nutrition}
            icon="chart"
            summary={f(t.product.nutritionSummary, {
              kcal: v.energy_kcal == null ? '—' : formatNumber(v.energy_kcal, locale, 0),
              protein: v.protein_g == null ? '—' : formatNumber(v.protein_g, locale, 1),
              unit,
            })}
          >
            <NutrientTable
              columns={[
                { title: product.basis === '100ml' ? t.common.per100ml : t.common.per100g, values: v },
                ...(product.servingQuantity ? [{ title: `${formatNumber(product.servingQuantity, locale)} ${unit}`, values: scaleNutrients(v, product.servingQuantity) }] : []),
              ]}
            />
          </Collapsible>
        ) : null}

        <Collapsible title={t.product.ingredients} icon="leaf" summary={ingredients ? ingredients.slice(0, 70) : t.product.ingredientsMissing}>
          <Text variant="secondary" color="textSecondary">
            {ingredients ?? t.product.ingredientsMissing}
          </Text>
          <Text variant="secondaryStrong" style={{ marginTop: space.xs }}>
            {t.product.allergens}
          </Text>
          <Text variant="secondary" color="textSecondary">
            {product.allergens.length ? product.allergens.map((a) => t.allergens[a]).join(', ') : t.product.noAllergens}
          </Text>
          {product.traces.length > 0 ? (
            <Text variant="secondary" color="textSecondary">
              {t.product.traces}: {product.traces.map((a) => t.allergens[a]).join(', ')}
            </Text>
          ) : null}
        </Collapsible>

        <Collapsible
          title={t.product.additives}
          icon="label"
          summary={
            additives.length === 0
              ? t.product.noAdditives
              : additives.length === 1
                ? t.product.additivesCountOne
                : f(t.product.additivesCountMany, { count: additives.length })
          }
        >
          {additives.length === 0 ? (
            <Text variant="secondary" color="textSecondary">
              {t.product.noAdditives}
            </Text>
          ) : (
            additives.map((a) => <AdditiveRow key={a.code} info={a} onPress={() => router.push(`/additive/${a.code}`)} />)
          )}
        </Collapsible>

        <Collapsible
          title={t.product.processing}
          icon="bolt"
          summary={product.novaGroup ? `NOVA ${product.novaGroup} · ${t.product.novaGroups[String(product.novaGroup) as '1']}` : t.product.processingUnknown}
        >
          <Text variant="secondary" color="textSecondary">
            {product.novaGroup ? `NOVA ${product.novaGroup}: ${t.product.novaGroups[String(product.novaGroup) as '1']}. ${t.product.novaSource}` : t.product.processingUnknown}
          </Text>
        </Collapsible>

        {score.status === 'scored' ? (
          <Collapsible title={f(t.score.nutriscoreTitle, { grade: score.nutriscore.grade.toUpperCase() })} icon="info" summary={f(t.score.nutritionPart, { value: score.nutritionScore })}>
            <Text variant="secondary" color="textSecondary">
              {f(t.score.nutriscoreBody, { points: score.nutriscore.score })}
            </Text>
            {score.nutriscore.components.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <Text variant="secondary" style={{ flex: 1 }}>
                  {t.score.components[c.id]}
                  {c.value == null ? ` · ${t.common.unknown}` : ''}
                </Text>
                <Text variant="secondaryStrong" color={c.kind === 'negative' ? 'textSecondary' : 'secondaryText'} style={{ fontVariant: ['tabular-nums'] }}>
                  {c.counted ? `${c.kind === 'negative' ? '−' : '+'}${f(t.score.pointsOf, { points: c.points, max: c.max })}` : t.score.notCounted}
                </Text>
              </View>
            ))}
            {score.adjustments.length ? (
              <Text variant="caption" color="textSecondary">
                {f(t.score.adjustmentsPart, { value: score.adjustments.reduce((s, a) => s + a.points, 0) })}
              </Text>
            ) : null}
            {score.unknown.length ? (
              <Text variant="caption" color="textTertiary">
                {f(t.score.unknownData, { list: score.unknown.map((u) => t.score.unknownItems[u]).join(', ') })}
              </Text>
            ) : null}
          </Collapsible>
        ) : null}

        <Collapsible title={t.product.sourcesTitle} icon="globe" summary={`Open Food Facts · ${product.license}`}>
          <Text variant="secondary" color="textSecondary">
            {f(t.product.dataSource, { source: 'Open Food Facts' })} · {product.license}
            {product.sourceLastModified ? ` · ${t.common.updated} ${product.sourceLastModified.slice(0, 10)}` : ''}
          </Text>
          {product.imageUrl ? (
            <Text variant="caption" color="textTertiary">
              {t.product.imageCredit}
            </Text>
          ) : null}
          {product.countries.length > 0 && !product.countries.includes('spain') ? (
            <Text variant="caption" color="textTertiary">
              {f(t.product.countriesNote, { countries: product.countries.slice(0, 4).join(', ') })}
            </Text>
          ) : null}
          {product.warnings.map((w) => (
            <Text key={w} variant="caption" color="textTertiary">
              {t.product.warnings[w]}
            </Text>
          ))}
          {product.sourceUrl ? (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(product.sourceUrl!)}>
              <Text variant="secondaryStrong" color="primaryText">
                {product.sourceUrl.replace(/^https?:\/\//, '')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="link" onPress={() => router.push('/methodology')}>
            <Text variant="secondaryStrong" color="primaryText">
              {t.score.methodology}
            </Text>
          </Pressable>
          <Text variant="caption" color="textTertiary">
            {t.score.disclaimer}
          </Text>
        </Collapsible>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.lg }}>
        <Icon name="info" size={14} color={p.textTertiary} />
        <Text variant="caption" color="textTertiary" style={{ flex: 1 }}>
          {t.disclaimer.notMedical}
        </Text>
      </View>

      <BottomSheet visible={adding} onClose={() => setAdding(false)} title={t.product.addToDiary}>
        <AddToDiaryCard
          bare
          match={matchFromProduct(product, locale)}
          defaultGrams={product.servingQuantity ?? 100}
          netQuantity={product.netQuantity}
          meal={meal}
          method="barcode"
          onSaved={() => setTimeout(() => setAdding(false), 900)}
        />
      </BottomSheet>
    </Screen>
  );
}
