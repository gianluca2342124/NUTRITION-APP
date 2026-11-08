import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion } from '@repo/design';
import { IconButton, Text } from './ui';
import { useT } from '@/lib/i18n';
import { radius, shadow, space, usePalette } from '@/lib/theme';

/**
 * Bottom sheet for secondary tasks (add to diary, streak detail, filters).
 * Tapping the scrim or the close button dismisses it.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  const p = usePalette();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Animated.View entering={FadeIn.duration(motion.base)} style={{ flex: 1, backgroundColor: p.scrim }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.common.close} onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.springify().damping(motion.gentle.damping + 6).stiffness(motion.gentle.stiffness + 60)}
          accessibilityViewIsModal
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: '88%',
              backgroundColor: p.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: Math.max(insets.bottom, space.md),
            },
            shadow(p, 'floating'),
          ]}
        >
          <View style={{ alignItems: 'center', paddingTop: space.xs }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: p.borderStrong }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm }}>
            <Text variant="section" style={{ flex: 1 }} accessibilityRole="header">
              {title ?? ''}
            </Text>
            <IconButton icon="close" tone="clear" size={36} label={t.common.close} onPress={onClose} />
          </View>
          {scroll ? (
            <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={{ padding: space.lg, paddingTop: space.sm }}>{children}</View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
