import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '@repo/core';
import { recipeNutrition } from '@repo/core';
import { getGamification, getRecipe, listRecipes, recordActivity, setGamificationEnabled } from '@repo/data';
import { deleteUser, newAnonymousUser, serviceClient } from './helpers';

/** Real streaks: validated events, one day per local date, grace day, achievements. */
const GTINS = ['0000000000024', '0000000000031', '0000000000048'];
const todayUtc = () => new Date().toISOString().slice(0, 10);
const users: string[] = [];
let productIds: string[] = [];

beforeAll(async () => {
  const svc = serviceClient();
  const { data, error } = await svc
    .from('products')
    .upsert(
      GTINS.map((gtin) => ({ gtin, slug: `streak-test-${gtin}`, name: `Producto ${gtin}`, source: 'editorial', source_id: `test-${gtin}`, license: 'test' })),
      { onConflict: 'gtin' },
    )
    .select('id, gtin');
  if (error) throw error;
  productIds = GTINS.map((g) => data!.find((r) => r.gtin === g)!.id as string);
});

afterAll(async () => {
  await serviceClient().from('products').delete().in('gtin', GTINS);
  await Promise.all(users.map(deleteUser));
});

async function user() {
  const u = await newAnonymousUser();
  users.push(u.userId);
  return u;
}

describe('record_activity', () => {
  it('counts a new product once and awards FIRST SCAN', async () => {
    const { client } = await user();
    const first = await recordActivity(client, 'product_analyzed', GTINS[0]!, todayUtc());
    expect(first).toMatchObject({ counted: true, newDay: true, streak: { current: 1, longest: 1 } });
    expect(first.newAchievements).toEqual(['first_scan']);

    const again = await recordActivity(client, 'product_analyzed', GTINS[0]!, todayUtc());
    expect(again).toMatchObject({ counted: false, reason: 'duplicate', newAchievements: [] });

    const other = await recordActivity(client, 'product_analyzed', GTINS[1]!, todayUtc());
    expect(other).toMatchObject({ counted: true, newDay: false, streak: { current: 1 } });

    const state = await getGamification(client, todayUtc());
    expect(state.counts.products).toBe(2);
    expect(state.activeDays).toEqual([todayUtc()]);
    expect(state.achievements.map((a) => a.id)).toEqual(['first_scan']);
  });

  it('only accepts real subjects owned by the user', async () => {
    const a = await user();
    const b = await user();
    const { data: rice } = await a.client.from('generic_foods').select('id').eq('slug', 'arroz-blanco-cocido').single();
    const entryId = randomUUID();
    const saved = await a.client.rpc('save_meal', {
      p_entry: { id: entryId, consumed_on: todayUtc(), meal_type: 'lunch', method: 'search' },
      p_items: [{ id: randomUUID(), food_kind: 'generic_food', generic_food_id: rice!.id, display_name: 'Arroz', amount: 150 }],
    });
    expect(saved.error).toBeNull();

    await expect(recordActivity(b.client, 'meal_logged', entryId, todayUtc())).rejects.toMatchObject({ code: '23503' });
    await expect(recordActivity(a.client, 'product_analyzed', '0000000009999', todayUtc())).rejects.toMatchObject({ code: '23503' });
    await expect(recordActivity(a.client, 'ingredient_explored', 'e99999', todayUtc())).rejects.toMatchObject({ code: '23503' });
    expect(await recordActivity(a.client, 'meal_logged', entryId, todayUtc())).toMatchObject({ counted: true });
  });

  it('rejects local dates more than a day away from the server date', async () => {
    const { client } = await user();
    await expect(recordActivity(client, 'product_analyzed', GTINS[0]!, addDays(todayUtc(), -3))).rejects.toMatchObject({ code: '22023' });
    await expect(recordActivity(client, 'product_analyzed', GTINS[0]!, addDays(todayUtc(), 2))).rejects.toMatchObject({ code: '22023' });
    // Every real time zone is within ±1 day of UTC.
    expect(await recordActivity(client, 'product_analyzed', GTINS[0]!, addDays(todayUtc(), 1))).toMatchObject({ counted: true });
  });

  it('normalises comparisons so the same pair counts once', async () => {
    const { client } = await user();
    const ab = await recordActivity(client, 'comparison', `${productIds[0]},${productIds[1]}`, todayUtc());
    expect(ab.counted).toBe(true);
    const ba = await recordActivity(client, 'comparison', `${productIds[1]},${productIds[0]}`, todayUtc());
    expect(ba).toMatchObject({ counted: false, reason: 'duplicate' });
    await expect(recordActivity(client, 'comparison', productIds[0]!, todayUtc())).rejects.toMatchObject({ code: '22023' });
  });

  it('forgives one missed day and awards WEEKLY EXPLORER after seven active days', async () => {
    const { client, userId } = await user();
    const t = todayUtc();
    const seeded = [-8, -7, -5, -4, -3, -2].map((d) => ({ user_id: userId, activity_date: addDays(t, d), first_kind: 'meal_logged' }));
    const { error } = await serviceClient().from('streak_daily_activity').insert(seeded);
    expect(error).toBeNull();

    const r = await recordActivity(client, 'ingredient_explored', 'e330', t);
    // -8,-7 | gap of one missed day (-6) | -5..-2 | gap (-1) | today  → 7 active days in one chain
    expect(r.streak).toMatchObject({ current: 7, longest: 7, lastActiveDate: t });
    expect(r.newAchievements.sort()).toEqual(['food_curious', 'weekly_explorer']);

    const state = await getGamification(client, t);
    expect(state.streak).toMatchObject({ current: 7, activeToday: true });
  });

  it('stops tracking when gamification is switched off', async () => {
    const { client, userId } = await user();
    await setGamificationEnabled(client, userId, false);
    expect(await recordActivity(client, 'product_analyzed', GTINS[2]!, todayUtc())).toMatchObject({ counted: false, reason: 'disabled' });
    expect((await getGamification(client, todayUtc())).enabled).toBe(false);
    await setGamificationEnabled(client, userId, true);
    expect(await recordActivity(client, 'product_analyzed', GTINS[2]!, todayUtc())).toMatchObject({ counted: true });
  });

  it('counts a completed recipe once per day and awards RECIPE DISCOVERER', async () => {
    const { client } = await user();
    const first = await recordActivity(client, 'recipe_completed', 'lentejas-con-verduras', todayUtc());
    expect(first).toMatchObject({ counted: true, newAchievements: ['recipe_discoverer'] });
    expect(await recordActivity(client, 'recipe_completed', 'lentejas-con-verduras', todayUtc())).toMatchObject({ counted: false, reason: 'duplicate' });
    await expect(recordActivity(client, 'recipe_completed', 'receta-inventada', todayUtc())).rejects.toMatchObject({ code: '23503' });
  });

  it('keeps every table private and write-protected', async () => {
    const a = await user();
    const b = await user();
    await recordActivity(a.client, 'product_analyzed', GTINS[0]!, todayUtc());

    for (const table of ['activity_events', 'streak_daily_activity', 'user_streaks', 'user_achievements']) {
      const { data } = await b.client.from(table).select('*').eq('user_id', a.userId);
      expect(data ?? []).toHaveLength(0);
    }
    const forged = await a.client.from('user_achievements').insert({ user_id: a.userId, achievement: 'consistency' });
    expect(forged.error).not.toBeNull();
    const forgedDay = await a.client.from('streak_daily_activity').insert({ user_id: a.userId, activity_date: '2026-01-01', first_kind: 'meal_logged' });
    expect(forgedDay.error).not.toBeNull();
    const anon = await serviceClient().rpc('record_activity', { p_kind: 'product_analyzed', p_subject: GTINS[0], p_local_date: todayUtc() });
    expect(anon.error).not.toBeNull();
  });
});

describe('editorial recipes', () => {
  it('are public, linked to catalogue foods and their nutrition is computed from it', async () => {
    const { client } = await user();
    const recipes = await listRecipes(client);
    expect(recipes.length).toBeGreaterThanOrEqual(10);
    for (const r of recipes) {
      expect(r.ingredients.length).toBeGreaterThan(0);
      const n = recipeNutrition(r);
      expect(n.perServing.energy_kcal).toBeGreaterThan(0);
      expect(n.total.incomplete).not.toContain('energy_kcal');
    }
    const salmon = await getRecipe(client, 'salmon-al-horno-con-brocoli-y-patata');
    expect(salmon?.ingredients.map((i) => i.foodSlug)).toEqual(['salmon', 'brocoli', 'patata-asada', 'aceite-de-oliva']);
    // Clients can read but never write recipes.
    const write = await client.from('recipes').update({ title_es: 'x' }).eq('slug', 'lentejas-con-verduras').select();
    expect(write.data ?? []).toHaveLength(0);
  });
});
