import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { motion } from '@repo/design';
import { Text } from './ui';
import type { Palette, typography } from '@/lib/theme';

/**
 * Counts up to `target` with an ease-out curve. Returns the target directly
 * when Reduce Motion is on or the value is unknown (null stays null).
 */
export function useCountUp(target: number | null, duration: number = motion.reveal): number | null {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (target == null || reduce) return;
    const from = current.current;
    if (from === target) return;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      current.current = value;
      setDisplay(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduce]);

  if (target == null) return null;
  return reduce ? target : display;
}

/**
 * Animated number. Screen readers get the final value only (never the
 * intermediate frames).
 */
export function AnimatedCounter({
  value,
  format,
  variant = 'display',
  color = 'ink',
  style,
  accessibilityLabel,
}: {
  value: number | null;
  format: (n: number) => string;
  variant?: keyof typeof typography;
  color?: keyof Palette;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  const shown = useCountUp(value);
  return (
    <Text
      variant={variant}
      color={color}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      accessibilityLabel={accessibilityLabel ?? (value == null ? undefined : format(value))}
    >
      {shown == null ? '—' : format(shown)}
    </Text>
  );
}

/** Card entrance in reading order (index × stagger). Honours Reduce Motion. */
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.duration(motion.slow).delay(index * motion.stagger)} style={style}>
      {children}
    </Animated.View>
  );
}
