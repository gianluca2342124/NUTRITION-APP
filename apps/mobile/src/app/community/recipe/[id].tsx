import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { defaultMealForDate, formatNumber } from '@repo/core';
import { communityRecipeNutrition, type CommunityRecipe } from '@repo/data';
import { Avatar } from '@/components/avatar';
import { MacroTrio } from '@/components/cards';
import { FoodImage } from '@/components/food-image';
import { Appear } from '@/components/motion';
import { FriendlyEmptyState } from '@/components/states';
import { Button, Card, IconButton, Notice, Row, Screen, Skeleton, Text, haptic } from '@/components/ui';
import { useAuthorProfile, useCommunityRecipe, useMediaUrl } from '@/lib/community';
import { errorMessage } from '@/lib/errors';
import { uuid } from '@/lib/ids';
import { useT } from '@/lib/i18n';
import { categoryArt, foodImageUri } from '@/lib/media';
import { today, useSaveMeal } from '@/lib/queries';
import { radius, space } from '@/lib/theme';

/** A published community recipe: the author's photo, catalogue nutrition, real logging. */
export default function CommunityRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useT();
  const recipe = useCommunityRecipe(id);
  const header = (
    <Row style={{ paddingTop: space.sm }}>
      <IconButton icon="chevronLeft" label={t.common.back} onPress={() => router.back()} />
    </Row>
  );
  if (recipe.isLoading) {
    return (
      <Screen>
        {header}
        <Skeleton height={230} style={{ marginTop: space.sm, borderRadius: radius.xl }} />
      </Screen>
    );
  }
  if (!recipe.data || recipe.data.status !== 'published') {
    return (
      <Screen>
        {header}
        <FriendlyEmptyState expression="curious" title={t.community.notFound} />
      </Screen>
    );
  }
  return (
    <Screen>
      {header}
      <RecipeBody recipe={recipe.data} />
    </Screen>
  );
}

function RecipeBody({ recipe }: { recipe: CommunityRecipe }) {
  const { t, f, locale } = useT();
  const save = useSaveMeal();
  const author = useAuthorProfile(recipe.authorId);
  const photo = useMediaUrl('community-media', recipe.imagePath);
  const n = useMemo(() => communityRecipeNutrition(recipe), [recipe]);
  const [ids] = useState(() => ({ entry: uuid(), items: recipe.ingredients.map(() => uuid()) }));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = author.data?.displayName ?? (author.data?.username ? `@${author.data.username}` : null);

  const addServing = async () => {
    setError(null);
    try {
      await save.mutateAsync({
        id: ids.entry,
        consumedOn: today(),
        consumedAt: new Date().toISOString(),
        mealType: defaultMealForDate(new Date()),
        title: recipe.title,
        method: 'recipe',
        items: recipe.ingredients.map((i, index) => ({
          id: ids.items[index]!,
          foodKind: i.kind,
          genericFoodId: i.kind === 'generic_food' ? i.foodId : null,
          productId: i.kind === 'product' ? i.foodId : null,
          displayName: i.label,
          amount: Math.round((i.grams / recipe.servings) * 10) / 10,
          isEstimate: false,
        })),
      });
      haptic.success();
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  };

  return (
    <View style={{ gap: space.lg, marginTop: space.sm }}>
      <Appear index={0}>
        <FoodImage uri={photo} fallback="recipe" width="100%" height={240} radius={radius.xl} label={recipe.title} />
        {photo ? (
          <Text variant="caption" color="textTertiary" style={{ marginTop: 4 }}>
            {t.community.photoByAuthor}
          </Text>
        ) : null}
      </Appear>
      <View style={{ gap: space.xs }}>
        <Text variant="largeTitle" accessibilityRole="header">
          {recipe.title}
        </Text>
        <Row gap={space.xs}>
          <Avatar path={author.data?.avatarPath} name={name} size={28} />
          <Text variant="secondaryStrong" color="textSecondary">
            {name ? f(t.community.by, { name }) : t.community.anonymous}
          </Text>
        </Row>
        {recipe.summary ? (
          <Text variant="body" color="textSecondary">
            {recipe.summary}
          </Text>
        ) : null}
        <Text variant="secondaryStrong" color="textSecondary">
          {[recipe.minutes ? f(t.recipes.minutes, { value: recipe.minutes }) : null, recipe.servings === 1 ? t.recipes.servingOne : f(t.recipes.servings, { value: recipe.servings })]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      <Card style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text variant="eyebrow" color="textSecondary">
            {t.recipes.perServing}
          </Text>
          <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {n.perServing.energy_kcal == null ? '—' : `${formatNumber(n.perServing.energy_kcal, locale)} kcal`}
          </Text>
        </Row>
        <MacroTrio protein={n.perServing.protein_g} carbs={n.perServing.carbs_g} fat={n.perServing.fat_g} />
        {error ? <Notice tone="error" text={error} /> : null}
        {saved ? <Notice tone="success" text={t.review.saved} /> : <Button title={t.recipes.addToDiary} icon="plus" onPress={addServing} loading={save.isPending} />}
      </Card>

      <View style={{ gap: space.xs }}>
        <Text variant="section">{t.recipes.ingredients}</Text>
        {recipe.ingredients.map((i, idx) => (
          <Row key={idx} gap={space.sm}>
            <FoodImage uri={i.imageUrl ?? foodImageUri(i.slug)} fallback={categoryArt(i.category)} width={44} height={44} radius={12} fit={i.kind === 'product' ? 'contain' : 'cover'} />
            <Text variant="body" style={{ flex: 1 }}>
              {i.label}
            </Text>
            <Text variant="secondaryStrong" color="textSecondary">
              {formatNumber(i.grams, locale)} {i.basis === '100ml' ? 'ml' : 'g'}
            </Text>
          </Row>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="section">{t.recipes.steps}</Text>
        {recipe.steps.map((s, idx) => (
          <Row key={idx} gap={space.sm} style={{ alignItems: 'flex-start' }}>
            <Text variant="bodyStrong" color="primaryText" style={{ width: 22 }}>
              {idx + 1}
            </Text>
            <Text variant="body" style={{ flex: 1 }}>
              {s}
            </Text>
          </Row>
        ))}
      </View>

      <Text variant="caption" color="textTertiary">
        {t.community.reviewed}
      </Text>
    </View>
  );
}
