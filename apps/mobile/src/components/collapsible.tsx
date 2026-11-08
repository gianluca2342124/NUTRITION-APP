import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion } from '@repo/design';
import { Icon, type IconName } from './icons';
import { Text, haptic } from './ui';
import { radius, space, usePalette } from '@/lib/theme';

/**
 * Level-3 information: closed by default, one tap away. Use for technical
 * detail (nutrients, ingredients, methodology), never for safety warnings.
 */
export function Collapsible({
  title,
  summary,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** One-line preview shown while closed. */
  summary?: string | null;
  icon?: IconName;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const p = usePalette();
  const [open, setOpen] = useState(defaultOpen);
  const rotation = useSharedValue(defaultOpen ? 180 : 0);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  const toggle = () => {
    haptic.selection();
    rotation.set(withTiming(open ? 0 : 180, { duration: motion.base }));
    setOpen(!open);
  };

  return (
    <View style={{ backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={toggle}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, minHeight: 56, opacity: pressed ? 0.7 : 1 })}
      >
        {icon ? (
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={18} color={p.primaryText} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{title}</Text>
          {summary && !open ? (
            <Text variant="secondary" color="textSecondary" numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Animated.View style={chevron}>
          <Icon name="chevronDown" size={20} color={p.textTertiary} />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(motion.base)} style={{ paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm }}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}
