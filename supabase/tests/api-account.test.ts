import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { localStack, newAnonymousUser, serviceClient } from './helpers';

/** Scenario H: a user exports their data and deletes the account (real routes + DB). */
let accountRoute: typeof import('../../apps/web/src/app/api/v1/account/route');
let exportRoute: typeof import('../../apps/web/src/app/api/v1/account/export/route');

beforeAll(async () => {
  const s = localStack();
  process.env.NEXT_PUBLIC_SUPABASE_URL = s.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = s.anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = s.serviceKey;
  accountRoute = await import('../../apps/web/src/app/api/v1/account/route');
  exportRoute = await import('../../apps/web/src/app/api/v1/account/export/route');
});

describe('account export and deletion', () => {
  it('exports the user data and then deletes everything private', async () => {
    const { client, userId } = await newAnonymousUser();
    const token = (await client.auth.getSession()).data.session!.access_token;
    const auth = { Authorization: `Bearer ${token}` };

    const { data: rice } = await client.from('generic_foods').select('id').eq('slug', 'arroz-blanco-cocido').single();
    const entryId = randomUUID();
    await client.rpc('save_meal', {
      p_entry: { id: entryId, consumed_on: '2026-11-07', meal_type: 'lunch', method: 'search' },
      p_items: [{ id: randomUUID(), food_kind: 'generic_food', generic_food_id: rice!.id, display_name: 'Arroz', amount: 150 }],
    });
    await client.from('contributions').insert({ kind: 'label_scan', gtin: '8410000000001', payload: { test: true } });
    const photo = await client.storage.from('meal-photos').upload(`${userId}/${entryId}.jpg`, new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), { contentType: 'image/jpeg' });
    expect(photo.error).toBeNull();

    const exported = await exportRoute.GET(new Request('http://test/api/v1/account/export', { headers: auth }));
    expect(exported.status).toBe(200);
    const body = await exported.json();
    expect(body.userId).toBe(userId);
    expect(body.food_entries).toHaveLength(1);
    expect(body.food_entries[0].food_entry_items).toHaveLength(1);
    expect(body.profiles).toHaveLength(1);

    const deleted = await accountRoute.DELETE(new Request('http://test/api/v1/account', { method: 'DELETE', headers: auth }));
    expect(deleted.status).toBe(200);

    const svc = serviceClient();
    const [{ count: entries }, { count: profiles }, { data: files }, { data: contributions }] = await Promise.all([
      svc.from('food_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      svc.from('profiles').select('id', { count: 'exact', head: true }).eq('id', userId),
      svc.storage.from('meal-photos').list(userId),
      svc.from('contributions').select('user_id').eq('gtin', '8410000000001').eq('kind', 'label_scan'),
    ]);
    expect(entries).toBe(0);
    expect(profiles).toBe(0);
    expect(files ?? []).toHaveLength(0);
    // Contributions are kept for moderation but anonymised.
    expect(contributions?.every((c) => c.user_id !== userId)).toBe(true);

    const after = await exportRoute.GET(new Request('http://test/api/v1/account/export', { headers: auth }));
    expect(after.status).toBe(401);
  });
});
