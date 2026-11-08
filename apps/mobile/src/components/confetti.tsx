import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion } from '@repo/design';
import { clearConfetti, useConfetti, type ConfettiPiece } from '@/lib/celebrate';
import { useCelebration } from '@/lib/stores';
import { usePalette } from '@/lib/theme';

const GRAVITY = 2300;
const DURATION = motion.celebrate; // ≤ 900 ms

/**
 * One short burst over everything; never blocks touches. The root host stays
 * quiet while the achievement sheet is open (that sheet hosts its own, above
 * the modal layer).
 */
export function ConfettiHost({ inSheet = false }: { inSheet?: boolean }) {
  const burst = useConfetti();
  const sheetOpen = useCelebration().length > 0;
  const { width, height } = useWindowDimensions();
  const p = usePalette();
  const colors = [p.primary, p.primaryTint, p.secondary, p.streak, p.scaleAmber];

  useEffect(() => {
    if (!burst) return;
    const id = burst.id;
    const timer = setTimeout(() => clearConfetti(id), DURATION + 60);
    return () => clearTimeout(timer);
  }, [burst]);

  if (!burst || sheetOpen !== inSheet) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      {burst.pieces.map((piece, i) => (
        <Piece key={`${burst.id}-${i}`} piece={piece} originX={width / 2} originY={height * 0.38} color={colors[piece.color] ?? p.primary} />
      ))}
    </View>
  );
}

function Piece({ piece, originX, originY, color }: { piece: ConfettiPiece; originX: number; originY: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: DURATION, easing: Easing.linear }));
  }, [t]);
  const style = useAnimatedStyle(() => {
    const s = (t.get() * DURATION) / 1000;
    return {
      opacity: t.get() < 0.7 ? 1 : 1 - (t.get() - 0.7) / 0.3,
      transform: [
        { translateX: originX + piece.x + piece.vx * s },
        { translateY: originY + piece.vy * s + 0.5 * GRAVITY * s * s },
        { rotate: `${piece.spin * s}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, top: 0, width: piece.size, height: piece.round ? piece.size : piece.size * 0.45, borderRadius: piece.round ? piece.size : 1.5, backgroundColor: color },
        style,
      ]}
    />
  );
}
