import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { addDays, dateRange, formatNumber, parseLocalDate } from '@repo/core';
import { Button, Card, Field, IconButton, Notice, Row, Screen, SegmentedControl, Skeleton, Text } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { today, useConsents, useLogWeight, useTarget, useTotals, useWeights } from '@/lib/queries';
import { space, usePalette } from '@/lib/theme';

export default function ProgressScreen() {
  const { t, locale } = useT();
  const p = usePalette();
  const [range, setRange] = useState<'week' | 'month'>('week');
  const end = today();
  const start = addDays(end, range === 'week' ? -6 : -29);
  const totals = useTotals(start, end);
  const target = useTarget(end);
  const consents = useConsents();
  const weights = useWeights(90);
  const logWeight = useLogWeight();
  const [weight, setWeight] = useState('');

  const days = dateRange(start, end);
  const byDate = new Map((totals.data ?? []).map((d) => [d.date, d]));
  const logged = (totals.data ?? []).filter((d) => d.itemCount > 0);
  const avg = (key: 'energy_kcal' | 'protein_g') =>
    logged.length ? logged.reduce((s, d) => s + (d.nutrients[key] ?? 0), 0) / logged.length : null;
  const avgEnergy = avg('energy_kcal');
  const avgProtein = avg('protein_g');

  const chartW = 340;
  const chartH = 160;
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
      <View style={{ marginTop: space.md }}>
        <SegmentedControl value={range} onChange={setRange} options={[{ value: 'week', label: t.progress.week }, { value: 'month', label: t.progress.month }]} />
      </View>

      <Card style={{ marginTop: space.md, gap: space.sm }}>
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
        {totals.isLoading ? (
          <Skeleton height={chartH} />
        ) : totals.isError ? (
          <Notice tone="error" text={errorMessage(totals.error, t)} />
        ) : (
          <Svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} accessibilityLabel={t.progress.averageEnergy}>
            {days.map((d, i) => {
              const v = byDate.get(d)?.nutrients.energy_kcal ?? 0;
              const h = (v / max) * (chartH - 8);
              const x = (i + 0.5) * (chartW / days.length) - barW / 2;
              return <Rect key={d} x={x} y={chartH - h} width={barW} height={Math.max(h, v > 0 ? 2 : 0)} rx={Math.min(6, barW / 2)} fill={d === end ? p.primary : p.energy} opacity={d === end ? 1 : 0.55} />;
            })}
            {targetKcal ? (
              <Line x1={0} x2={chartW} y1={chartH - (targetKcal / max) * (chartH - 8)} y2={chartH - (targetKcal / max) * (chartH - 8)} stroke={p.textTertiary} strokeDasharray="4 4" strokeWidth={1} />
            ) : null}
          </Svg>
        )}
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="caption" color="textTertiary">
            {parseLocalDate(start).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
          </Text>
          <Text variant="caption" color="textTertiary">
            {parseLocalDate(end).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
          </Text>
        </Row>
        {avgProtein != null && (
          <Text variant="secondary" color="textSecondary">
            {t.progress.averageEnergy} · {t.nutrients.protein_g.toLowerCase()}: {formatNumber(avgProtein, locale)} g
          </Text>
        )}
        <Text variant="caption" color="textTertiary">
          {logged.length === 0 ? t.progress.noData : t.progress.averagesNote}
        </Text>
      </Card>

      <Card style={{ marginTop: space.md, gap: space.sm }}>
        <Text variant="cardTitle">{t.progress.weight}</Text>
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
                <Field value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix="kg" placeholder="70,0" />
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
              {t.onboarding.healthIntroBody}
            </Text>
            <Button title={t.profile.privacy} variant="secondary" size="md" onPress={() => router.push('/profile')} />
          </>
        )}
      </Card>
    </Screen>
  );
}
