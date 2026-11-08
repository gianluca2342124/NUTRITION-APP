import { View } from 'react-native';
import { calendarWeeks, parseLocalDate, type StreakSummary } from '@repo/core';
import { Icon } from './icons';
import { PressableScale, Text } from './ui';
import { useT } from '@/lib/i18n';
import { radius, space, usePalette } from '@/lib/theme';

/** 🔥 N — compact, tappable. Neutral (never alarming) when the streak is 0. */
export function StreakPill({ count, onPress }: { count: number; onPress: () => void }) {
  const p = usePalette();
  const { t, f } = useT();
  const active = count > 0;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={f(t.streak.pillLabel, { count })}
      onPress={onPress}
      hitSlop={6}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 38,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: active ? p.streakSoft : p.surface,
        borderWidth: active ? 0 : 1,
        borderColor: p.border,
      }}
    >
      <Icon name="flame" size={18} color={active ? p.streak : p.textTertiary} fill={active ? p.streak : 'none'} strokeWidth={active ? 1.4 : 2} />
      <Text variant="bodyStrong" style={{ color: active ? p.streakText : p.textSecondary, fontVariant: ['tabular-nums'] }}>
        {count}
      </Text>
    </PressableScale>
  );
}

/** Friendly message for the current state — never guilt, never pressure. */
export function streakMessage(s: StreakSummary, t: ReturnType<typeof useT>['t'], f: ReturnType<typeof useT>['f']): string {
  if (s.current === 0) return t.streak.start;
  if (s.current >= 7 && s.activeToday) return t.streak.weekPlus;
  if (s.current >= 3 && s.activeToday) return f(t.streak.threePlus, { count: s.current });
  if (s.activeToday) return t.streak.todayCounted;
  return t.streak.keepGoing;
}

/** Last five weeks of activity (Monday first). */
export function StreakCalendar({ activeDays, today, weeks = 5 }: { activeDays: ReadonlySet<string>; today: string; weeks?: number }) {
  const p = usePalette();
  const { t, locale } = useT();
  const grid = calendarWeeks(today, weeks);
  return (
    <View style={{ gap: 6 }} accessibilityRole="summary">
      <View style={{ flexDirection: 'row' }}>
        {t.week.letters.map((l, i) => (
          <Text key={i} variant="micro" color="textTertiary" align="center" style={{ flex: 1 }}>
            {l}
          </Text>
        ))}
      </View>
      {grid.map((week) => (
        <View key={week[0]} style={{ flexDirection: 'row' }}>
          {week.map((day) => {
            const active = activeDays.has(day);
            const isToday = day === today;
            const future = day > today;
            return (
              <View key={day} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  accessible
                  accessibilityLabel={`${parseLocalDate(day).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}${active ? `, ${t.week.withActivity}` : ''}`}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? p.streak : 'transparent',
                    borderWidth: isToday && !active ? 1.5 : 0,
                    borderColor: p.primary,
                    opacity: future ? 0.3 : 1,
                  }}
                >
                  <Text variant="caption" style={{ color: active ? '#FFFFFF' : isToday ? p.primaryText : p.textSecondary, fontVariant: ['tabular-nums'] }}>
                    {parseLocalDate(day).getDate()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Big streak number with flame, used in the detail sheet. */
export function StreakHero({ summary }: { summary: StreakSummary }) {
  const p = usePalette();
  const { t, f } = useT();
  const active = summary.current > 0;
  return (
    <View style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.sm }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: active ? p.streakSoft : p.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="flame" size={46} color={active ? p.streak : p.textTertiary} fill={active ? p.streak : 'none'} strokeWidth={1.4} />
      </View>
      <Text variant="display" style={{ fontVariant: ['tabular-nums'] }} accessibilityRole="header">
        {summary.current}
      </Text>
      <Text variant="bodyStrong" color="textSecondary">
        {summary.current === 1 ? t.streak.unitOne : t.streak.unitMany}
      </Text>
      <Text variant="body" align="center" style={{ marginTop: space.xs, maxWidth: 300 }}>
        {streakMessage(summary, t, f)}
      </Text>
      {summary.longest > 0 ? (
        <Text variant="caption" color="textTertiary">
          {f(t.streak.record, { count: summary.longest })}
        </Text>
      ) : null}
    </View>
  );
}
