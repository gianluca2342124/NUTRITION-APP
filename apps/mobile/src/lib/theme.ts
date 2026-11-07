import { useColorScheme } from 'react-native';
import { elevation, palettes, radius, space, typography, type Palette } from '@repo/design';

export { radius, space, typography };
export type { Palette };

export function usePalette(): Palette {
  return palettes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

/** Soft, diffuse shadow (iOS) / elevation (Android). */
export function shadow(p: Palette, level: keyof typeof elevation = 'card') {
  const e = elevation[level];
  return {
    shadowColor: p.shadow,
    shadowOpacity: e.opacity,
    shadowRadius: e.radius,
    shadowOffset: { width: 0, height: e.offsetY },
    elevation: level === 'floating' ? 8 : 2,
  } as const;
}
