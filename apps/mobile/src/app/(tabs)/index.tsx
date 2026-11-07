import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, View } from 'react-native';
import { addDays, formatNumber, MEAL_TYPES, parseLocalDate, sumNutrients, type MealType } from '@repo/core';
import type { DiaryEntry } from '@repo/data';
import { Icon } from '@/components/icons';
import { MacroLine, MacroTiles } from '@/components/nutrition';
import { MetricRing } from '@/components/rings';
import { Button, Card, Divider, EmptyState, ErrorState, IconButton, Notice, Row, Screen, Skeleton, Text } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { today, useDiary, useProfile, useTarget } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';

function greeting(t: ReturnType<typeof useT>['t']): string {
  const h = new Date().getHours();
  return h < 13 ? t.today.greetingMorning : h < 20 ? t.today.greetingAfternoon : t.today.greetingEvening;
}

export default function TodayScreen() {
  const { t, f, locale } = useT();
  const p = usePalette();
  const session = useSession();
  const [date, setDate] = useState(today());
  const profile = useProfile();
  const diary = useDiary(date);
  const target = useTarget(date);

  const entries = useMemo(() => diary.data ?? [], [diary.data]);
  const totals = useMemo(() => sumNutrients(entries.flatMap((e) => e.items.map((i) => i.nutrients))), [entries]);
  const hasEstimates = entries.some((e) => e.items.some((i) => i.isEstimate));

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
  const isToday = date === today();
  const dateLabel = isToday
    ? t.common.today
    : date === addDays(today(), -1)
      ? t.common.yesterday
      : parseLocalDate(date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={diary.isRefetching} onRefresh={() => {
        void diary.refetch();
      }} tintColor={p.primary} />}
    >
      <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
        <View>
          <Text variant="secondaryStrong" color="textSecondary">
            {greeting(t)}
          </Text>
          <Text variant="largeTitle">{t.nav.today}</Text>
        </View>
        <IconButton icon="user" label={t.profile.title} onPress={() => router.push('/profile')} />
      </Row>

      <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
        <IconButton icon="chevronLeft" tone="clear" label="−1" onPress={() => setDate(addDays(date, -1))} size={36} />
        <Pressable onPress={() => setDate(today())} accessibilityRole="button">
          <Text variant="bodyStrong" style={{ textTransform: 'capitalize' }}>
            {dateLabel}
          </Text>
        </Pressable>
        <IconButton icon="chevronRight" tone="clear" label="+1" onPress={() => !isToday && setDate(addDays(date, 1))} size={36} />
      </Row>

      <Card style={{ marginTop: space.md, paddingVertical: space.lg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            {diary.isLoading ? (
              <Skeleton height={44} width={140} />
            ) : (
              <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
                {formatNumber(energy, locale)}
                {targetKcal ? (
                  <Text variant="cardTitle" color="textSecondary">
                    {' '}
                    / {formatNumber(targetKcal, locale)}
                  </Text>
                ) : null}
              </Text>
            )}
            <Text variant="secondary" color="textSecondary">
              {t.today.caloriesEaten}
            </Text>
            {targetKcal ? (
              <Text variant="secondaryStrong" color="primaryText" style={{ marginTop: space.xs }}>
                {energy <= targetKcal
                  ? f(t.today.remaining, { value: `${formatNumber(targetKcal - energy, locale)} kcal` })
                  : f(t.today.over, { value: `${formatNumber(energy - targetKcal, locale)} kcal` })}
              </Text>
            ) : (
              <Pressable onPress={() => router.push('/profile')} accessibilityRole="link">
                <Text variant="secondaryStrong" color="primaryText" style={{ marginTop: space.xs }}>
                  {t.today.noTarget} · {t.today.setTarget}
                </Text>
              </Pressable>
            )}
          </View>
          <MetricRing size={104} stroke={11} progress={targetKcal ? energy / targetKcal : null} color={p.energy} label={t.today.caloriesEaten}>
            <Icon name="flame" size={30} color={p.ink} />
          </MetricRing>
        </Row>
      </Card>

      <View style={{ marginTop: space.sm }}>
        <MacroTiles
          values={totals.values}
          targets={{ protein_g: target.data?.proteinG ?? null, carbs_g: target.data?.carbsG ?? null, fat_g: target.data?.fatG ?? null }}
        />
      </View>

      {(hasEstimates || totals.incomplete.length > 0) && (
        <View style={{ marginTop: space.sm, gap: space.xs }}>
          {hasEstimates && <Notice tone="info" text={t.today.estimatesNote} />}
          {totals.incomplete.length > 0 && <Notice tone="info" text={t.today.incompleteNote} />}
        </View>
      )}

      <Button title={t.today.scanCta} icon="scan" onPress={() => router.push('/scan')} style={{ marginTop: space.lg }} />
      <Row gap={space.sm} style={{ marginTop: space.sm }}>
        <Button title={t.scan.modeVoice} icon="mic" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push('/voice')} />
        <Button title={t.common.search} icon="search" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push('/explore')} />
      </Row>

      {diary.isError ? (
        <ErrorState message={errorMessage(diary.error, t)} onRetry={() => diary.refetch()} retryLabel={t.common.retry} />
      ) : !diary.isLoading && entries.length === 0 ? (
        <EmptyState icon="leaf" title={t.today.emptyDayTitle} body={t.today.emptyDayBody} />
      ) : (
        MEAL_TYPES.map((meal) => <MealSection key={meal} meal={meal} entries={entries.filter((e) => e.mealType === meal)} />)
      )}

      <Button title={t.today.historyLink} icon="chart" variant="ghost" size="md" style={{ marginTop: space.lg }} onPress={() => router.push('/progress')} />
    </Screen>
  );
}

function MealSection({ meal, entries }: { meal: MealType; entries: DiaryEntry[] }) {
  const { t, locale } = useT();
  const p = usePalette();
  const kcal = entries.reduce((s, e) => s + (e.totals.values.energy_kcal ?? 0), 0);
  return (
    <Card style={{ marginTop: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="cardTitle">{t.meals[meal]}</Text>
        <Row gap={space.sm}>
          {entries.length > 0 && (
            <Text variant="secondaryStrong" color="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
              {formatNumber(kcal, locale)} kcal
            </Text>
          )}
          <IconButton icon="plus" size={32} label={`${t.today.addFood} ${t.meals[meal]}`} onPress={() => router.push({ pathname: '/scan', params: { meal } })} />
        </Row>
      </Row>
      {entries.length === 0 ? (
        <Text variant="secondary" color="textTertiary" style={{ marginTop: space.xs }}>
          {t.today.emptyMeal}
        </Text>
      ) : (
        entries.map((entry) => (
          <Pressable key={entry.id} accessibilityRole="button" onPress={() => router.push(`/entry/${entry.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Divider />
            <Row style={{ paddingVertical: space.sm, justifyContent: 'space-between', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {entry.title || entry.items.map((i) => i.displayName).join(', ')}
                </Text>
                <MacroLine values={entry.totals.values} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatNumber(entry.totals.values.energy_kcal ?? 0, locale)} kcal
                </Text>
                {entry.items.some((i) => i.isEstimate) && (
                  <Text variant="caption" style={{ color: p.warningText }}>
                    {t.common.estimate}
                  </Text>
                )}
              </View>
            </Row>
          </Pressable>
        ))
      )}
    </Card>
  );
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
