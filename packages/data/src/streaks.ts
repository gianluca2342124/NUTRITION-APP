import type { SupabaseClient } from '@supabase/supabase-js';
import { ACHIEVEMENT_IDS, addDays, computeStreak, type AchievementId, type ActivityKind, type StreakSummary } from '@repo/core';

export interface RecordActivityResult {
  counted: boolean;
  reason?: 'duplicate' | 'disabled';
  /** First counted action of this local day. */
  newDay: boolean;
  streak: { current: number; longest: number; lastActiveDate: string | null } | null;
  newAchievements: AchievementId[];
}

/**
 * Records an eligible action (server-validated, idempotent per subject).
 * `localDate` is the device's local calendar date.
 */
export async function recordActivity(client: SupabaseClient, kind: ActivityKind, subject: string, localDate: string): Promise<RecordActivityResult> {
  const { data, error } = await client.rpc('record_activity', { p_kind: kind, p_subject: subject, p_local_date: localDate });
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  const streak = r.streak as RecordActivityResult['streak'] | undefined;
  return {
    counted: r.counted === true,
    reason: r.reason as RecordActivityResult['reason'],
    newDay: r.newDay === true,
    streak: streak ?? null,
    newAchievements: ((r.newAchievements as string[] | undefined) ?? []).filter((a): a is AchievementId => (ACHIEVEMENT_IDS as readonly string[]).includes(a)),
  };
}

export interface GamificationState {
  enabled: boolean;
  activeDays: string[];
  streak: StreakSummary;
  achievements: { id: AchievementId; earnedAt: string }[];
  counts: { products: number; comparisons: number; recipes: number; ingredients: number; activeDays: number };
}

export async function getGamification(client: SupabaseClient, today: string): Promise<GamificationState> {
  const since = addDays(today, -400);
  const [prefs, days, stored, achievements, events] = await Promise.all([
    client.from('user_preferences').select('gamification_enabled').maybeSingle(),
    client.from('streak_daily_activity').select('activity_date').gte('activity_date', since).order('activity_date'),
    client.from('user_streaks').select('longest_streak').maybeSingle(),
    client.from('user_achievements').select('achievement, earned_at').order('earned_at'),
    client.from('activity_events').select('kind').limit(5000),
  ]);
  for (const r of [prefs, days, stored, achievements, events]) if (r.error) throw r.error;

  const activeDays = (days.data ?? []).map((d) => String(d.activity_date));
  const streak = computeStreak(activeDays, today);
  const kinds = (events.data ?? []).map((e) => String(e.kind));
  const count = (k: ActivityKind) => kinds.filter((x) => x === k).length;
  return {
    enabled: (prefs.data?.gamification_enabled as boolean | undefined) ?? true,
    activeDays,
    streak: { ...streak, longest: Math.max(streak.longest, Number(stored.data?.longest_streak ?? 0)) },
    achievements: (achievements.data ?? [])
      .filter((a) => (ACHIEVEMENT_IDS as readonly string[]).includes(String(a.achievement)))
      .map((a) => ({ id: a.achievement as AchievementId, earnedAt: String(a.earned_at) })),
    counts: {
      products: count('product_analyzed'),
      comparisons: count('comparison'),
      recipes: count('recipe_completed'),
      ingredients: count('ingredient_explored'),
      activeDays: activeDays.length,
    },
  };
}

/** Turning gamification off stops tracking; existing history stays private and exportable. */
export async function setGamificationEnabled(client: SupabaseClient, userId: string, enabled: boolean): Promise<void> {
  const { error } = await client.from('user_preferences').upsert({ user_id: userId, gamification_enabled: enabled }, { onConflict: 'user_id' });
  if (error) throw error;
}
