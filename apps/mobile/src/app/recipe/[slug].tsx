import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { defaultMealForDate, recipeNutrition, recipeTags, type Recipe } from '@repo/core';
import { MacroTrio } from '@/components/cards';
import { FoodImage } from '@/components/food-image';
import { AnimatedCounter, Appear } from '@/components/motion';
import { FriendlyEmptyState } from '@/components/states';
import { Button, Card, ErrorState, IconButton, Notice, Row, Screen, Skeleton, Text } from '@/components/ui';
import { trackActivity } from '@/lib/activity';
import { errorMessage } from '@/lib/errors';
import { uuid } from '@/lib/ids';
import { useT } from '@/lib/i18n';
import { foodImageUri } from '@/lib/media';
import { today, useRecipe, useSaveMeal } from '@/lib/queries';
import { radius, space, usePalette } from '@/lib/theme';

export default function RecipeScreen() {
  const { t } = useT();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const recipe = useRecipe(slug);
  return (
    <Screen>
      <Row style={{ paddingTop: space.sm }}>
        <IconButton icon="chevronLeft" label={t.common.back} onPress={() => router.back()} />
      </Row>
      {recipe.isLoading ? (
        <View style={{ gap: space.md, marginTop: space.md }}>
          <Skeleton height={220} style={{ borderRadius: radius.xl }} />
          <Skeleton height={32} width="70%" />
        </View>
      ) : recipe.isError ? (
        <ErrorState message={errorMessage(recipe.error, t)} onRetry={() => recipe.refetch()} retryLabel={t.common.retry} />
      ) : !recipe.data ? (
        <FriendlyEmptyState expression="curious" title={t.recipes.empty} />
      ) : (
        <RecipeDetail recipe={recipe.data} />
      )}
    </Screen>
  );
}

function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const { t, f, locale } = useT();
  const p = usePalette();
  const save = useSaveMeal();
  const en = locale === 'en';
  const n = useMemo(() => recipeNutrition(recipe), [recipe]);
  const tags = recipeTags(recipe, n);
  const [ids] = useState(() => ({ entry: uuid(), items: recipe.ingredients.map(() => uuid()) }));
  const [saved, setSaved] = useState(false);
  const [cooked, setCooked] = useState(false);
  const title = en ? recipe.titleEn : recipe.titleEs;
  const image = foodImageUri(recipe.imageKey, 'wide');

  const addServing = async () => {
    await save.mutateAsync({
      id: ids.entry,
      consumedOn: today(),
      consumedAt: new Date().toISOString(),
      mealType: recipe.mealTypes[0] ?? defaultMealForDate(new Date()),
      title,
      method: 'recipe',
      items: recipe.ingredients.map((i, index) => ({
        id: ids.items[index]!,
        foodKind: 'generic_food',
        genericFoodId: i.foodId,
        displayName: en ? i.foodNameEn : i.foodNameEs,
        amount: Math.round((i.grams / recipe.servings) * 10) / 10,
        quantityLabel: recipe.servings > 1 ? null : en ? i.labelEn : i.labelEs,
        isEstimate: false,
      })),
    });
    setSaved(true);
  };

  return (
    <View style={{ gap: space.lg, marginTop: space.sm }}>
      <Appear index={0}>
        <FoodImage uri={image} fallback="recipe" width="100%" height={230} radius={radius.xl} />
        {image ? (
          <Text variant="caption" color="textTertiary" style={{ marginTop: 6 }}>
            {t.recipes.illustrativePhoto}
          </Text>
        ) : null}
        <Text variant="title" style={{ marginTop: space.md }} accessibilityRole="header">
          {title}
        </Text>
        {(en ? recipe.summaryEn : recipe.summaryEs) ? (
          <Text variant="body" color="textSecondary" style={{ marginTop: 4 }}>
            {en ? recipe.summaryEn : recipe.summaryEs}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm }}>
          <Tag text={f(t.recipes.minutes, { value: recipe.minutes })} />
          <Tag text={recipe.servings === 1 ? t.recipes.servingOne : f(t.recipes.servings, { value: recipe.servings })} />
          {tags
            .filter((x) => x !== 'quick')
            .map((x) => (
              <Tag key={x} text={t.recipes.tags[x]} tone="primary" />
            ))}
        </View>
      </Appear>

      <Card style={{ gap: space.sm }}>
        <Text variant="caption" color="textSecondary">
          {t.recipes.perServing}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <AnimatedCounter value={Math.round(n.perServing.energy_kcal ?? 0)} format={(x) => String(Math.round(x))} variant="display" />
          <Text variant="bodyStrong" color="textSecondary">
            kcal
          </Text>
        </View>
        <MacroTrio protein={n.perServing.protein_g} carbs={n.perServing.carbs_g} fat={n.perServing.fat_g} />
        <Text variant="caption" color="textTertiary">
          {t.recipes.editorial}
        </Text>
      </Card>

      <View style={{ gap: space.sm }}>
        <Text variant="section">{t.recipes.ingredients}</Text>
        <Card style={{ paddingVertical: space.xs }}>
          {recipe.ingredients.map((i) => (
            <Pressable
              key={i.position}
              accessibilityRole="link"
              onPress={() => router.push(`/food/${i.foodId}`)}
              style={({ pressed }) => ({ paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}
            >
              <Text variant="body">{en ? i.labelEn : i.labelEs}</Text>
            </Pressable>
          ))}
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="section">{t.recipes.steps}</Text>
        {(en ? recipe.stepsEn : recipe.stepsEs).map((step, index) => (
          <View key={index} style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="secondaryStrong" color="primaryText">
                {index + 1}
              </Text>
            </View>
            <Text variant="body" style={{ flex: 1, paddingTop: 4 }}>
              {step}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        {save.isError ? <Notice tone="error" text={errorMessage(save.error, t)} /> : null}
        {saved ? <Notice tone="success" text={t.review.saved} /> : <Button title={t.recipes.addToDiary} icon="plus" loading={save.isPending} onPress={addServing} />}
        {cooked ? (
          <Notice tone="success" text={t.recipes.cookedDone} />
        ) : (
          <Button
            title={t.recipes.cooked}
            icon="check"
            variant="soft"
            onPress={() => {
              trackActivity('recipe_completed', recipe.slug);
              setCooked(true);
            }}
          />
        )}
      </View>
    </View>
  );
}

function Tag({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'primary' }) {
  const p = usePalette();
  return (
    <View style={{ borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 5, backgroundColor: tone === 'primary' ? p.primarySoft : p.surfaceMuted }}>
      <Text variant="caption" style={{ color: tone === 'primary' ? p.primaryText : p.textSecondary, fontWeight: '600' }}>
        {text}
      </Text>
    </View>
  );
}
