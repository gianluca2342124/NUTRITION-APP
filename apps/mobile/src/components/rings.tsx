import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { usePalette } from '@/lib/theme';

/**
 * Progress ring. Values above the target fill the ring without switching to
 * an alarming colour: going over occasionally is not a failure.
 */
export function MetricRing({
  size,
  stroke,
  progress,
  color,
  children,
  label,
}: {
  size: number;
  stroke: number;
  progress: number | null;
  color: string;
  children?: ReactNode;
  label?: string;
}) {
  const p = usePalette();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={progress == null ? undefined : { min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.surfaceMuted} strokeWidth={stroke} fill="none" />
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - clamped)}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

export function ProgressBar({ progress, color, height = 8 }: { progress: number | null; color: string; height?: number }) {
  const p = usePalette();
  const clamped = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: p.surfaceMuted, overflow: 'hidden' }}>
      <View style={{ width: `${clamped * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}
