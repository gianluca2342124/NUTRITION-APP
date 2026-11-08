import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  formatNumber,
  normalizeBarcode,
  QUICK_MINUTES,
  RECIPE_FILTERS,
  recipeMatches,
  recipeNutrition,
  recipeTags,
  type Recipe,
  type RecipeFilter,
  type SearchHit,
  type SearchKind,
} from '@repo/core';
import { FoodCard, RecipeCard } from '@/components/cards';
import { FoodImage } from '@/components/food-image';
import { Icon } from '@/components/icons';
import { FriendlyEmptyState } from '@/components/states';
import { Button, Card, Chip, ListRow, Notice, Screen, SectionHeader, Text } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { categoryArt, foodImageUri } from '@/lib/media';
import { useAdditiveCards, useFoodsBySlugs, useRecentFoods, useRecipes } from '@/lib/queries';
import { radius, shadow, space, usePalette } from '@/lib/theme';

const DISCOVER_FOODS = ['copos-de-avena', 'aguacate', 'salmon', 'huevo', 'yogur-natural', 'garbanzos-cocidos'] as const;
const ADDITIVES = ['e330', 'e171', 'e322', 'e300'] as const;

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

      {/* Search */}
      <View
        style={[
          { marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.xs, height: 52, borderRadius: radius.pill, backgroundColor: p.surface, paddingHorizontal: space.md },
          shadow(p, 'card'),
        ]}
      >
        <Icon name="search" size={20} color={p.textTertiary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t.search.placeholder}
          placeholderTextColor={p.textTertiary}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={t.common.search}
          maxFontSizeMultiplier={1.4}
          style={{ flex: 1, fontSize: 16, color: p.ink, paddingVertical: 0 }}
        />
        {q ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t.common.close} onPress={() => setQ('')} hitSlop={10}>
            <Icon name="close" size={18} color={p.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      {query.length >= 2 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.sm, marginHorizontal: -space.md }} contentContainerStyle={{ gap: space.xs, paddingHorizontal: space.md }}>
            {(['all', 'generic_food', 'product', 'additive'] as const).map((k) => (
              <Chip key={k} label={k === 'all' ? t.recipes.filters.all : t.search.kinds[k]} selected={kind === k} onPress={() => setKind(k)} />
            ))}
          </ScrollView>
          {barcode ? (
            <Button
              title={t.search.barcodeDetected}
              icon="barcode"
              variant="soft"
              style={{ marginTop: space.md }}
              onPress={() => router.push({ pathname: '/product/[code]', params: { code: barcode } })}
            />
          ) : null}
          {search.isLoading ? (
            <ActivityIndicator color={p.primary} style={{ marginTop: space.xl }} />
          ) : search.isError ? (
            <View style={{ marginTop: space.md }}>
              <Notice tone="error" text={errorMessage(search.error, t)} />
            </View>
          ) : (search.data?.hits.length ?? 0) === 0 ? (
            <FriendlyEmptyState expression="curious" title={f(t.search.noResults, { query })} body={t.search.noResultsHint} size={72} />
          ) : (
            <Card style={{ marginTop: space.md, paddingVertical: 0 }}>
              {search.data!.hits.map((hit) => (
                <ListRow
                  key={`${hit.kind}:${hit.id}`}
                  title={hit.title}
                  subtitle={[t.search.kinds[hit.kind], hit.subtitle].filter(Boolean).join(' · ')}
                  leading={<HitThumb hit={hit} />}
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
        </>
      ) : (
        <Discover />
      )}
    </Screen>
  );
}

function HitThumb({ hit }: { hit: SearchHit }) {
  const p = usePalette();
  if (hit.kind === 'additive') {
    return (
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="micro" color="primaryText">
          {hit.title.split(' ')[0]}
        </Text>
      </View>
    );
  }
  const uri = hit.kind === 'product' ? hit.imageUrl : foodImageUri(hit.slug);
  return <FoodImage uri={uri} fallback={hit.kind === 'product' ? 'product' : 'other'} width={44} height={44} radius={12} fit={hit.kind === 'product' ? 'contain' : 'cover'} />;
}

/** Discovery when nothing is typed: recipes, foods with real photos, additives, recents. */
function Discover() {
  const { t, locale } = useT();
  const recipes = useRecipes();
  const foods = useFoodsBySlugs(DISCOVER_FOODS);
  const additives = useAdditiveCards(ADDITIVES);
  const recent = useRecentFoods();
  const [filter, setFilter] = useState<RecipeFilter | null>(null);

  const withTags = useMemo(() => (recipes.data ?? []).map((r) => ({ recipe: r, tags: recipeTags(r, recipeNutrition(r)) })), [recipes.data]);
  const collections: { title: string; items: Recipe[] }[] = [
    { title: t.recipes.collections.quickDinners, items: withTags.filter((x) => x.recipe.mealTypes.includes('dinner') && x.recipe.minutes <= QUICK_MINUTES).map((x) => x.recipe) },
    { title: t.recipes.collections.goodBreakfasts, items: withTags.filter((x) => x.recipe.mealTypes.includes('breakfast')).map((x) => x.recipe) },
    { title: t.recipes.collections.moreProtein, items: withTags.filter((x) => x.tags.includes('high_protein')).map((x) => x.recipe) },
  ].filter((c) => c.items.length > 0);
  const filtered = filter ? withTags.filter((x) => recipeMatches(x.recipe, x.tags, filter)).map((x) => x.recipe) : [];

  return (
    <View>
      {withTags.length > 0 ? (
        <>
          <SectionHeader title={t.recipes.discover} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.md }} contentContainerStyle={{ gap: space.xs, paddingHorizontal: space.md }}>
            {[null, ...RECIPE_FILTERS].map((fl) => (
              <Chip key={fl ?? 'all'} label={fl ? t.recipes.filters[fl] : t.recipes.filters.all} selected={filter === fl} onPress={() => setFilter(fl)} />
            ))}
          </ScrollView>
          {filter ? (
            filtered.length ? (
              <View style={{ gap: space.sm, marginTop: space.md }}>
                {filtered.map((r) => (
                  <RecipeCard key={r.id} recipe={r} width="100%" onPress={() => router.push(`/recipe/${r.slug}`)} />
                ))}
              </View>
            ) : (
              <FriendlyEmptyState expression="curious" title={t.recipes.empty} size={64} compact />
            )
          ) : (
            collections.map((c) => (
              <View key={c.title}>
                <Text variant="cardTitle" style={{ marginTop: space.lg, marginBottom: space.sm }}>
                  {c.title}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.md }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.xs }}>
                  {c.items.map((r) => (
                    <RecipeCard key={r.id} recipe={r} onPress={() => router.push(`/recipe/${r.slug}`)} />
                  ))}
                </ScrollView>
              </View>
            ))
          )}
        </>
      ) : null}

      {(foods.data?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title={t.web.discoverTitle} subtitle={t.web.discoverSubtitle} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md }}>
            {foods.data!.map((food) => (
              <View key={food.id} style={{ width: '48%' }}>
                <FoodCard
                  title={locale === 'en' ? food.nameEn : food.nameEs}
                  subtitle={`${formatNumber(food.nutrientsPer100.energy_kcal ?? 0, locale)} kcal · ${formatNumber(food.nutrientsPer100.protein_g ?? 0, locale, 1)} g ${t.nutrients.protein_g.toLowerCase()}`}
                  imageUri={foodImageUri(food.slug)}
                  fallback={categoryArt(food.category)}
                  width={164}
                  onPress={() => router.push(`/food/${food.id}`)}
                />
              </View>
            ))}
          </View>
        </>
      ) : null}

      {(additives.data?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title={t.web.additivesTitle} subtitle={t.web.additivesSubtitle} />
          <Card style={{ paddingVertical: 0 }}>
            {additives.data!.map((a) => (
              <ListRow
                key={a.code}
                title={(locale === 'en' ? (a.nameEn ?? a.nameEs) : (a.nameEs ?? a.nameEn)) ?? a.eNumber}
                subtitle={
                  a.euStatus === 'not_authorised'
                    ? `${a.eNumber} · ${t.additive.statusNotAuthorised}`
                    : [a.eNumber, ...a.classes.slice(0, 2).map((c) => t.additiveClasses[c as keyof typeof t.additiveClasses] ?? c)].join(' · ')
                }
                onPress={() => router.push(`/additive/${a.code}`)}
              />
            ))}
          </Card>
        </>
      ) : null}

      {(recent.data?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title={t.search.recent} />
          <Card style={{ paddingVertical: 0 }}>
            {recent.data!.slice(0, 6).map((r) => (
              <ListRow
                key={`${r.genericFoodId ?? r.productId ?? r.displayName}`}
                title={r.displayName}
                subtitle={r.quantityLabel ?? `${formatNumber(r.amount, locale)} ${r.basis === '100ml' ? 'ml' : 'g'}`}
                onPress={r.genericFoodId ? () => router.push(`/food/${r.genericFoodId}`) : undefined}
              />
            ))}
          </Card>
        </>
      ) : null}
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.lg }}>
        {t.search.photosCredit}
      </Text>
    </View>
  );
}
