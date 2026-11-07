import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { anonClient, deleteUser, newAnonymousUser, serviceClient } from './helpers';

/**
 * Integration tests against the local Supabase stack (Auth + PostgREST +
 * Postgres). Run with `pnpm db:start && pnpm test:db`.
 */

let alice: { client: SupabaseClient; userId: string };
let bob: { client: SupabaseClient; userId: string };
let riceId: string;
let eggId: string;

beforeAll(async () => {
  alice = await newAnonymousUser();
  bob = await newAnonymousUser();
  const { data } = await anonClient()
    .from('generic_foods')
    .select('id, slug')
    .in('slug', ['arroz-blanco-cocido', 'huevo']);
  riceId = data!.find((r) => r.slug === 'arroz-blanco-cocido')!.id;
  eggId = data!.find((r) => r.slug === 'huevo')!.id;
});

afterAll(async () => {
  await deleteUser(alice.userId);
  await deleteUser(bob.userId);
});

async function createEntry(client: SupabaseClient, overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  const { error } = await client.from('food_entries').insert({
    id,
    consumed_on: '2026-11-07',
    meal_type: 'lunch',
    method: 'search',
    ...overrides,
  });
  if (error) throw error;
  return id;
}

describe('profiles', () => {
  it('creates a profile automatically on sign-up', async () => {
    const { data, error } = await alice.client.from('profiles').select('id, locale, country').single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: alice.userId, locale: 'es', country: 'ES' });
  });

  it('does not expose other users profiles', async () => {
    const { data } = await alice.client.from('profiles').select('id');
    expect(data?.map((r) => r.id)).toEqual([alice.userId]);
  });
});

describe('food diary', () => {
  it('snapshots catalogue nutrients and computes totals server-side', async () => {
    const entryId = await createEntry(alice.client);
    const { data, error } = await alice.client
      .from('food_entry_items')
      .insert({
        entry_id: entryId,
        food_kind: 'generic_food',
        generic_food_id: riceId,
        display_name: 'Arroz blanco cocido',
        amount: 150,
        // Client-supplied nutrients are ignored for catalogue items.
        per100: { energy_kcal: 1 },
        energy_kcal: 9999,
      })
      .select('energy_kcal, protein_g, carbs_g, fiber_g, per100, data_source, data_source_ref, basis')
      .single();
    expect(error).toBeNull();
    expect(Number(data!.energy_kcal)).toBe(195);
    expect(Number(data!.carbs_g)).toBeCloseTo(42.26, 2);
    expect(data!.per100.energy_kcal).toBe(130);
    expect(data).toMatchObject({ data_source: 'usda_fdc', data_source_ref: '169757', basis: '100g' });
  });

  it('recomputes totals when the amount changes, keeping the snapshot', async () => {
    const entryId = await createEntry(alice.client);
    const { data: item } = await alice.client
      .from('food_entry_items')
      .insert({ entry_id: entryId, food_kind: 'generic_food', generic_food_id: eggId, display_name: 'Huevo', amount: 50 })
      .select('id, energy_kcal')
      .single();
    expect(Number(item!.energy_kcal)).toBe(71.5);
    const { data: updated } = await alice.client
      .from('food_entry_items')
      .update({ amount: 100 })
      .eq('id', item!.id)
      .select('energy_kcal')
      .single();
    expect(Number(updated!.energy_kcal)).toBe(143);
  });

  it('accepts custom items but rejects implausible values', async () => {
    const entryId = await createEntry(alice.client, { method: 'quick_add' });
    const ok = await alice.client
      .from('food_entry_items')
      .insert({
        entry_id: entryId,
        food_kind: 'custom',
        display_name: 'Bocadillo casero',
        amount: 200,
        per100: { energy_kcal: 250, protein_g: 10, carbs_g: 30, fat_g: 9, fiber_g: null },
      })
      .select('energy_kcal, fiber_g, data_source')
      .single();
    expect(ok.error).toBeNull();
    expect(Number(ok.data!.energy_kcal)).toBe(500);
    expect(ok.data!.fiber_g).toBeNull();
    expect(ok.data!.data_source).toBe('user_contribution');

    const bad = await alice.client.from('food_entry_items').insert({
      entry_id: entryId,
      food_kind: 'custom',
      display_name: 'Imposible',
      amount: 100,
      per100: { energy_kcal: 2000 },
    });
    expect(bad.error).not.toBeNull();

    const badType = await alice.client.from('food_entry_items').insert({
      entry_id: entryId,
      food_kind: 'custom',
      display_name: 'Texto',
      amount: 100,
      per100: { energy_kcal: 'mucho' },
    });
    expect(badType.error).not.toBeNull();
  });

  it('makes saves idempotent through client-generated ids', async () => {
    const id = randomUUID();
    const row = { id, consumed_on: '2026-11-07', meal_type: 'snack', method: 'search' };
    const first = await alice.client.from('food_entries').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    const second = await alice.client.from('food_entries').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    const { count } = await alice.client.from('food_entries').select('id', { count: 'exact', head: true }).eq('id', id);
    expect(count).toBe(1);
  });

  it('isolates diaries between users', async () => {
    const entryId = await createEntry(alice.client);
    const read = await bob.client.from('food_entries').select('id').eq('id', entryId);
    expect(read.data).toEqual([]);

    const update = await bob.client.from('food_entries').update({ title: 'hacked' }).eq('id', entryId).select('id');
    expect(update.data).toEqual([]);

    const inject = await bob.client.from('food_entry_items').insert({
      entry_id: entryId,
      food_kind: 'generic_food',
      generic_food_id: riceId,
      display_name: 'x',
      amount: 10,
    });
    expect(inject.error).not.toBeNull();

    const spoof = await bob.client.from('food_entries').insert({
      id: randomUUID(),
      user_id: alice.userId,
      consumed_on: '2026-11-07',
      meal_type: 'lunch',
      method: 'search',
    });
    expect(spoof.error).not.toBeNull();
  });

  it('aggregates daily totals through an RLS-respecting view', async () => {
    const { client, userId } = await newAnonymousUser();
    try {
      const entryId = await createEntry(client, { consumed_on: '2026-11-01' });
      // Rows with different keys: missing keys must use column defaults, not NULL.
      const inserted = await client.from('food_entry_items').insert(
        [
          { entry_id: entryId, food_kind: 'generic_food', generic_food_id: riceId, display_name: 'Arroz', amount: 200 },
          { entry_id: entryId, food_kind: 'generic_food', generic_food_id: eggId, display_name: 'Huevo', amount: 100, is_estimate: true },
        ],
        { defaultToNull: false },
      );
      expect(inserted.error).toBeNull();
      const { data } = await client.from('daily_nutrition').select('*');
      expect(data).toHaveLength(1);
      expect(Number(data![0].energy_kcal)).toBe(403);
      expect(data![0]).toMatchObject({ entry_count: 1, item_count: 2, has_estimates: true });
      const other = await bob.client.from('daily_nutrition').select('*').eq('user_id', userId);
      expect(other.data).toEqual([]);
    } finally {
      await deleteUser(userId);
    }
  });
});

describe('health data and consent', () => {
  it('requires explicit consent to store health data and erases it on revocation', async () => {
    const { client, userId } = await newAnonymousUser();
    try {
      const denied = await client.from('health_profiles').insert({ weight_kg: 70, height_cm: 175 });
      expect(denied.error).not.toBeNull();

      await client.from('user_consents').insert({ consent_type: 'health_data', granted: true, policy_version: 'test' });
      const allowed = await client.from('health_profiles').insert({ weight_kg: 70, height_cm: 175 });
      expect(allowed.error).toBeNull();
      const weight = await client.from('weight_logs').insert({ logged_on: '2026-11-07', weight_kg: 70 });
      expect(weight.error).toBeNull();

      await client.from('user_consents').insert({ consent_type: 'health_data', granted: false, policy_version: 'test' });
      const { data: hp } = await client.from('health_profiles').select('*');
      const { data: wl } = await client.from('weight_logs').select('*');
      expect(hp).toEqual([]);
      expect(wl).toEqual([]);

      const rewrite = await client.from('user_consents').update({ granted: true }).eq('user_id', userId);
      expect(rewrite.error).not.toBeNull();
    } finally {
      await deleteUser(userId);
    }
  });
});

describe('catalogue', () => {
  it('is readable anonymously but not writable by clients', async () => {
    const read = await anonClient().from('generic_foods').select('slug').eq('slug', 'manzana').single();
    expect(read.data?.slug).toBe('manzana');

    const write = await alice.client.from('generic_foods').update({ energy_kcal: 1 }).eq('slug', 'manzana');
    expect(write.error).not.toBeNull();

    const snapshots = await alice.client.from('product_snapshots').select('id');
    expect(snapshots.error).not.toBeNull();
  });

  it('searches foods, additives and barcodes', async () => {
    const { data: rice } = await anonClient().rpc('search_catalog', { q: 'arroz' });
    expect(rice![0]).toMatchObject({ kind: 'generic_food', title: 'Arroz blanco cocido' });

    const { data: additive } = await anonClient().rpc('search_catalog', { q: 'E330' });
    expect(additive![0]).toMatchObject({ kind: 'additive', id: 'e330' });

    const { data: english } = await anonClient().rpc('search_catalog', { q: 'chicken', lang: 'en' });
    expect(english![0].title).toContain('Chicken');

    const svc = serviceClient();
    await svc.from('products').upsert(
      { gtin: '0000000000017', slug: 'test-product-0000000000017', name: 'Producto de prueba', source: 'editorial', source_id: 'test', license: 'test' },
      { onConflict: 'gtin' },
    );
    const { data: byCode } = await anonClient().rpc('search_catalog', { q: '0000000000017', kinds: ['product'] });
    expect(byCode![0]).toMatchObject({ kind: 'product', title: 'Producto de prueba' });
    await svc.from('products').delete().eq('gtin', '0000000000017');
  });

  it('suggests generic foods for free-text descriptions', async () => {
    const { data } = await anonClient().rpc('match_generic_foods', { q: 'cooked white rice', lim: 3 });
    expect(data![0].slug).toBe('arroz-blanco-cocido');
  });
});

describe('contributions', () => {
  it('only accepts pending submissions from users', async () => {
    const ok = await alice.client.from('contributions').insert({ kind: 'label_scan', gtin: '8410000000001', payload: { a: 1 } });
    expect(ok.error).toBeNull();
    const selfApproved = await alice.client
      .from('contributions')
      .insert({ kind: 'label_scan', gtin: '8410000000001', payload: { a: 1 }, status: 'approved' });
    expect(selfApproved.error).not.toBeNull();
  });
});
