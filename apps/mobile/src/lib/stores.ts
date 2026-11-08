import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { EMPTY_ONBOARDING, type AchievementId, type LabelDraft, type MealDraft, type OnboardingAnswers } from '@repo/core';

/** Minimal observable store (no extra dependency). */
function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function useStore<T>(store: ReturnType<typeof createStore<T>>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/* Meal draft handed from Scan/Voice to Review. */
export interface PendingDraft {
  draft: MealDraft;
  photoUri: string | null;
}
export const draftStore = createStore<PendingDraft | null>(null);
export const useDraft = () => useStore(draftStore);

/* Label draft handed from Scan to the label review. */
export interface PendingLabel {
  draft: LabelDraft;
  gtin: string | null;
}
export const labelStore = createStore<PendingLabel | null>(null);
export const useLabelDraft = () => useStore(labelStore);

/* Products selected for comparison (catalogue ids). */
export const compareStore = createStore<string[]>([]);
export const useCompareIds = () => useStore(compareStore);
export function toggleCompare(id: string) {
  const ids = compareStore.get();
  compareStore.set(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids.slice(-1), id]);
}

/* Onboarding answers, persisted so progress survives restarts. */
const ONBOARDING_KEY = 'onboarding.answers.v1';
export const onboardingStore = createStore<OnboardingAnswers>(EMPTY_ONBOARDING);
export const useOnboardingAnswers = () => useStore(onboardingStore);

export async function restoreOnboarding(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_KEY);
    if (raw) onboardingStore.set({ ...EMPTY_ONBOARDING, ...(JSON.parse(raw) as Partial<OnboardingAnswers>) });
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
}

export function updateOnboarding(patch: Partial<OnboardingAnswers>) {
  const next = { ...onboardingStore.get(), ...patch };
  onboardingStore.set(next);
  AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(next)).catch(() => undefined);
}

export function clearOnboarding() {
  AsyncStorage.removeItem(ONBOARDING_KEY).catch(() => undefined);
}

/* Celebrations (real achievements only) and gentle, auto-dismissing toasts. */
export const celebrationStore = createStore<AchievementId[]>([]);
export const useCelebration = () => useStore(celebrationStore);

export interface Toast {
  id: number;
  kind: 'streakDay';
}
export const toastStore = createStore<Toast | null>(null);
export const useToast = () => useStore(toastStore);
