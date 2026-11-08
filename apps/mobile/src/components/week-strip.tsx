import { Pressable, View } from 'react-native';
import { addDays, parseLocalDate, weekDays } from '@repo/core';
import { IconButton, Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { radius, space, usePalette } from '@/lib/theme';

/**
 * Seven-day strip (Monday first). The selected day is a blue capsule, days
 * with entries show a small dot, future days are not selectable. Weeks can be
 * browsed backwards and forwards up to the current week.
 */
export function WeeklyDayStrip({
  selected,
  today,
  activeDays,
  onSelect,
}: {
  selected: string;
  today: string;
  activeDays: ReadonlySet<string>;
  onSelect: (date: string) => void;
}) {
  const { t, locale } = useT();
  const p = usePalette();
  const days = weekDays(selected);
  const isCurrentWeek = days.includes(today);
  const monthRaw = parseLocalDate(days[3]!).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);

  const goWeek = (delta: number) => {
    haptic.selection();
    const target = addDays(selected, delta * 7);
    onSelect(target > today ? today : target);
  };

  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="secondaryStrong" color="textSecondary" style={{ flex: 1 }}>
          {month}
        </Text>
        <IconButton icon="chevronLeft" tone="clear" size={34} label={t.week.previous} onPress={() => goWeek(-1)} />
        <View style={{ opacity: isCurrentWeek ? 0.3 : 1 }}>
          <IconButton icon="chevronRight" tone="clear" size={34} label={t.week.next} onPress={() => !isCurrentWeek && goWeek(1)} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }} accessibilityRole="tablist">
        {days.map((day, i) => {
          const isSelected = day === selected;
          const isToday = day === today;
          const future = day > today;
          const active = activeDays.has(day);
          const date = parseLocalDate(day);
          const label = `${date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}${active ? `, ${t.week.withActivity}` : ''}`;
          return (
            <Pressable
              key={day}
              accessibilityRole="tab"
              accessibilityLabel={isToday ? `${t.week.today}, ${label}` : label}
              accessibilityState={{ selected: isSelected, disabled: future }}
              disabled={future}
              onPress={() => {
                haptic.selection();
                onSelect(day);
              }}
              style={({ pressed }) => ({
                flex: 1,
                maxWidth: 52,
                height: 68,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                backgroundColor: isSelected ? p.primary : isToday ? p.primarySoft : 'transparent',
                opacity: future ? 0.35 : pressed ? 0.7 : 1,
              })}
            >
              <Text variant="micro" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : p.textTertiary }}>
                {t.week.letters[i]}
              </Text>
              <Text variant="bodyStrong" style={{ color: isSelected ? p.onPrimary : isToday ? p.primaryText : p.ink, fontVariant: ['tabular-nums'] }}>
                {date.getDate()}
              </Text>
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: active ? (isSelected ? p.onPrimary : p.secondary) : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
