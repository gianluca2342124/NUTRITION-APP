import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion } from '@repo/design';
import { AchievementBadge } from './achievements';
import { FudyuCharacter } from './art';
import { Icon } from './icons';
import { BottomSheet } from './sheet';
import { Button, Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { celebrationStore, toastStore, useCelebration, useToast } from '@/lib/stores';
import { radius, shadow, space, usePalette } from '@/lib/theme';

/** Short celebration for achievements that were really earned. */
export function CelebrationHost() {
  const { t } = useT();
  const ids = useCelebration();
  const visible = ids.length > 0;

  useEffect(() => {
    if (visible) haptic.success();
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={() => celebrationStore.set([])} scroll={false}>
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
  const { t } = useT();
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
        <Icon name="flame" size={18} color={p.streak} fill={p.streak} strokeWidth={1.4} />
        <Text variant="secondaryStrong">{t.streak.toastDay}</Text>
      </View>
    </Animated.View>
  );
}
