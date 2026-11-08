import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Central haptics. Screens never call expo-haptics directly: they express an
 * intent and this module decides the pattern, throttles it and honours the
 * user's preference.
 *
 *   light       primary buttons, opening the + menu
 *   selection   tabs, days, chips, toggles
 *   medium      deleting
 *   success     saving a meal, a completed scan, a saved edit
 *   warning     a material alert shown (e.g. a declared allergen)
 *   error       a failed action
 *   celebration a real achievement or streak milestone
 */
export type HapticIntent = 'light' | 'selection' | 'medium' | 'success' | 'warning' | 'error' | 'celebration';

const STORAGE_KEY = 'settings.haptics.v1';
const MIN_GAP_MS = 45;
const SAME_INTENT_GAP_MS = 120;

let enabled = true;
let reduceMotion = false;
let lastAt = 0;
const lastByIntent = new Map<HapticIntent, number>();
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

export async function initHaptics(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw != null) enabled = raw !== 'off';
  } catch {
    // Storage unavailable: keep the default.
  }
  try {
    reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
    AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotion = v;
    });
  } catch {
    // Not available on this platform.
  }
}

export function hapticsEnabled(): boolean {
  return enabled;
}

export function setHapticsEnabled(next: boolean): void {
  enabled = next;
  AsyncStorage.setItem(STORAGE_KEY, next ? 'on' : 'off').catch(() => undefined);
}

function play(intent: HapticIntent): Promise<void> {
  switch (intent) {
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'selection':
      return Haptics.selectionAsync();
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    case 'celebration':
      // A short, positive pattern; a single success when Reduce Motion is on.
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).then(() =>
        reduceMotion ? undefined : new Promise<void>((resolve) => setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).finally(resolve), 140)),
      );
  }
}

/** Plays a haptic intent, at most once per short window (never a burst while scrolling). */
export function haptic(intent: HapticIntent): void {
  if (!supported || !enabled) return;
  const now = Date.now();
  if (now - lastAt < MIN_GAP_MS) return;
  if (now - (lastByIntent.get(intent) ?? 0) < SAME_INTENT_GAP_MS) return;
  lastAt = now;
  lastByIntent.set(intent, now);
  play(intent).catch(() => undefined);
}
