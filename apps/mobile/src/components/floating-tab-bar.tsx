import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { motion } from '@repo/design';
import { MyAvatar } from './avatar';
import { GlassSurface } from './glass';
import { Icon, type IconName } from './icons';
import { PressableScale, Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { NAV_ISLAND, NAV_PLUS, NAV_PLUS_RISE, navBottomOffset } from '@/lib/nav-metrics';
import { openAddSheet } from '@/lib/stores';
import { shadow, usePalette } from '@/lib/theme';

const ICONS: Record<string, IconName> = { index: 'home', explore: 'explore', coach: 'coach' };
const PLUS = NAV_PLUS;

/**
 * Floating island: Hoy · Explorar · (+) · Coach · Perfil. The selection pill
 * glides between tabs; "+" is raised and opens the action sheet; Perfil shows
 * the person's photo or initials. Safe areas respected; labels stay
 * accessible when there is no room to show them.
 */
export function FloatingTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const p = usePalette();
  const { t } = useT();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 350 || fontScale > 1.35;
  const byName = new Map(state.routes.map((r) => [r.name, r]));
  const slots = [byName.get('index'), byName.get('explore'), null, byName.get('coach'), byName.get('profile')];
  const focusedKey = state.routes[state.index]?.key;
  const focusedSlot = slots.findIndex((r) => r?.key === focusedKey);

  const [slotWidth, setSlotWidth] = useState(0);
  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!slotWidth || focusedSlot < 0) return;
    const target = focusedSlot * slotWidth;
    if (!placed.current) {
      placed.current = true;
      x.set(target);
    } else {
      x.set(withSpring(target, motion.snappy));
    }
  }, [focusedSlot, slotWidth, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  const offset = navBottomOffset(insets.bottom);
  const fade = offset + NAV_ISLAND + NAV_PLUS_RISE + 28;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: offset, paddingHorizontal: 16, alignItems: 'center' }}>
      {/* Content scrolling under the bar fades out instead of colliding with it. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: fade }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="navFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={p.background} stopOpacity={0} />
              <Stop offset="0.55" stopColor={p.background} stopOpacity={0.82} />
              <Stop offset="1" stopColor={p.background} stopOpacity={0.96} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#navFade)" />
        </Svg>
      </View>
      <View style={{ width: '100%', maxWidth: 520 }}>
        <GlassSurface radius={32} style={{ height: NAV_ISLAND, paddingHorizontal: 6, justifyContent: 'center' }}>
          <View accessibilityRole="tablist" onLayout={(e) => setSlotWidth(e.nativeEvent.layout.width / slots.length)} style={{ flexDirection: 'row', height: 52 }}>
            {slotWidth > 0 && focusedSlot >= 0 ? (
              <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, width: slotWidth, height: 52, borderRadius: 26, backgroundColor: p.primaryTint, opacity: 0.85 }, pill]} />
            ) : null}
            {slots.map((route, i) => {
              if (!route) return <View key="plus-slot" style={{ flex: 1 }} />;
              const focused = route.key === focusedKey;
              const title = (descriptors[route.key]?.options.title as string | undefined) ?? route.name;
              const color = focused ? p.primaryText : p.textSecondary;
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={title}
                  onPress={() => {
                    if (focused) return;
                    haptic.selection();
                    navigateToTab(route.key);
                  }}
                  style={{ flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 }}
                >
                  {route.name === 'profile' ? (
                    <MyAvatar size={compact ? 28 : 24} ring={focused ? p.primary : undefined} />
                  ) : (
                    <Icon name={ICONS[route.name] ?? 'home'} size={compact ? 24 : 22} color={color} strokeWidth={focused ? 2.3 : 2} />
                  )}
                  {compact ? null : (
                    <Text variant="caption" numberOfLines={1} style={{ color, fontSize: 11, lineHeight: 13, fontWeight: focused ? '700' : '500' }} maxFontSizeMultiplier={1.2}>
                      {title}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </GlassSurface>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t.nav.add}
          accessibilityHint={t.nav.addHint}
          onPress={() => {
            haptic.medium();
            openAddSheet();
          }}
          style={[
            {
              position: 'absolute',
              top: -NAV_PLUS_RISE,
              left: '50%',
              marginLeft: -PLUS / 2,
              width: PLUS,
              height: PLUS,
              borderRadius: PLUS / 2,
              backgroundColor: p.primary,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 4,
              borderColor: p.background,
            },
            shadow(p, 'floating'),
          ]}
        >
          <Icon name="plus" size={28} color={p.onPrimary} strokeWidth={2.6} />
        </PressableScale>
      </View>
    </View>
  );
}
