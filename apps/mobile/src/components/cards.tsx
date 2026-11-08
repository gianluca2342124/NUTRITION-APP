import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { formatNumber, recipeNutrition, recipeTags, type MealType, type Recipe } from '@repo/core';
import type { DiaryEntry } from '@repo/data';
import type { IllustrationKey } from '@repo/design';
import { motion } from '@repo/design';
import { FoodImage } from './food-image';
import { Icon } from './icons';
import { ProgressBar } from './rings';
import { IconButton, PressableScale, Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { entryImage, foodImageUri, useMealPhotoUrl } from '@/lib/media';
import { radius, shadow, space, usePalette } from '@/lib/theme';

const MEAL_ART: Record<MealType, IllustrationKey> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack' };

function timeOf(entry: DiaryEntry, locale: string): string {
  const iso = entry.consumedAt ?? entry.createdAt;
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** Thumbnail for a meal: the user's own photo first, then real food photos, then art. */
function MealThumb({ entries, meal, size }: { entries: DiaryEntry[]; meal: MealType; size: number }) {
  const withPhoto = entries.find((e) => e.photoPath);
  const photo = useMealPhotoUrl(withPhoto?.photoPath ?? null);
  const images = entries.map(entryImage);
  const uri = photo.data ?? images.find((i) => i.uri)?.uri ?? null;
  const art = images[0]?.art;
  const fallback = art && art !== 'other' ? art : MEAL_ART[meal];
  return <FoodImage uri={uri} fallback={fallback} width={size} height={size} radius={18} />;
}

/**
 * One card per meal. Collapsed: image, name, time, energy and an add action.
 * Expanded: the logged entries (tap to edit). No per-row macro letters.
 */
export function MealCard({
  meal,
  entries,
  onAdd,
  onOpenEntry,
}: {
  meal: MealType;
  entries: DiaryEntry[];
  onAdd: () => void;
  onOpenEntry: (id: string) => void;
}) {
  const { t, f, locale } = useT();
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const kcal = entries.reduce((s, e) => s + (e.totals.values.energy_kcal ?? 0), 0);
  const names = entries.flatMap((e) => (e.title ? [e.title] : e.items.map((i) => i.displayName)));
  const empty = entries.length === 0;
  const subtitle = empty ? t.today.mealEmptyHint[meal] : names.join(', ');
  const last = entries[entries.length - 1];

  return (
    <View style={[{ backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border }, shadow(p, 'card')]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={empty ? undefined : { expanded: open }}
        accessibilityLabel={`${t.meals[meal]}. ${empty ? subtitle : f(t.today.mealSummary, { count: entries.length, kcal: formatNumber(kcal, locale) })}`}
        onPress={() => {
          if (empty) {
            onAdd();
            return;
          }
          haptic.selection();
          setOpen(!open);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, paddingRight: space.sm, opacity: pressed ? 0.85 : 1 })}
      >
        <MealThumb entries={entries} meal={meal} size={60} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
            <Text variant="cardTitle">{t.meals[meal]}</Text>
            {last ? (
              <Text variant="caption" color="textTertiary">
                {timeOf(last, locale)}
              </Text>
            ) : null}
          </View>
          <Text variant="secondary" color={empty ? 'textTertiary' : 'textSecondary'} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {!empty ? (
          <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
            {formatNumber(kcal, locale)}
            <Text variant="caption" color="textSecondary">
              {' '}
              kcal
            </Text>
          </Text>
        ) : null}
        <IconButton icon="plus" tone="soft" size={36} label={f(t.today.addTo, { meal: t.meals[meal] })} onPress={onAdd} />
      </Pressable>
      {open && !empty ? (
        <Animated.View entering={FadeIn.duration(motion.base)} style={{ paddingHorizontal: space.sm, paddingBottom: space.xs }}>
          {entries.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              onPress={() => onOpenEntry(entry.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                paddingVertical: space.sm,
                paddingHorizontal: space.xs,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: p.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {entry.title || entry.items.map((i) => i.displayName).join(', ')}
                </Text>
                {entry.items.some((i) => i.isEstimate) ? (
                  <Text variant="caption" color="textTertiary">
                    {t.common.estimate}
                  </Text>
                ) : null}
              </View>
              <Text variant="secondaryStrong" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
                {formatNumber(entry.totals.values.energy_kcal ?? 0, locale)} kcal
              </Text>
              <Icon name="chevronRight" size={16} color={p.textTertiary} />
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Compact food tile for grids and carousels (image, name, one fact). */
export function FoodCard({
  title,
  subtitle,
  imageUri,
  fallback = 'other',
  onPress,
  width = 156,
  fit = 'cover',
  badge,
}: {
  title: string;
  subtitle?: string | null;
  imageUri: string | null;
  fallback?: IllustrationKey;
  onPress: () => void;
  width?: number;
  fit?: 'cover' | 'contain';
  badge?: ReactNode;
}) {
  const p = usePalette();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ width }}>
      <View>
        <FoodImage uri={imageUri} fallback={fallback} width={width} height={width} radius={radius.lg} fit={fit} />
        {badge ? <View style={{ position: 'absolute', top: 8, left: 8 }}>{badge}</View> : null}
      </View>
      <Text variant="secondaryStrong" numberOfLines={2} style={{ marginTop: space.xs }}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ color: p.textSecondary }}>
          {subtitle}
        </Text>
      ) : null}
    </PressableScale>
  );
}

/** Large discovery card (collections, shortcuts). */
export function DiscoverCard({
  title,
  subtitle,
  art = 'recipe',
  imageUri,
  onPress,
  height = 168,
}: {
  title: string;
  subtitle?: string;
  art?: IllustrationKey;
  imageUri?: string | null;
  onPress: () => void;
  height?: number;
}) {
  const p = usePalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[{ borderRadius: radius.lg, backgroundColor: p.surface, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: p.border }, shadow(p, 'card')]}
    >
      <FoodImage uri={imageUri} fallback={art} width="100%" height={height} radius={0} />
      <View style={{ padding: space.md, gap: 2 }}>
        <Text variant="cardTitle" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="secondary" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** Small labelled metric with a thin bar (macros, goals). */
export function VisualMetric({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string;
  value: number | null;
  target: number | null;
  unit: string;
  color: string;
}) {
  const { locale } = useT();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {value == null ? '—' : formatNumber(value, locale)}
        <Text variant="caption" color="textTertiary">
          {target ? ` / ${formatNumber(target, locale)} ${unit}` : ` ${unit}`}
        </Text>
      </Text>
      <ProgressBar progress={target && value != null ? value / target : null} color={color} height={6} />
    </View>
  );
}

/** Three macros side by side with a colour key (no targets, no letters). */
export function MacroTrio({ protein, carbs, fat }: { protein: number | null; carbs: number | null; fat: number | null }) {
  const { t, locale } = useT();
  const p = usePalette();
  const items = [
    { label: t.nutrients.protein_g, value: protein, color: p.protein },
    { label: t.nutrients.carbs_g, value: carbs, color: p.carbs },
    { label: t.nutrients.fat_g, value: fat, color: p.fat },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {items.map((m) => (
        <View key={m.label} style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {m.label}
            </Text>
          </View>
          <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
            {m.value == null ? '—' : `${formatNumber(m.value, locale, 0)} g`}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Recipe card: large photo (illustrative) or illustration, title, time, servings, one justified tag. */
export function RecipeCard({ recipe, width = 248, onPress }: { recipe: Recipe; width?: number | `${number}%`; onPress: () => void }) {
  const { t, f, locale } = useT();
  const n = recipeNutrition(recipe);
  const tags = recipeTags(recipe, n);
  const tag = (['high_protein', 'high_fiber', 'protein_source', 'fiber_source'] as const).find((x) => tags.includes(x));
  return (
    <RecipeCardView
      title={locale === 'en' ? recipe.titleEn : recipe.titleEs}
      imageUri={foodImageUri(recipe.imageKey, 'wide')}
      meta={`${f(t.recipes.minutes, { value: recipe.minutes })} · ${formatNumber(n.perServing.energy_kcal ?? 0, locale)} kcal`}
      tag={tag ? t.recipes.tags[tag] : null}
      width={width}
      onPress={onPress}
    />
  );
}

/** Layout shared by editorial and community recipes. */
export function RecipeCardView({
  title,
  imageUri,
  meta,
  tag,
  badge,
  footer,
  width = 248,
  onPress,
}: {
  title: string;
  imageUri: string | null;
  meta: string;
  tag?: string | null;
  badge?: ReactNode;
  footer?: ReactNode;
  width?: number | `${number}%`;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[{ width, borderRadius: radius.lg, backgroundColor: p.surface, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: p.border }, shadow(p, 'card')]}
    >
      <View>
        <FoodImage uri={imageUri} fallback="recipe" width="100%" height={typeof width === 'number' ? Math.round(width * 0.66) : 150} radius={0} />
        {tag ? (
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text variant="micro" style={{ color: '#172033' }}>
              {tag}
            </Text>
          </View>
        ) : null}
        {badge ? <View style={{ position: 'absolute', top: 10, right: 10 }}>{badge}</View> : null}
      </View>
      <View style={{ padding: space.sm, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {meta}
        </Text>
        {footer}
      </View>
    </PressableScale>
  );
}

/** Article card: cover (if any), title and a short excerpt. */
export function ArticleCard({
  title,
  excerpt,
  coverUri,
  badge,
  footer,
  width = '100%',
  onPress,
}: {
  title: string;
  excerpt: string | null;
  coverUri: string | null;
  badge?: ReactNode;
  footer?: ReactNode;
  width?: number | `${number}%`;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={[{ width, borderRadius: radius.lg, backgroundColor: p.surface, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: p.border }, shadow(p, 'card')]}
    >
      <View>
        {coverUri ? (
          <FoodImage uri={coverUri} fallback="recipe" width="100%" height={140} radius={0} />
        ) : (
          <View style={{ height: 76, backgroundColor: p.primarySoft, alignItems: 'flex-start', justifyContent: 'flex-end', padding: space.sm }}>
            <Icon name="article" size={26} color={p.primaryText} />
          </View>
        )}
        {badge ? <View style={{ position: 'absolute', top: 10, right: 10 }}>{badge}</View> : null}
      </View>
      <View style={{ padding: space.sm, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {excerpt ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2}>
            {excerpt}
          </Text>
        ) : null}
        {footer}
      </View>
    </PressableScale>
  );
}

/** Moderation state of a publication: never confuse "in review" with "published". */
export function PublicationStatusPill({ status }: { status: 'draft' | 'pending_review' | 'published' | 'rejected' }) {
  const p = usePalette();
  const { t } = useT();
  const tone = {
    draft: { bg: p.surfaceMuted, fg: p.textSecondary, icon: 'pencil' as const },
    pending_review: { bg: p.primarySoft, fg: p.primaryText, icon: 'clock' as const },
    published: { bg: p.secondarySoft, fg: p.secondaryText, icon: 'check' as const },
    rejected: { bg: p.errorSoft, fg: p.errorText, icon: 'alert' as const },
  }[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tone.bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
      <Icon name={tone.icon} size={12} color={tone.fg} strokeWidth={2.4} />
      <Text variant="micro" style={{ color: tone.fg }}>
        {t.me.status[status]}
      </Text>
    </View>
  );
}
