import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { brand } from '@repo/config/brand';
import {
  CHARACTER_VIEWBOX,
  ILLUSTRATION_VIEWBOX,
  MARK_BOWL,
  MARK_BOWL_WIDTH,
  MARK_RADIUS,
  MARK_SEED,
  MARK_VIEWBOX,
  characterShapes,
  illustrationShapes,
  type ArtShape,
  type ArtTone,
  type CharacterExpression,
  type IllustrationKey,
} from '@repo/design';
import { motion } from '@repo/design';
import { usePalette, type Palette } from '@/lib/theme';

function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

function toneColor(p: Palette, tone: ArtTone, gradientId: string): string {
  switch (tone) {
    case 'body':
      return `url(#${gradientId})`;
    case 'face':
    case 'white':
      return '#FFFFFF';
    case 'seed':
      return p.secondary;
    case 'lime':
      return p.scaleLime;
    case 'amber':
      return p.scaleAmber;
    case 'primary':
      return p.primary;
    case 'primaryDeep':
      return p.primaryPressed;
    case 'tint':
      return p.primarySoft;
    case 'tintStrong':
      return p.primaryTint;
  }
}

function Shapes({ shapes, palette, gradientId }: { shapes: ArtShape[]; palette: Palette; gradientId: string }) {
  return shapes.map((s, i) => {
    const common = {
      fill: s.fill ? toneColor(palette, s.fill, gradientId) : 'none',
      stroke: s.stroke ? toneColor(palette, s.stroke, gradientId) : undefined,
      strokeWidth: s.sw,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      opacity: s.opacity,
    };
    switch (s.t) {
      case 'circle':
        return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
      case 'ellipse':
        return (
          <Ellipse
            key={i}
            cx={s.cx}
            cy={s.cy}
            rx={s.rx}
            ry={s.ry}
            {...common}
            transform={s.rotate ? `rotate(${s.rotate} ${s.cx} ${s.cy})` : undefined}
          />
        );
      case 'rect':
        return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common} />;
      case 'path':
        return <Path key={i} d={s.d} {...common} />;
    }
  });
}

function BodyGradient({ id }: { id: string }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={brand.markGradient[0]} />
        <Stop offset="1" stopColor={brand.markGradient[1]} />
      </LinearGradient>
    </Defs>
  );
}

/** Brand mark: a bowl that is also a smile, and a fresh seed. */
export function BrandMark({ size = 48 }: { size?: number }) {
  const id = useSvgId('mark');
  const p = usePalette();
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`} accessibilityElementsHidden importantForAccessibility="no">
      <BodyGradient id={id} />
      <Rect width={MARK_VIEWBOX} height={MARK_VIEWBOX} rx={MARK_RADIUS} fill={`url(#${id})`} />
      <Path d={MARK_BOWL} fill="none" stroke="#FFFFFF" strokeWidth={MARK_BOWL_WIDTH} strokeLinecap="round" />
      <Circle cx={MARK_SEED.cx} cy={MARK_SEED.cy} r={MARK_SEED.r} fill={p.secondary} />
    </Svg>
  );
}

/**
 * The Fudyu character. Used sparingly: welcome, achievements, empty states,
 * positive results and completion — never as decoration on data screens.
 */
export function FudyuCharacter({
  expression = 'smile',
  size = 96,
  animate = true,
  style,
}: {
  expression?: CharacterExpression;
  size?: number;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useSvgId('char');
  const p = usePalette();
  const art = (
    <Svg width={size} height={size} viewBox={`0 0 ${CHARACTER_VIEWBOX} ${CHARACTER_VIEWBOX}`} accessibilityElementsHidden importantForAccessibility="no">
      <BodyGradient id={id} />
      <Shapes shapes={characterShapes(expression)} palette={p} gradientId={id} />
    </Svg>
  );
  if (!animate) return <View style={style}>{art}</View>;
  // Layout animations honour the system Reduce Motion setting by default.
  return (
    <Animated.View entering={ZoomIn.springify().damping(motion.gentle.damping).stiffness(motion.gentle.stiffness)} style={style}>
      {art}
    </Animated.View>
  );
}

/** Original fallback illustration on a soft tinted tile. */
export function Illustration({
  name,
  size = 64,
  width,
  height,
  radius,
  background = true,
  style,
}: {
  name: IllustrationKey;
  size?: number;
  /** Non-square tiles (the art stays square and centred). */
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  background?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useSvgId('ill');
  const p = usePalette();
  const h = height ?? size;
  const art = Math.round(Math.min(typeof width === 'number' ? width : h, h) * (background ? 0.68 : 1));
  return (
    <View
      style={[
        { width: width ?? size, height: h, alignItems: 'center', justifyContent: 'center' },
        background && { backgroundColor: p.primarySoft, borderRadius: radius ?? Math.min(h, 200) * 0.28 },
        style,
      ]}
    >
      <Svg width={art} height={art} viewBox={`0 0 ${ILLUSTRATION_VIEWBOX} ${ILLUSTRATION_VIEWBOX}`} accessibilityElementsHidden importantForAccessibility="no">
        <BodyGradient id={id} />
        <Shapes shapes={illustrationShapes(name)} palette={p} gradientId={id} />
      </Svg>
    </View>
  );
}
