import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityKind } from '@repo/core';
import { recordActivity } from '@repo/data';
import { backendConfigured } from './env';
import { queryClient, today } from './query-client';
import { STREAK_MILESTONES, celebrate } from './celebrate';
import { celebrationStore, toastStore } from './stores';
import { supabase } from './supabase';

const sent = new Set<string>();

/**
 * Records an eligible action for streaks and achievements. Fire-and-forget:
 * it never blocks or fails the user's flow. The server validates the event,
 * ignores repeats and does nothing when gamification is switched off.
 */
export function trackActivity(kind: ActivityKind, subject: string): void {
  if (!backendConfigured || !subject) return;
  const key = `${kind}:${subject}:${today()}`;
  if (sent.has(key)) return;
  sent.add(key);
  recordActivity(supabase(), kind, subject, today())
    .then((result) => {
      if (!result.counted) return;
      void queryClient.invalidateQueries({ queryKey: ['gamification'] });
      const milestone = result.newDay && result.streak != null && (STREAK_MILESTONES as readonly number[]).includes(result.streak.current);
      if (result.newAchievements.length > 0) {
        celebrationStore.set(result.newAchievements);
        celebrate();
      } else if (milestone) {
        toastStore.set({ id: Date.now(), kind: 'streakMilestone', count: result.streak!.current });
        celebrate();
      } else if (result.newDay) toastStore.set({ id: Date.now(), kind: 'streakDay' });
    })
    .catch(() => {
      sent.delete(key);
    });
}

const FIRST_MEAL_KEY = 'celebrated.firstMeal.v1';
let firstMealChecked = false;

/** Celebrates the very first entry in the diary, once (a real milestone). */
export function celebrateFirstMeal(): void {
  if (firstMealChecked || !backendConfigured) return;
  firstMealChecked = true;
  void (async () => {
    try {
      if (await AsyncStorage.getItem(FIRST_MEAL_KEY)) return;
      const { count, error } = await supabase().from('food_entries').select('id', { count: 'exact', head: true });
      if (error) {
        firstMealChecked = false;
        return;
      }
      await AsyncStorage.setItem(FIRST_MEAL_KEY, '1');
      if (count === 1) {
        toastStore.set({ id: Date.now(), kind: 'firstMeal' });
        celebrate();
      }
    } catch {
      firstMealChecked = false;
    }
  })();
}
