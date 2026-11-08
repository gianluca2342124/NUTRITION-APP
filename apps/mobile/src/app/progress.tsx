import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { ACHIEVEMENT_IDS, addDays, dateRange, formatNumber, parseLocalDate, weekDays } from '@repo/core';
import { AchievementGrid } from '@/components/achievements';
import { Icon } from '@/components/icons';
import { Appear } from '@/components/motion';
import { FriendlyEmptyState } from '@/components/states';
import { StreakCalendar } from '@/components/streak';
import { Button, Card, Field, IconButton, Notice, Row, Screen, SectionHeader, SegmentedControl, Skeleton, Text } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { today, useConsents, useGamification, useLogWeight, useTarget, useTotals, useWeights } from '@/lib/queries';
import { radius, space, usePalette } from '@/lib/theme';

/** Trends are drawn only with enough data; a one-day "trend" would mislead. */
const MIN_DAYS_FOR_TREND = 3;

export default function ProgressScreen() {
  const { t, f, locale } = useT();
  const p = usePalette();
  const [range, setRange] = useState<'week' | 'month'>('week');
  const end = today();
  const start = addDays(end, range === 'week' ? -6 : -29);
  const week = weekDays(end);
  const totals = useTotals(start, end);
  const weekTotals = useTotals(week[0]!, week[6]!);
  const target = useTarget(end);
  const game = useGamification();
  const consents = useConsents();
  const weights = useWeights(90);
  const logWeight = useLogWeight();
  const [weight, setWeight] = useState('');

  const days = dateRange(start, end);
  const byDate = new Map((totals.data ?? []).map((d) => [d.date, d]));
  const logged = (totals.data ?? []).filter((d) => d.itemCount > 0);
  const avg = (key: 'energy_kcal' | 'protein_g') => (logged.length ? logged.reduce((s, d) => s + (d.nutrients[key] ?? 0), 0) / logged.length : null);
  const avgEnergy = avg('energy_kcal');
  const avgProtein = avg('protein_g');
  const gamification = game.data?.enabled !== false;
  const weekActive = (weekTotals.data ?? []).filter((d) => d.entryCount > 0).length;
  const activity = useMemo(() => {
    const set = new Set(game.data?.activeDays ?? []);
    for (const d of totals.data ?? []) if (d.entryCount > 0) set.add(d.date);
    return set;
  }, [game.data, totals.data]);
  const earned = useMemo(() => new Set((game.data?.achievements ?? []).map((a) => a.id)), [game.data]);

  const chartW = 340;
  const chartH = 150;
  const targetKcal = target.data?.energyKcal ?? null;
  const max = Math.max(targetKcal ?? 0, ...logged.map((d) => d.nutrients.energy_kcal ?? 0), 1) * 1.1;
  const barW = (chartW / days.length) * 0.62;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
        <IconButton icon="chevronLeft" label={t.common.back} onPress={() => router.back()} />
        <Text variant="cardTitle">{t.progress.title}</Text>
        <View style={{ width: 44 }} />
      </Row>

      {/* Summary */}
      <Appear index={0}>
        <Text variant="section" style={{ marginTop: space.lg }}>
          {t.progress.summaryTitle}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          {gamification ? (
            <SummaryTile
              icon={<Icon name="flame" size={18} color={p.streak} fill={p.streak} strokeWidth={1.4} />}
              label={t.progress.streak}
              value={game.data ? String(game.data.streak.current) : '—'}
              tint={p.streakSoft}
            />
          ) : null}
          <SummaryTile
            icon={<Icon name="check" size={18} color={p.secondaryText} />}
            label={t.progress.activeDays}
            value={f(t.progress.activeDaysValue, { value: weekActive })}
            tint={p.secondarySoft}
          />
          <SummaryTile
            icon={<Icon name="bolt" size={18} color={p.primaryText} />}
            label={t.progress.averageEnergy}
            value={avgEnergy != null && range === 'week' ? `${formatNumber(avgEnergy, locale)}` : '—'}
            unit={avgEnergy != null && range === 'week' ? 'kcal' : undefined}
            tint={p.primarySoft}
          />
        </View>
      </Appear>

      {/* Activity calendar */}
      <SectionHeader title={t.progress.activityTitle} />
      <Card>
        <StreakCalendar activeDays={activity} today={end} />
      </Card>

      {/* Trend: only with enough data */}
      <SectionHeader title={t.progress.trendsTitle} />
      <SegmentedControl value={range} onChange={setRange} options={[{ value: 'week', label: t.progress.week }, { value: 'month', label: t.progress.month }]} />
      <Card style={{ marginTop: space.sm, gap: space.sm }}>
        {totals.isLoading ? (
          <Skeleton height={chartH} />
        ) : totals.isError ? (
          <Notice tone="error" text={errorMessage(totals.error, t)} />
        ) : logged.length < MIN_DAYS_FOR_TREND ? (
          <FriendlyEmptyState expression="smile" title={t.progress.emptyTitle} body={t.progress.emptyBody} size={72} compact />
        ) : (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text variant="caption" color="textSecondary">
                  {t.progress.averageEnergy}
                </Text>
                <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                  {avgEnergy != null ? `${formatNumber(avgEnergy, locale)} kcal` : '—'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="caption" color="textSecondary">
                  {t.progress.loggedDays}
                </Text>
                <Text variant="title">
                  {logged.length}/{days.length}
                </Text>
              </View>
            </Row>
            <Svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} accessibilityLabel={t.progress.averageEnergy}>
              {days.map((d, i) => {
                const v = byDate.get(d)?.nutrients.energy_kcal ?? 0;
                const h = (v / max) * (chartH - 8);
                const x = (i + 0.5) * (chartW / days.length) - barW / 2;
                return <Rect key={d} x={x} y={chartH - h} width={barW} height={Math.max(h, v > 0 ? 2 : 0)} rx={Math.min(6, barW / 2)} fill={p.energy} opacity={d === end ? 1 : 0.5} />;
              })}
              {targetKcal ? (
                <Line x1={0} x2={chartW} y1={chartH - (targetKcal / max) * (chartH - 8)} y2={chartH - (targetKcal / max) * (chartH - 8)} stroke={p.textTertiary} strokeDasharray="4 4" strokeWidth={1} />
              ) : null}
            </Svg>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="caption" color="textTertiary">
                {parseLocalDate(start).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
              </Text>
              <Text variant="caption" color="textTertiary">
                {parseLocalDate(end).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
              </Text>
            </Row>
            {avgProtein != null ? (
              <Text variant="secondary" color="textSecondary">
                {f(t.progress.averageProtein, { value: formatNumber(avgProtein, locale) })}
              </Text>
            ) : null}
            <Text variant="caption" color="textTertiary">
              {targetKcal ? `${t.progress.targetLine} · ` : ''}
              {t.progress.averagesNote}
            </Text>
          </>
        )}
      </Card>

      {/* Achievements (real events only) */}
      {gamification && game.data ? (
        <>
          <SectionHeader title={t.achievements.title} />
          <Card style={{ paddingVertical: space.lg }}>
            <AchievementGrid
              ids={ACHIEVEMENT_IDS}
              earned={earned}
              progress={{ ...game.data.counts, longestStreak: game.data.streak.longest }}
            />
          </Card>
        </>
      ) : null}

      {/* Weight: optional, private */}
      <SectionHeader title={t.progress.weight} action={<Text variant="caption" color="textTertiary">{t.progress.weightOptional}</Text>} />
      <Card style={{ gap: space.sm }}>
        {consents.data?.health_data ? (
          <>
            {(weights.data ?? []).slice(-6).map((w) => (
              <Row key={w.date} style={{ justifyContent: 'space-between' }}>
                <Text variant="secondary" color="textSecondary">
                  {parseLocalDate(w.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                </Text>
                <Text variant="bodyStrong">{formatNumber(w.weightKg, locale, 1)} kg</Text>
              </Row>
            ))}
            <Row gap={space.sm}>
              <View style={{ flex: 1 }}>
                <Field value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix="kg" placeholder="70,0" accessibilityLabel={t.progress.logWeight} />
              </View>
              <Button
                title={t.common.save}
                size="md"
                loading={logWeight.isPending}
                onPress={() => {
                  const n = Number(weight.replace(',', '.'));
                  if (Number.isFinite(n) && n >= 30 && n <= 300) {
                    logWeight.mutate({ date: end, weightKg: n });
                    setWeight('');
                  }
                }}
              />
            </Row>
            <Text variant="caption" color="textTertiary">
              {t.progress.weightPrivate}
            </Text>
          </>
        ) : (
          <>
            <Text variant="secondary" color="textSecondary">
              {t.progress.weightNeedsConsent}
            </Text>
            <Button title={t.profile.privacy} variant="soft" size="md" onPress={() => router.push('/profile')} />
          </>
        )}
      </Card>
    </Screen>
  );
}

function SummaryTile({ icon, label, value, unit, tint }: { icon: ReactNode; label: string; value: string; unit?: string; tint: string }) {
  return (
    <View style={{ flex: 1, gap: 6, padding: space.sm, borderRadius: radius.lg, backgroundColor: tint }}>
      {icon}
      <Text variant="title" style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? (
          <Text variant="caption" color="textSecondary">
            {' '}
            {unit}
          </Text>
        ) : null}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
