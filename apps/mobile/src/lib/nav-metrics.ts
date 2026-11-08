import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Geometry of the floating navigation (shared by the bar and the screens). */
export const NAV_ISLAND = 64;
export const NAV_PLUS = 58;
/** How far the raised "+" sticks out above the island. */
export const NAV_PLUS_RISE = 16;

export function navBottomOffset(insetBottom: number): number {
  return Math.max(insetBottom - 6, 12);
}

/** Height the navigation covers at the bottom of the screen (safe area included). */
export function useNavHeight(): number {
  const insets = useSafeAreaInsets();
  return navBottomOffset(insets.bottom) + NAV_ISLAND + NAV_PLUS_RISE;
}

/** Bottom padding a tab screen needs so its last item scrolls clear of the bar. */
export function useNavClearance(extra = 28): number {
  return useNavHeight() + extra;
}
