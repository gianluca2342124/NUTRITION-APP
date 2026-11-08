import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { brand } from '@repo/config/brand';
import { ACHIEVEMENT_RULES, type AchievementId } from '@repo/core';
import { BADGE_GLYPHS } from '@repo/design';
import { Text } from './ui';
import { useT } from '@/lib/i18n';
import { space, usePalette } from '@/lib/theme';

/** Original medal: brand gradient when earned, quiet outline while locked. */
export function AchievementBadge({ id, earned, size = 64 }: { id: AchievementId; earned: boolean; size?: number }) {
  const p = usePalette();
  const gid = `ach${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={brand.markGradient[0]} />
          <Stop offset="1" stopColor={brand.markGradient[1]} />
        </LinearGradient>
      </Defs>
      <Circle cx={32} cy={32} r={30} fill={earned ? p.primarySoft : p.surfaceMuted} />
      <Circle cx={32} cy={32} r={24} fill={earned ? `url(#${gid})` : p.surface} stroke={earned ? 'none' : p.borderStrong} strokeWidth={1.5} strokeDasharray={earned ? undefined : '3 3'} />
      {BADGE_GLYPHS[id].map((d, i) => (
        <Path
          key={i}
          d={d}
          transform="translate(20 20)"
          stroke={earned ? '#FFFFFF' : p.textTertiary}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
      {earned ? <Circle cx={50} cy={14} r={5} fill={p.secondary} stroke={p.surface} strokeWidth={2} /> : null}
    </Svg>
  );
}

export interface AchievementProgress {
  products: number;
  comparisons: number;
  recipes: number;
  ingredients: number;
  activeDays: number;
  longestStreak: number;
}

function progressValue(id: AchievementId, c: AchievementProgress): number {
  const rule = ACHIEVEMENT_RULES[id];
  switch (rule.metric) {
    case 'products':
      return c.products;
    case 'comparisons':
      return c.comparisons;
    case 'recipes':
      return c.recipes;
    case 'ingredients':
      return c.ingredients;
    case 'streak':
      return c.longestStreak;
    case 'activeDays':
      return c.activeDays;
  }
}

/** Grid of achievements with honest progress (no fake unlocks). */
export function AchievementGrid({
  earned,
  progress,
  ids,
  recipesAvailable = false,
}: {
  earned: ReadonlySet<AchievementId>;
  progress: AchievementProgress;
  ids: readonly AchievementId[];
  recipesAvailable?: boolean;
}) {
  const { t, f } = useT();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md }}>
      {ids.map((id) => {
        const has = earned.has(id);
        const rule = ACHIEVEMENT_RULES[id];
        const value = Math.min(progressValue(id, progress), rule.target);
        const note = has
          ? t.achievements.items[id].body
          : id === 'recipe_discoverer' && !recipesAvailable
            ? t.achievements.soon
            : f(t.achievements.progress, { value, target: rule.target });
        return (
          <View
            key={id}
            accessible
            accessibilityLabel={`${t.achievements.items[id].title}. ${has ? t.achievements.items[id].body : `${t.achievements.locked}. ${note}`}`}
            style={{ width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}
          >
            <AchievementBadge id={id} earned={has} />
            <Text variant="caption" align="center" numberOfLines={2} style={{ fontWeight: '600' }}>
              {t.achievements.items[id].title}
            </Text>
            <Text variant="micro" color="textTertiary" align="center" numberOfLines={2} style={{ fontWeight: '500' }}>
              {note}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
