import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { IllustrationKey } from '@repo/design';
import { Illustration } from './art';
import { usePalette } from '@/lib/theme';

/**
 * Food image with progressive loading and an original illustration as the
 * fallback (no image, failed load, offline). Real photos are never replaced by
 * generated ones: user meal photos and product photos are shown as they are.
 */
export function FoodImage({
  uri,
  fallback = 'other',
  width,
  height,
  radius = 18,
  fit = 'cover',
  label,
  style,
}: {
  uri: string | null | undefined;
  fallback?: IllustrationKey;
  width: number | `${number}%`;
  height: number;
  radius?: number;
  /** `contain` for packaged products (keep the whole pack visible). */
  fit?: 'cover' | 'contain';
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!uri || failedUri === uri) {
    return <Illustration name={fallback} width={width} height={height} radius={radius} style={style} />;
  }
  return (
    <View
      style={[
        { width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: fit === 'contain' ? '#FFFFFF' : p.surfaceMuted },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit={fit}
        contentPosition="center"
        transition={180}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        accessibilityLabel={label}
        accessible={!!label}
        onError={() => setFailedUri(uri)}
      />
    </View>
  );
}
