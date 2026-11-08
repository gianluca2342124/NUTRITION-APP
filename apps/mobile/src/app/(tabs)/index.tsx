import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { addDays, formatNumber, parseLocalDate, sumNutrients, weekDays } from '@repo/core';
import type { ProductScan } from '@repo/data';
import { motion } from '@repo/design';
import { VisualMetric } from '@/components/cards';
import { FeedItemCard, ScanAddSheet } from '@/components/feed';
import { Icon } from '@/components/icons';
import { AnimatedCounter, Appear } from '@/components/motion';
import { NutrientTable } from '@/components/nutrition';
import { MetricRing } from '@/components/rings';
import { BottomSheet } from '@/components/sheet';
import { FriendlyEmptyState } from '@/components/states';
import { StreakCalendar, StreakHero, StreakPill } from '@/components/streak';
import { Button, Card, EmptyState, ErrorState, Notice, PressableScale, Screen, Skeleton, Text } from '@/components/ui';
import { WeeklyDayStrip } from '@/components/week-strip';
import { errorMessage } from '@/lib/errors';
import { buildFeed, useFeedDelete, type FeedItem } from '@/lib/feed';
import { useT } from '@/lib/i18n';
import { today, useDiary, useGamification, useProfile, useScans, useTarget, useTotals } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';
import { openAddSheet } from '@/lib/stores';
import { useHiddenIds } from '@/lib/undo';

function greeting(t: ReturnType<typeof useT>['t']): string {
  const h = new Date().getHours();
  return h < 13 ? t.today.greetingMorning : h < 20 ? t.today.greetingAfternoon : t.today.greetingEvening;
}

/**
 * Today: greeting and streak, week, the day's summary (logged food only),
 * then everything from the day in time order. Scans never add to the totals.
 */
export default function TodayScreen() {
  const { t, f, locale } = useT();
  const p = usePalette();
  const session = useSession();
  const todayStr = today();
  const [date, setDate] = useState(todayStr);
  const [sheet, setSheet] = useState<'streak' | 'day' | null>(null);
  const [adding, setAdding] = useState<ProductScan | null>(null);
  const profile = useProfile();
  const diary = useDiary(date);
  const scans = useScans(date);
  const target = useTarget(date);
  const week = weekDays(date);
  const weekTotals = useTotals(week[0]!, week[6]!);
  const game = useGamification();
  const hidden = useHiddenIds();
  const remove = useFeedDelete();

  // Totals come only from logged entries (never from scans) and drop deleted items at once.
  const entries = useMemo(() => (diary.data ?? []).filter((e) => !hidden.has(e.id)), [diary.data, hidden]);
  const feed = useMemo(() => buildFeed(entries, scans.data ?? [], hidden), [entries, scans.data, hidden]);
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
  const isFuture = date > todayStr;
  const hasEstimates = entries.some((e) => e.items.some((i) => i.isEstimate));
  const hasScans = feed.some((i) => i.kind === 'scan');
  const name = profile.data?.displayName?.trim();
  const gamification = game.data?.enabled !== false;
  const dayRaw = parseLocalDate(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dayLabel = dayRaw.charAt(0).toUpperCase() + dayRaw.slice(1);
  const dayTitle = isToday ? t.today.progressTitle : date === addDays(todayStr, -1) ? t.common.yesterday : dayLabel;
  const loadingFeed = diary.isLoading || scans.isLoading;

  const open = (item: FeedItem) => {
    if (item.kind === 'entry') router.push(`/entry/${item.entry.id}`);
    else router.push({ pathname: '/product/[code]', params: { code: item.scan.product.gtin } });
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={diary.isRefetching}
          onRefresh={() => {
            void diary.refetch();
            void scans.refetch();
            void game.refetch();
          }}
          tintColor={p.primary}
        />
      }
    >
      {/* 1 · Greeting and streak */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="secondary" color="textSecondary" numberOfLines={1}>
            {greeting(t)}
            {name ? `, ${name}` : ''}
          </Text>
          <Text variant="largeTitle" numberOfLines={1} accessibilityRole="header">
            {t.nav.today}
          </Text>
        </View>
        {gamification && game.data ? <StreakPill count={game.data.streak.current} onPress={() => setSheet('streak')} /> : null}
      </View>

      {/* 2 · Week */}
      <View style={{ marginTop: space.md }}>
        <WeeklyDayStrip selected={date} today={todayStr} activeDays={activeDays} onSelect={setDate} />
      </View>

      {/* 3 · Summary of what was eaten */}
      <Appear index={0}>
        <PressableScale accessibilityRole="button" accessibilityLabel={`${dayTitle}. ${t.today.progressDetail}`} onPress={() => setSheet('day')} style={{ marginTop: space.md }}>
          <Card style={{ gap: space.md, paddingVertical: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="secondaryStrong" color="textSecondary">
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
                  <Pressable onPress={() => router.push('/settings')} accessibilityRole="link" hitSlop={8}>
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

      {/* 4 · Everything from the day, newest first */}
      <View style={{ marginTop: space.lg, gap: 2 }}>
        <Text variant="section" accessibilityRole="header">
          {isToday ? t.today.recentTitle : t.today.dayTitle}
        </Text>
        {hasScans ? (
          <Text variant="caption" color="textTertiary">
            {t.today.scansNote}
          </Text>
        ) : null}
      </View>
      {diary.isError ? (
        <ErrorState message={errorMessage(diary.error, t)} onRetry={() => diary.refetch()} retryLabel={t.common.retry} />
      ) : loadingFeed ? (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Skeleton height={76} style={{ borderRadius: radius.lg }} />
          <Skeleton height={76} style={{ borderRadius: radius.lg }} />
        </View>
      ) : feed.length === 0 ? (
        <FriendlyEmptyState
          compact
          expression={isFuture ? 'curious' : 'smile'}
          size={76}
          title={isFuture ? t.today.futureTitle : isToday ? t.today.feedEmptyTitle : t.today.pastEmptyTitle}
          body={isFuture ? t.today.futureBody : isToday ? t.today.feedEmptyBody : undefined}
          action={isToday ? <Button title={t.today.logAction} icon="plus" size="md" onPress={openAddSheet} /> : undefined}
        />
      ) : (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {feed.map((item, i) => (
            <Animated.View
              key={item.key}
              entering={FadeInDown.duration(motion.base).delay(Math.min(i, 6) * motion.stagger)}
              exiting={FadeOutLeft.duration(motion.micro)}
              layout={LinearTransition.duration(motion.base)}
            >
              <FeedItemCard
                item={item}
                onOpen={() => open(item)}
                onEdit={() => open(item)}
                onAdd={() => item.kind === 'scan' && setAdding(item.scan)}
                onDelete={() => remove(item)}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {/* 5 · Progress access */}
      <PressableScale
        accessibilityRole="button"
        onPress={() => router.push('/progress')}
        style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: p.primarySoft }}
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

      <ScanAddSheet scan={adding} onClose={() => setAdding(null)} />

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
                router.navigate('/profile');
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
