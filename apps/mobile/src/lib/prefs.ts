import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Celebration preference. Confetti only plays for real events, when the
 * person has not turned it off and the system "Reduce motion" is off.
 */
const KEY = 'settings.celebrations.v1';
let enabled = true;
let reduceMotion = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function initPrefs(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw != null) enabled = raw === '1';
  } catch {
    // Default on.
  }
  try {
    reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
    AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotion = v;
      emit();
    });
  } catch {
    // Not available on this platform.
  }
  emit();
}

export function celebrationsAllowed(): boolean {
  return enabled && !reduceMotion;
}

export function setCelebrationsEnabled(next: boolean): void {
  enabled = next;
  AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => undefined);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useCelebrationsSetting(): boolean {
  return useSyncExternalStore(subscribe, () => enabled, () => enabled);
}

export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduceMotion, () => reduceMotion);
}
