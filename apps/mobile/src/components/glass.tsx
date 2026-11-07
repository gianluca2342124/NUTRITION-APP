import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { shadow, useIsDark, usePalette } from '@/lib/theme';

const liquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * Floating material for navigation and controls. Uses native Liquid Glass on
 * iOS 26+, a blur on older iOS and web, and an opaque elevated surface on
 * Android. Never used behind dense numbers or scientific tables.
 */
export function GlassSurface({
  children,
  radius,
  style,
}: {
  children: ReactNode;
  radius: number;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const dark = useIsDark();
  const shape = { borderRadius: radius, overflow: 'hidden' as const };

  if (liquidGlass) {
    return (
      <View style={[shadow(p, 'floating'), { borderRadius: radius }]}>
        <GlassView glassEffectStyle="regular" isInteractive style={[shape, style]}>
          {children}
        </GlassView>
      </View>
    );
  }
  if (Platform.OS === 'ios' || Platform.OS === 'web') {
    return (
      <View style={[shadow(p, 'floating'), { borderRadius: radius }]}>
        <BlurView
          intensity={70}
          tint={dark ? 'dark' : 'light'}
          style={[shape, { backgroundColor: p.glassFallback, borderWidth: StyleSheet.hairlineWidth, borderColor: p.glassBorder }, style]}
        >
          {children}
        </BlurView>
      </View>
    );
  }
  return (
    <View style={[shape, shadow(p, 'floating'), { backgroundColor: p.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border }, style]}>
      {children}
    </View>
  );
}
