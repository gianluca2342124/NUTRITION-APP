import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPTY_ONBOARDING, nutrients } from '@repo/core';
import {
  copyEntry,
  dailyTotals,
  deleteItem,
  getCurrentTarget,
  getGenericFood,
  getProfile,
  latestConsents,
  listEntries,
  recentFoods,
  saveMeal,
  saveOnboarding,
  updateItemAmount,
} from '@repo/data';
import { deleteUser, newAnonymousUser } from './helpers';

let user: { client: SupabaseClient; userId: string };

beforeAll(async () => {
  user = await newAnonymousUser();
});
afterAll(async () => {
  await deleteUser(user.userId);
});

describe('@repo/data against local Supabase', () => {
  it('saves onboarding, consent and computed targets', async () => {
    const targets = await saveOnboarding(
      user.client,
      user.userId,
      {
        ...EMPTY_ONBOARDING,
        goals: ['increase_protein', 'compare_products'],
        primaryGoal: 'increase_protein',
        ageYears: 34,
        sex: 'male',
        heightCm: 180,
        weightKg: 78,
        activity: 'moderate',
        healthDataConsent: true,
        diet: 'omnivore',
      },
      '2026-11-07',
    );
    expect(targets?.status).toBe('ok');
    const profile = await getProfile(user.client);
    expect(profile?.primaryGoal).toBe('increase_protein');
    expect(profile?.onboardingCompletedAt).not.toBeNull();
    expect(await latestConsents(user.client)).toMatchObject({ health_data: true });
    const target = await getCurrentTarget(user.client, '2026-11-08');
    expect(target?.energyKcal).toBe(targets?.energyKcal);
    expect(target?.proteinG).toBe(Math.round(78 * 1.6));
    expect(await getCurrentTarget(user.client, '2026-11-06')).toBeNull();
  });

  it('does not store health data without consent', async () => {
    const other = await newAnonymousUser();
    try {
      const targets = await saveOnboarding(
        other.client,
        other.userId,
        { ...EMPTY_ONBOARDING, goals: ['eat_balanced'], ageYears: 30, weightKg: 70, heightCm: 170, sex: 'female', activity: 'light' },
        '2026-11-07',
      );
      expect(targets).toBeNull();
      const { data } = await other.client.from('health_profiles').select('*');
      expect(data).toEqual([]);
      expect(await getCurrentTarget(other.client, '2026-11-07')).toBeNull();
    } finally {
      await deleteUser(other.userId);
    }
  });

  it('saves a meal atomically and idempotently', async () => {
    const rice = await getGenericFood(user.client, 'arroz-blanco-cocido');
    const egg = await getGenericFood(user.client, 'huevo');
    expect(egg?.portions.find((p) => p.labelEs === '1 huevo grande')?.grams).toBe(50);
    const meal = {
      id: randomUUID(),
      consumedOn: '2026-11-07',
      mealType: 'lunch' as const,
      method: 'photo' as const,
      title: 'Arroz con huevo',
      items: [
        { id: randomUUID(), foodKind: 'generic_food' as const, genericFoodId: rice!.id, displayName: 'Arroz', amount: 180, isEstimate: true },
        { id: randomUUID(), foodKind: 'generic_food' as const, genericFoodId: egg!.id, displayName: 'Huevo', amount: 100, quantityLabel: '2 huevos grandes' },
        {
          id: randomUUID(),
          foodKind: 'custom' as const,
          displayName: 'Salsa casera',
          amount: 20,
          per100: nutrients({ energy_kcal: 120, protein_g: 1, carbs_g: 8, fat_g: 9 }),
        },
      ],
    };
    await saveMeal(user.client, meal);
    await saveMeal(user.client, meal); // retry after a network error must not duplicate
    const entries = await listEntries(user.client, '2026-11-07');
    const saved = entries.filter((e) => e.id === meal.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.items).toHaveLength(3);
    expect(saved[0]!.items.map((i) => i.displayName)).toEqual(['Arroz', 'Huevo', 'Salsa casera']);
    expect(saved[0]!.totals.values.energy_kcal).toBeCloseTo(130 * 1.8 + 143 + 24, 1);
    expect(saved[0]!.totals.incomplete).toContain('fiber_g');
    expect(saved[0]!.items[0]!.isEstimate).toBe(true);
  });

  it('rejects empty meals', async () => {
    await expect(
      saveMeal(user.client, { id: randomUUID(), consumedOn: '2026-11-07', mealType: 'snack', method: 'search', items: [] }),
    ).rejects.toThrow();
  });

  it('edits and deletes items, copies meals and lists recent foods', async () => {
    const [entry] = (await listEntries(user.client, '2026-11-07')).filter((e) => e.title === 'Arroz con huevo');
    const rice = entry!.items[0]!;
    await updateItemAmount(user.client, rice.id, 100, null);
    await deleteItem(user.client, entry!.items[2]!.id);
    const updated = (await listEntries(user.client, '2026-11-07')).find((e) => e.id === entry!.id)!;
    expect(updated.items).toHaveLength(2);
    expect(updated.items[0]!.nutrients.energy_kcal).toBe(130);
    expect(updated.items[0]!.isEstimate).toBe(false);

    const copyId = randomUUID();
    await copyEntry(user.client, updated, { id: copyId, consumedOn: '2026-11-08', mealType: 'dinner', itemIds: [randomUUID(), randomUUID()] });
    const nextDay = await listEntries(user.client, '2026-11-08');
    expect(nextDay.find((e) => e.id === copyId)?.method).toBe('copy');

    const recents = await recentFoods(user.client, 5);
    expect(recents.map((r) => r.displayName)).toEqual(expect.arrayContaining(['Arroz', 'Huevo']));

    const totals = await dailyTotals(user.client, '2026-11-07', '2026-11-08');
    expect(totals.map((t) => t.date)).toEqual(['2026-11-07', '2026-11-08']);
  });
});
