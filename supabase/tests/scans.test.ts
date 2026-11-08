import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dailyTotals, deleteEntry, deleteScan, linkProductScan, linkScanToEntry, listEntries, listScans, recordScan } from '@repo/data';
import { deleteUser, newAnonymousUser, serviceClient } from './helpers';

/** Scan history: scanned products never count as eaten; adding one to the day does. */
const GTIN = '0000000000055';
const users: string[] = [];
let productId = '';

beforeAll(async () => {
  const { data, error } = await serviceClient()
    .from('products')
    .upsert(
      { gtin: GTIN, slug: `scan-test-${GTIN}`, name: 'Producto escaneado', source: 'editorial', source_id: 'scan-test', license: 'test', nutrition_available: true, energy_kcal: 400, protein_g: 10, carbs_g: 50, fat_g: 15, sugars_g: 20, saturated_fat_g: 5, salt_g: 0.5 },
      { onConflict: 'gtin' },
    )
    .select('id')
    .single();
  if (error) throw error;
  productId = data.id as string;
});

afterAll(async () => {
  await Promise.all(users.map(deleteUser));
  await serviceClient().from('products').delete().eq('gtin', GTIN);
});

async function user() {
  const u = await newAnonymousUser();
  users.push(u.userId);
  return u;
}

describe('product scans', () => {
  it('keeps one card per product and day and never adds nutrients', async () => {
    const { client } = await user();
    const day = '2026-11-08';
    await recordScan(client, productId, day, 'barcode');
    await recordScan(client, productId, day, 'barcode');
    const scans = await listScans(client, day);
    expect(scans).toHaveLength(1);
    expect(scans[0]).toMatchObject({ productId, source: 'barcode', entryId: null, product: { gtin: GTIN, nutritionAvailable: true } });
    // Scanning is not eating: the day stays empty.
    expect(await listEntries(client, day)).toHaveLength(0);
    expect(await dailyTotals(client, day, day)).toHaveLength(0);
  });

  it('adds a scanned product to the day only when the user confirms', async () => {
    const { client } = await user();
    const day = '2026-11-08';
    await recordScan(client, productId, day, 'barcode');
    const [scan] = await listScans(client, day);
    const entryId = randomUUID();
    const saved = await client.rpc('save_meal', {
      p_entry: { id: entryId, consumed_on: day, meal_type: 'snack', method: 'barcode' },
      p_items: [{ id: randomUUID(), food_kind: 'product', product_id: productId, display_name: 'Producto escaneado', amount: 30 }],
    });
    expect(saved.error).toBeNull();
    await linkScanToEntry(client, scan!.id, entryId);
    expect((await listScans(client, day))[0]!.entryId).toBe(entryId);
    const totals = await dailyTotals(client, day, day);
    expect(totals[0]!.nutrients.energy_kcal).toBe(120);
  });

  it('is private, links only to own entries, and deleting it keeps the diary', async () => {
    const a = await user();
    const b = await user();
    const day = '2026-11-08';
    await recordScan(a.client, productId, day, 'search');
    const [scan] = await listScans(a.client, day);
    expect(await listScans(b.client, day)).toHaveLength(0);

    const foreignEntry = randomUUID();
    await b.client.rpc('save_meal', {
      p_entry: { id: foreignEntry, consumed_on: day, meal_type: 'lunch', method: 'search' },
      p_items: [{ id: randomUUID(), food_kind: 'product', product_id: productId, display_name: 'x', amount: 10 }],
    });
    await expect(linkScanToEntry(a.client, scan!.id, foreignEntry)).rejects.toMatchObject({ code: '23503' });

    await deleteScan(b.client, scan!.id);
    expect(await listScans(a.client, day)).toHaveLength(1);
    await deleteScan(a.client, scan!.id);
    expect(await listScans(a.client, day)).toHaveLength(0);
    expect(await listEntries(b.client, day)).toHaveLength(1);
  });

  it('removes the scan with the entry it became (one item in the feed)', async () => {
    const { client } = await user();
    const day = '2026-11-09';
    await recordScan(client, productId, day, 'barcode');
    const entryId = randomUUID();
    await client.rpc('save_meal', {
      p_entry: { id: entryId, consumed_on: day, meal_type: 'breakfast', method: 'barcode' },
      p_items: [{ id: randomUUID(), food_kind: 'product', product_id: productId, display_name: 'Producto escaneado', amount: 50 }],
    });
    // Linked by product and day (what the product screen does after "Añadir al día").
    await linkProductScan(client, productId, day, entryId);
    expect((await listScans(client, day))[0]!.entryId).toBe(entryId);

    await deleteEntry(client, entryId);
    expect(await listEntries(client, day)).toHaveLength(0);
    expect(await listScans(client, day)).toHaveLength(0);
    expect(await dailyTotals(client, day, day)).toHaveLength(0);
    // The public product is untouched.
    const { data } = await serviceClient().from('products').select('energy_kcal').eq('id', productId).single();
    expect(data?.energy_kcal).toBe(400);
  });
});
