import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { addDays, formatNumber, MEAL_TYPES, parseLocalDate, sumNutrients, weekDays } from '@repo/core';
import { MealCard, VisualMetric } from '@/components/cards';
import { Icon } from '@/components/icons';
import { AnimatedCounter, Appear } from '@/components/motion';
import { NutrientTable } from '@/components/nutrition';
import { MetricRing } from '@/components/rings';
import { BottomSheet } from '@/components/sheet';
import { StreakCalendar, StreakHero, StreakPill } from '@/components/streak';
import { Button, Card, EmptyState, ErrorState, Notice, PressableScale, Screen, Skeleton, Text } from '@/components/ui';
import { WeeklyDayStrip } from '@/components/week-strip';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { today, useDiary, useGamification, useProfile, useTarget, useTotals } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

function greeting(t: ReturnType<typeof useT>['t']): string {
  const h = new Date().getHours();
  return h < 13 ? t.today.greetingMorning : h < 20 ? t.today.greetingAfternoon : t.today.greetingEvening;
}

export default function TodayScreen() {
  const { t, f, locale } = useT();
  const p = usePalette();
  const session = useSession();
  const todayStr = today();
  const [date, setDate] = useState(todayStr);
  const [sheet, setSheet] = useState<'streak' | 'day' | null>(null);
  const profile = useProfile();
  const diary = useDiary(date);
  const target = useTarget(date);
  const week = weekDays(date);
  const weekTotals = useTotals(week[0]!, week[6]!);
  const game = useGamification();

  const entries = useMemo(() => diary.data ?? [], [diary.data]);
  const totals = useMemo(() => sumNutrients(entries.flatMap((e) => e.items.map((i) => i.nutrients))), [entries]);
  const activeDays = useMemo(() => new Set((weekTotals.data ?? []).filter((d) => d.entryCount > 0).map((d) => d.date)), [weekTotals.data]);
  const streakDays = useMemo(() => new Set(game.data?.activeDays ?? []), [game.data]);

  if (session.status === 'unconfigured') return <BackendNotConfigured />;
  if (session.status === 'error') {
    return (
      <Screen>
        <ErrorState message={`${t.errors.serviceUnavailable} (${session.error ?? ''})`} retryLabel={t.common.retry} />
      </Screen>
    );
  }
  if (session.status === 'loading' || profile.isLoading) {
    return (
      <Screen scroll={false} contentStyle={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={p.primary} />
      </Screen>
    );
  }
  if (profile.data && !profile.data.onboardingCompletedAt) return <Redirect href="/onboarding" />;

  const energy = totals.values.energy_kcal ?? 0;
  const targetKcal = target.data?.energyKcal ?? null;
  const isToday = date === todayStr;
  const hasEstimates = entries.some((e) => e.items.some((i) => i.isEstimate));
  const name = profile.data?.displayName?.trim();
  const gamification = game.data?.enabled !== false;
  const dayTitle = isToday
    ? t.today.progressTitle
    : date === addDays(todayStr, -1)
      ? t.common.yesterday
      : parseLocalDate(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={diary.isRefetching}
          onRefresh={() => {
            void diary.refetch();
            void game.refetch();
          }}
          tintColor={p.primary}
        />
      }
    >
      {/* 1 · Greeting, avatar, streak */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t.today.profile}
          onPress={() => router.push('/profile')}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}
        >
          {name ? (
            <Text variant="bodyStrong" color="primaryText">
              {name.charAt(0).toUpperCase()}
            </Text>
          ) : (
            <Icon name="user" size={22} color={p.primaryText} />
          )}
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text variant="secondary" color="textSecondary" numberOfLines={1}>
            {greeting(t)}
            {name ? `, ${name}` : ''}
          </Text>
          <Text variant="title" numberOfLines={1}>
            {t.nav.today}
          </Text>
        </View>
        {gamification && game.data ? <StreakPill count={game.data.streak.current} onPress={() => setSheet('streak')} /> : null}
      </View>

      {/* 2 · Week */}
      <View style={{ marginTop: space.md }}>
        <WeeklyDayStrip selected={date} today={todayStr} activeDays={activeDays} onSelect={setDate} />
      </View>

      {/* 3–4 · Progress (energy + macros) */}
      <Appear index={0}>
        <PressableScale accessibilityRole="button" accessibilityLabel={`${dayTitle}. ${t.today.progressDetail}`} onPress={() => setSheet('day')} style={{ marginTop: space.md }}>
          <Card style={{ gap: space.md, paddingVertical: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="secondaryStrong" color="textSecondary" style={{ textTransform: isToday ? 'none' : 'capitalize' }}>
                  {dayTitle}
                </Text>
                {diary.isLoading ? (
                  <Skeleton height={40} width={130} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <AnimatedCounter value={energy} format={(n) => formatNumber(Math.round(n), locale)} variant="display" />
                    <Text variant="bodyStrong" color="textSecondary">
                      kcal
                    </Text>
                  </View>
                )}
                {targetKcal ? (
                  <Text variant="secondary" color="textSecondary">
                    {f(t.today.progressOf, { target: formatNumber(targetKcal, locale) })}
                  </Text>
                ) : (
                  <Pressable onPress={() => router.push('/profile')} accessibilityRole="link" hitSlop={8}>
                    <Text variant="secondaryStrong" color="primaryText">
                      {t.today.progressNoTarget} · {t.today.setTarget}
                    </Text>
                  </Pressable>
                )}
              </View>
              <MetricRing size={88} stroke={10} progress={targetKcal ? energy / targetKcal : null} color={p.energy} label={dayTitle}>
                {targetKcal ? (
                  <Text variant="secondaryStrong" style={{ fontVariant: ['tabular-nums'] }}>
                    {Math.round((energy / targetKcal) * 100)}%
                  </Text>
                ) : (
                  <Icon name="bolt" size={26} color={p.primaryText} />
                )}
              </MetricRing>
            </View>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <VisualMetric label={t.nutrients.protein_g} value={macro(entries, totals.values.protein_g)} target={target.data?.proteinG ?? null} unit="g" color={p.protein} />
              <VisualMetric label={t.nutrients.carbs_g} value={macro(entries, totals.values.carbs_g)} target={target.data?.carbsG ?? null} unit="g" color={p.carbs} />
              <VisualMetric label={t.nutrients.fat_g} value={macro(entries, totals.values.fat_g)} target={target.data?.fatG ?? null} unit="g" color={p.fat} />
            </View>
          </Card>
        </PressableScale>
      </Appear>

      {/* 5 · Meals */}
      {diary.isError ? (
        <ErrorState message={errorMessage(diary.error, t)} onRetry={() => diary.refetch()} retryLabel={t.common.retry} />
      ) : (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          {MEAL_TYPES.map((meal, i) => (
            <Appear key={meal} index={i + 1}>
              <MealCard
                meal={meal}
                entries={entries.filter((e) => e.mealType === meal)}
                onAdd={() => router.push({ pathname: '/scan', params: { meal } })}
                onOpenEntry={(id) => router.push(`/entry/${id}`)}
              />
            </Appear>
          ))}
        </View>
      )}

      {/* 6 · Progress access */}
      <PressableScale
        accessibilityRole="button"
        onPress={() => router.push('/progress')}
        style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: p.primarySoft }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chart" size={20} color={p.primaryText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{t.today.weekLink}</Text>
          <Text variant="secondary" color="textSecondary">
            {t.today.weekLinkBody}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={p.primaryText} />
      </PressableScale>

      <BottomSheet visible={sheet === 'streak'} onClose={() => setSheet(null)} title={t.streak.title}>
        {game.data ? (
          <View style={{ gap: space.lg }}>
            <StreakHero summary={game.data.streak} />
            <StreakCalendar activeDays={streakDays} today={todayStr} />
            <Notice tone="info" icon="info" text={t.streak.howBody} />
            <Button
              title={t.streak.seeAchievements}
              variant="soft"
              onPress={() => {
                setSheet(null);
                router.push('/progress');
              }}
            />
            <Text variant="caption" color="textTertiary" align="center">
              {t.streak.optOut}
            </Text>
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'day'} onClose={() => setSheet(null)} title={t.today.dayDetailTitle}>
        <View style={{ gap: space.md }}>
          {entries.length === 0 ? (
            <EmptyState icon="leaf" title={t.today.emptyDayTitle} body={t.today.emptyDayBody} />
          ) : (
            <NutrientTable columns={[{ title: t.common.total, values: totals.values }]} />
          )}
          {hasEstimates ? <Notice tone="info" text={t.today.estimatesNote} /> : null}
          {totals.incomplete.length > 0 ? <Notice tone="info" text={t.today.incompleteNote} /> : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}

function round(v: number | null): number | null {
  return v == null ? null : Math.round(v);
}

/** Nothing logged means zero, not "unknown". */
function macro(entries: unknown[], v: number | null): number | null {
  return entries.length === 0 ? 0 : round(v);
}

function BackendNotConfigured() {
  const { t } = useT();
  return (
    <Screen>
      <EmptyState
        icon="info"
        title={t.errors.notConfigured}
        body="Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY and EXPO_PUBLIC_API_URL (see .env.example)."
      />
    </Screen>
  );
}
