import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeInUp, FadeOutDown, FadeOutUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion } from '@repo/design';
import { AchievementBadge } from './achievements';
import { ConfettiHost } from './confetti';
import { FudyuCharacter } from './art';
import { Icon } from './icons';
import { BottomSheet } from './sheet';
import { Button, Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { celebrationStore, toastStore, useCelebration, useToast } from '@/lib/stores';
import { useNavHeight } from '@/lib/nav-metrics';
import { UNDO_WINDOW_MS, usePendingUndo } from '@/lib/undo';
import { radius, shadow, space, usePalette } from '@/lib/theme';

/** Short celebration for achievements that were really earned. */
export function CelebrationHost() {
  const { t } = useT();
  const ids = useCelebration();
  const visible = ids.length > 0;

  return (
    <BottomSheet visible={visible} onClose={() => celebrationStore.set([])} scroll={false} overlay={<ConfettiHost inSheet />}>
      <View style={{ alignItems: 'center', gap: space.sm, paddingBottom: space.sm }}>
        <FudyuCharacter expression="celebrate" size={96} />
        <Text variant="title" align="center" accessibilityRole="header">
          {t.achievements.unlocked}
        </Text>
        {ids.map((id) => (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch', paddingVertical: space.xs }}>
            <AchievementBadge id={id} earned size={56} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t.achievements.items[id].title}</Text>
              <Text variant="secondary" color="textSecondary">
                {t.achievements.items[id].body}
              </Text>
            </View>
          </View>
        ))}
        <Button title={t.achievements.great} onPress={() => celebrationStore.set([])} style={{ alignSelf: 'stretch', marginTop: space.sm }} />
      </View>
    </BottomSheet>
  );
}

/** Gentle confirmation at the top of the screen; disappears on its own. */
export function ToastHost() {
  const p = usePalette();
  const { t, f } = useT();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => toastStore.set(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInUp.duration(motion.base)}
      exiting={FadeOutUp.duration(motion.fast)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', top: insets.top + space.xs, left: space.md, right: space.md, alignItems: 'center' }}
    >
      <View
        style={[
          { flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: p.surface, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: space.md },
          shadow(p, 'floating'),
        ]}
      >
        {toast.kind === 'firstMeal' ? (
          <>
            <Icon name="check" size={18} color={p.secondaryText} />
            <Text variant="secondaryStrong">{t.today.firstMeal}</Text>
          </>
        ) : toast.kind === 'streakDay' || toast.kind === 'streakMilestone' ? (
          <>
            <Icon name="flame" size={18} color={p.streak} fill={p.streak} strokeWidth={1.4} />
            <Text variant="secondaryStrong">
              {toast.kind === 'streakMilestone' ? f(t.streak.threePlus, { count: toast.count }) : t.streak.toastDay}
            </Text>
          </>
        ) : (
          <>
            <Icon
              name={toast.tone === 'error' ? 'alert' : toast.tone === 'success' ? 'check' : 'info'}
              size={18}
              color={toast.tone === 'error' ? p.errorText : toast.tone === 'success' ? p.secondaryText : p.primaryText}
            />
            <Text variant="secondaryStrong" style={{ flexShrink: 1 }}>
              {toast.text}
            </Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * "Deshacer" bar for deletions: floats above the tab bar while the undo
 * window is open; a thin line shows the time left.
 */
export function UndoHost() {
  const p = usePalette();
  const { t } = useT();
  const navHeight = useNavHeight();
  const pending = usePendingUndo();
  if (!pending) return null;
  return (
    <Animated.View
      key={pending.id}
      entering={FadeInDown.duration(motion.base)}
      exiting={FadeOutDown.duration(motion.fast)}
      accessibilityLiveRegion="polite"
      pointerEvents="box-none"
      style={{ position: 'absolute', left: space.md, right: space.md, bottom: navHeight + 8, alignItems: 'center' }}
    >
      <View
        style={[
          { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: p.ink, borderRadius: radius.lg, paddingLeft: space.md, paddingRight: 6, minHeight: 52, maxWidth: 520, alignSelf: 'stretch', overflow: 'hidden' },
          shadow(p, 'floating'),
        ]}
      >
        <Icon name="trash" size={18} color={p.textInverse} />
        <Text variant="secondaryStrong" style={{ flex: 1, color: p.textInverse }} numberOfLines={1}>
          {pending.label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.today.undo}
          hitSlop={8}
          onPress={() => {
            haptic.light();
            pending.undo();
          }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm, minHeight: 40, borderRadius: radius.pill, backgroundColor: pressed ? 'rgba(255,255,255,0.16)' : 'transparent' })}
        >
          <Icon name="undo" size={17} color={p.primaryTint} />
          <Text variant="secondaryStrong" style={{ color: p.primaryTint }}>
            {t.today.undo}
          </Text>
        </Pressable>
        <UndoCountdown id={pending.id} />
      </View>
    </Animated.View>
  );
}

function UndoCountdown({ id }: { id: number }) {
  const p = usePalette();
  const progress = useSharedValue(1);
  useEffect(() => {
    progress.set(1);
    progress.set(withTiming(0, { duration: UNDO_WINDOW_MS, easing: Easing.linear }));
  }, [id, progress]);
  const style = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: p.primaryTint, opacity: 0.8 }, style]} />;
}
