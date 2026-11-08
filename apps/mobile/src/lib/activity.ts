import type { ActivityKind } from '@repo/core';
import { recordActivity } from '@repo/data';
import { backendConfigured } from './env';
import { queryClient, today } from './query-client';
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
      if (result.newAchievements.length > 0) celebrationStore.set(result.newAchievements);
      else if (result.newDay) toastStore.set({ id: Date.now(), kind: 'streakDay' });
    })
    .catch(() => {
      sent.delete(key);
    });
}
