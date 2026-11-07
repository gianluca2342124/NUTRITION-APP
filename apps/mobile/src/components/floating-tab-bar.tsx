import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { GlassSurface } from './glass';
import { Icon, type IconName } from './icons';
import { PressableScale, Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { shadow, usePalette } from '@/lib/theme';

const ICONS: Record<string, IconName> = { index: 'home', explore: 'explore', coach: 'coach' };

/**
 * Floating island with the three destinations plus a separate, prominent
 * Scan action. Respects safe areas; labels stay visible for clarity.
 */
export function FloatingTabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const p = usePalette();
  const { t } = useT();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(insets.bottom - 6, 12),
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <GlassSurface radius={32} style={{ height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const title = (descriptors[route.key]?.options.title as string | undefined) ?? route.name;
            const color = focused ? p.primaryText : p.textSecondary;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={title}
                onPress={() => {
                  if (!focused) {
                    haptic.selection();
                    navigateToTab(route.key);
                  }
                }}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 26,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  backgroundColor: focused ? p.primarySoft : 'transparent',
                }}
              >
                <Icon name={ICONS[route.name] ?? 'home'} size={22} color={color} strokeWidth={focused ? 2.3 : 2} />
                <Text variant="caption" style={{ color, fontSize: 11, lineHeight: 13 }} maxFontSizeMultiplier={1.2}>
                  {title}
                </Text>
              </Pressable>
            );
          })}
        </GlassSurface>
      </View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t.nav.scan}
        onPress={() => {
          haptic.light();
          router.push('/scan');
        }}
        style={[
          { width: 64, height: 64, borderRadius: 32, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' },
          shadow(p, 'floating'),
        ]}
      >
        <Icon name="scan" size={28} color={p.onPrimary} strokeWidth={2.3} />
      </PressableScale>
    </View>
  );
}
