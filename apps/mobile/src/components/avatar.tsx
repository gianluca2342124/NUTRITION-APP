import { Image } from 'expo-image';
import { View } from 'react-native';
import { Icon } from './icons';
import { Text, fontFor } from './ui';
import { useMediaUrl, usePublicProfile } from '@/lib/community';
import { useProfile } from '@/lib/queries';
import { usePalette } from '@/lib/theme';

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** The person's photo, or their initials on the brand tint. */
export function Avatar({ path, name, size, ring }: { path: string | null | undefined; name: string | null | undefined; size: number; ring?: string }) {
  const p = usePalette();
  const uri = useMediaUrl('avatars', path);
  const letters = initials(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: p.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
      ) : letters ? (
        <Text style={{ color: p.primaryText, fontSize: size * 0.38, lineHeight: size * 0.46, fontFamily: fontFor('800') }} maxFontSizeMultiplier={1}>
          {letters}
        </Text>
      ) : (
        <Icon name="user" size={Math.round(size * 0.55)} color={p.primaryText} />
      )}
    </View>
  );
}

/** The signed-in person's avatar (public photo/name first, then private name). */
export function MyAvatar({ size, ring }: { size: number; ring?: string }) {
  const pub = usePublicProfile();
  const profile = useProfile();
  return <Avatar path={pub.data?.avatarPath} name={pub.data?.displayName ?? profile.data?.displayName} size={size} ring={ring} />;
}
