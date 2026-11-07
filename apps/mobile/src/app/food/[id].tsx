import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { genericFoodName, type MealType } from '@repo/core';
import { AddToDiaryCard } from '@/components/add-to-diary';
import { NutrientTable } from '@/components/nutrition';
import { ErrorState, IconButton, Row, Screen, Skeleton, Text } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { matchFromFood } from '@/lib/matches';
import { radius, space } from '@/lib/theme';

export default function FoodScreen() {
  const { t, f, locale } = useT();
  const { id, meal } = useLocalSearchParams<{ id: string; meal?: string }>();
  const food = useQuery({ queryKey: ['food', id], queryFn: () => apiClient().getGenericFood(id) });

  return (
    <Screen>
      <Row style={{ paddingTop: space.sm }}>
        <IconButton icon="chevronLeft" label={t.common.back} onPress={() => router.back()} />
      </Row>
      {food.isLoading ? (
        <View style={{ gap: space.md, marginTop: space.md }}>
          <Skeleton height={32} width="70%" />
          <Skeleton height={220} style={{ borderRadius: radius.lg }} />
        </View>
      ) : food.isError || !food.data ? (
        <ErrorState message={errorMessage(food.error, t)} onRetry={() => food.refetch()} retryLabel={t.common.retry} />
      ) : (
        <>
          <Text variant="secondaryStrong" color="primaryText" style={{ marginTop: space.md }}>
            {t.foodCategories[food.data.category]}
          </Text>
          <Text variant="title">{genericFoodName(food.data, locale)}</Text>
          <Text variant="secondary" color="textSecondary">
            {locale === 'en' ? food.data.nameEs : food.data.nameEn}
          </Text>
          <View style={{ marginTop: space.md }}>
            <AddToDiaryCard
              match={matchFromFood(food.data, locale)}
              defaultGrams={food.data.portions.find((p) => /\bmedium\b/i.test(p.labelEn))?.grams ?? food.data.portions[0]?.grams ?? 100}
              meal={(meal as MealType) || null}
              method="search"
            />
          </View>
          <View style={{ marginTop: space.lg, gap: space.sm }}>
            <Text variant="section">{t.product.nutrition}</Text>
            <NutrientTable columns={[{ title: t.common.per100g, values: food.data.nutrientsPer100 }]} />
          </View>
          <Text variant="caption" color="textTertiary" style={{ marginTop: space.md }}>
            {f(t.food.dataFrom, { source: `USDA FoodData Central (FDC ${food.data.sourceId}, ${food.data.sourceVersion ?? ''})` })} · {food.data.license}
          </Text>
          <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
            {t.disclaimer.notMedical}
          </Text>
        </>
      )}
    </Screen>
  );
}
