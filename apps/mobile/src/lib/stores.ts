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
  /** Typed by the person (no photo, no AI). */
  manual?: boolean;
}
export const labelStore = createStore<PendingLabel | null>(null);
export const useLabelDraft = () => useStore(labelStore);

/* Products selected for comparison (catalogue ids), kept across restarts. */
const COMPARE_KEY = 'compare.ids.v1';
export const compareStore = createStore<string[]>([]);
export const useCompareIds = () => useStore(compareStore);
compareStore.subscribe(() => {
  AsyncStorage.setItem(COMPARE_KEY, JSON.stringify(compareStore.get())).catch(() => undefined);
});

export async function restoreCompare(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(COMPARE_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(ids)) compareStore.set(ids.filter((x): x is string => typeof x === 'string').slice(-2));
  } catch {
    // Unavailable storage: start empty.
  }
}
/** Adds a product for comparison (keeps the last two; never removes it). */
export function addToCompare(id: string) {
  const ids = compareStore.get();
  if (!ids.includes(id)) compareStore.set([...ids.slice(-1), id]);
}

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

export type Toast =
  | { id: number; kind: 'streakDay' }
  | { id: number; kind: 'streakMilestone'; count: number }
  | { id: number; kind: 'firstMeal' }
  | { id: number; kind: 'message'; text: string; tone: 'success' | 'error' | 'info' };
export const toastStore = createStore<Toast | null>(null);
export const useToast = () => useStore(toastStore);

let toastSeq = 1000;
export function showToast(text: string, tone: 'success' | 'error' | 'info' = 'info') {
  toastStore.set({ id: ++toastSeq, kind: 'message', text, tone });
}

/* The "+" action sheet (opened from the tab bar or empty states). */
export const addSheetStore = createStore(false);
export const useAddSheetOpen = () => useStore(addSheetStore);
export const openAddSheet = () => addSheetStore.set(true);
export const closeAddSheet = () => addSheetStore.set(false);

/** Empty label to type values by hand (Registrar → Manual). */
export function manualLabelDraft(): LabelDraft {
  return {
    draftId: 'manual',
    legibility: 'good',
    basis: '100g',
    servingSizeG: null,
    productName: null,
    brand: null,
    netQuantityText: null,
    raw: {
      energy_kcal: null,
      energy_kj: null,
      fat_g: null,
      saturated_fat_g: null,
      carbs_g: null,
      sugars_g: null,
      fiber_g: null,
      protein_g: null,
      salt_g: null,
      sodium_g: null,
    },
    nutrientsPer100: null,
    issues: [],
    ingredientsText: null,
    allergens: [],
    lowConfidenceFields: [],
  };
}
