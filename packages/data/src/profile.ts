import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CONSENT_VERSION,
  computeDailyTargets,
  type ConsentType,
  type DailyTargets,
  type Goal,
  type OnboardingAnswers,
} from '@repo/core';

export interface Profile {
  id: string;
  displayName: string | null;
  locale: 'es' | 'en';
  country: string;
  region: string | null;
  primaryGoal: Goal;
  goals: Goal[];
  keepMealPhotos: boolean;
  onboardingCompletedAt: string | null;
}

export interface TargetRow {
  effectiveFrom: string;
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  method: 'mifflin_st_jeor_v1' | 'user_defined';
}

type Row = Record<string, unknown>;

export async function getProfile(client: SupabaseClient): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id, display_name, locale, country, region, primary_goal, goals, keep_meal_photos, onboarding_completed_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as Row;
  return {
    id: String(r.id),
    displayName: (r.display_name as string | null) ?? null,
    locale: r.locale === 'en' ? 'en' : 'es',
    country: String(r.country),
    region: (r.region as string | null) ?? null,
    primaryGoal: r.primary_goal as Goal,
    goals: (r.goals as Goal[]) ?? [],
    keepMealPhotos: r.keep_meal_photos === true,
    onboardingCompletedAt: (r.onboarding_completed_at as string | null) ?? null,
  };
}

export async function updateProfile(
  client: SupabaseClient,
  userId: string,
  patch: Partial<Pick<Profile, 'displayName' | 'locale' | 'keepMealPhotos'>>,
): Promise<void> {
  const row: Row = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.locale) row.locale = patch.locale;
  if (patch.keepMealPhotos !== undefined) row.keep_meal_photos = patch.keepMealPhotos;
  const { error } = await client.from('profiles').update(row).eq('id', userId);
  if (error) throw error;
}

export async function recordConsent(client: SupabaseClient, type: ConsentType, granted: boolean): Promise<void> {
  const { error } = await client
    .from('user_consents')
    .insert({ consent_type: type, granted, policy_version: CONSENT_VERSION });
  if (error) throw error;
}

export async function latestConsents(client: SupabaseClient): Promise<Partial<Record<ConsentType, boolean>>> {
  const { data, error } = await client
    .from('user_consents')
    .select('consent_type, granted, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const out: Partial<Record<ConsentType, boolean>> = {};
  for (const r of (data ?? []) as Row[]) {
    const t = r.consent_type as ConsentType;
    if (out[t] === undefined) out[t] = r.granted === true;
  }
  return out;
}

export async function getCurrentTarget(client: SupabaseClient, date: string): Promise<TargetRow | null> {
  const { data, error } = await client.rpc('target_for_date', { p_date: date });
  if (error) throw error;
  const r = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  if (!r) return null;
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    effectiveFrom: String(r.effective_from),
    energyKcal: num(r.energy_kcal),
    proteinG: num(r.protein_g),
    carbsG: num(r.carbs_g),
    fatG: num(r.fat_g),
    fiberG: num(r.fiber_g),
    method: r.method as TargetRow['method'],
  };
}

export async function setTarget(
  client: SupabaseClient,
  target: Omit<TargetRow, 'method'> & { method: TargetRow['method']; inputs?: Record<string, unknown> },
): Promise<void> {
  const { error } = await client.from('daily_targets').upsert(
    {
      effective_from: target.effectiveFrom,
      energy_kcal: target.energyKcal,
      protein_g: target.proteinG,
      carbs_g: target.carbsG,
      fat_g: target.fatG,
      fiber_g: target.fiberG,
      method: target.method,
      inputs: target.inputs ?? {},
    },
    { onConflict: 'user_id,effective_from' },
  );
  if (error) throw error;
}

/**
 * Persists the onboarding answers. Health data is stored only when the user
 * granted explicit consent; otherwise it is discarded and no energy target is
 * computed from it.
 */
export async function saveOnboarding(
  client: SupabaseClient,
  userId: string,
  answers: OnboardingAnswers,
  today: string,
): Promise<DailyTargets | null> {
  const profile = await client
    .from('profiles')
    .update({
      primary_goal: answers.primaryGoal,
      goals: answers.goals,
      country: answers.country.toUpperCase(),
      region: answers.region,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (profile.error) throw profile.error;

  const prefs = await client.from('user_preferences').upsert(
    {
      user_id: userId,
      diet: answers.diet,
      likes: answers.likes,
      dislikes: answers.dislikes,
      meals_per_day: answers.mealsPerDay,
      cooking_time: answers.cookingTime,
      budget: answers.budget,
      stores: answers.stores,
      usage_modes: answers.usage,
      notifications_enabled: answers.notifications,
    },
    { onConflict: 'user_id' },
  );
  if (prefs.error) throw prefs.error;

  await recordConsent(client, 'health_data', answers.healthDataConsent);
  if (!answers.healthDataConsent) return null;

  const birthYear = answers.ageYears != null ? Number(today.slice(0, 4)) - answers.ageYears : null;
  const health = await client.from('health_profiles').upsert(
    {
      user_id: userId,
      birth_year: birthYear,
      sex: answers.sex,
      height_cm: answers.heightCm,
      weight_kg: answers.weightKg,
      target_weight_kg: answers.targetWeightKg,
      activity_level: answers.activity,
      weekly_workouts: answers.weeklyWorkouts,
      allergies: answers.allergies,
    },
    { onConflict: 'user_id' },
  );
  if (health.error) throw health.error;

  const targets = computeDailyTargets(
    {
      sex: answers.sex ?? undefined,
      ageYears: answers.ageYears ?? undefined,
      heightCm: answers.heightCm ?? undefined,
      weightKg: answers.weightKg ?? undefined,
      activity: answers.activity ?? undefined,
    },
    answers.primaryGoal,
  );
  if (targets.status === 'ok') {
    await setTarget(client, {
      effectiveFrom: today,
      energyKcal: targets.energyKcal,
      proteinG: targets.proteinG,
      carbsG: targets.carbsG,
      fatG: targets.fatG,
      fiberG: targets.fiberG,
      method: targets.method,
      inputs: { goal: answers.primaryGoal, notes: targets.notes },
    });
  }
  if (answers.weightKg != null) {
    await client.from('weight_logs').upsert({ logged_on: today, weight_kg: answers.weightKg }, { onConflict: 'user_id,logged_on' });
  }
  return targets;
}

export interface WeightLog {
  date: string;
  weightKg: number;
}

export async function listWeights(client: SupabaseClient, from: string, to: string): Promise<WeightLog[]> {
  const { data, error } = await client
    .from('weight_logs')
    .select('logged_on, weight_kg')
    .gte('logged_on', from)
    .lte('logged_on', to)
    .order('logged_on');
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({ date: String(r.logged_on), weightKg: Number(r.weight_kg) }));
}

export async function logWeight(client: SupabaseClient, date: string, weightKg: number): Promise<void> {
  const { error } = await client.from('weight_logs').upsert({ logged_on: date, weight_kg: weightKg }, { onConflict: 'user_id,logged_on' });
  if (error) throw error;
}
