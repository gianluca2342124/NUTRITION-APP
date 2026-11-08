import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { addDays, parseLocalDate, weekDays } from '@repo/core';
import { motion } from '@repo/design';
import { IconButton, Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { radius, space, usePalette } from '@/lib/theme';

/**
 * Seven-day strip (Monday first, device-local dates). Tap a day, swipe or use
 * the arrows to change week; "Hoy" jumps back. Days with entries show a dot.
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
  const [direction, setDirection] = useState(0);
  const days = weekDays(selected);
  const monthRaw = parseLocalDate(days[3]!).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
  const showToday = selected !== today;

  const goWeek = (delta: number) => {
    haptic.selection();
    setDirection(delta);
    onSelect(addDays(selected, delta * 7));
  };

  // Horizontal swipe changes week; vertical movement keeps scrolling the screen.
  const swipe = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-14, 14],
    runOnJS: true,
    onDeactivate: (e) => {
      if (e.canceled) return;
      if (e.translationX <= -48) goWeek(1);
      else if (e.translationX >= 48) goWeek(-1);
    },
  });

  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text variant="secondaryStrong" color="textSecondary" style={{ flex: 1 }}>
          {month}
        </Text>
        {showToday ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.week.today}
            hitSlop={6}
            onPress={() => {
              haptic.selection();
              setDirection(today > selected ? 1 : -1);
              onSelect(today);
            }}
            style={({ pressed }) => ({ paddingHorizontal: 12, height: 30, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: p.primarySoft, opacity: pressed ? 0.7 : 1, marginRight: 4 })}
          >
            <Text variant="caption" style={{ color: p.primaryText, fontWeight: '700' }}>
              {t.today.goToday}
            </Text>
          </Pressable>
        ) : null}
        <IconButton icon="chevronLeft" tone="clear" size={34} label={t.week.previous} onPress={() => goWeek(-1)} />
        <IconButton icon="chevronRight" tone="clear" size={34} label={t.week.next} onPress={() => goWeek(1)} />
      </View>
      <GestureDetector gesture={swipe}>
        <Animated.View
          key={days[0]}
          entering={direction === 0 ? undefined : (direction > 0 ? FadeInRight : FadeInLeft).duration(motion.micro)}
          style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}
          accessibilityRole="tablist"
          accessibilityHint={t.week.swipeHint}
        >
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
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  if (isSelected) return;
                  haptic.selection();
                  setDirection(0);
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
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text variant="micro" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : p.textTertiary }}>
                  {t.week.letters[i]}
                </Text>
                <Text
                  variant="bodyStrong"
                  style={{ color: isSelected ? p.onPrimary : isToday ? p.primaryText : future ? p.textTertiary : p.ink, fontVariant: ['tabular-nums'] }}
                >
                  {date.getDate()}
                </Text>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: active ? (isSelected ? p.onPrimary : p.secondary) : 'transparent' }} />
              </Pressable>
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
