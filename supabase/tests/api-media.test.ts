import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { saveCommunityRecipe } from '@repo/data';
import { deleteUser, localStack, newAnonymousUser, serviceClient } from './helpers';

/** The web media route serves images of published publications only (real route + DB). */
let mediaRoute: typeof import('../../apps/web/src/app/api/v1/media/community/[...path]/route');
const users: string[] = [];
let foodId = '';

beforeAll(async () => {
  const s = localStack();
  process.env.NEXT_PUBLIC_SUPABASE_URL = s.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = s.anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = s.serviceKey;
  mediaRoute = await import('../../apps/web/src/app/api/v1/media/community/[...path]/route');
  const { data } = await serviceClient().from('generic_foods').select('id').eq('slug', 'copos-de-avena').single();
  foodId = data!.id as string;
});

afterAll(async () => {
  await Promise.all(users.map(deleteUser));
});

const get = (path: string) =>
  mediaRoute.GET(new Request(`http://test/api/v1/media/community/${path}`), { params: Promise.resolve({ path: path.split('/') }) });

describe('community media route', () => {
  it('serves a published image and 404s drafts and unknown files', async () => {
    const { client, userId } = await newAnonymousUser();
    users.push(userId);
    const path = `${userId}/${randomUUID()}.jpg`;
    await client.storage.from('community-media').upload(path, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), { contentType: 'image/jpeg' });
    const id = randomUUID();
    await saveCommunityRecipe(
      client,
      { id, title: 'Avena de prueba', summary: null, imagePath: path, minutes: 5, servings: 1, steps: ['Mezclar.'], ingredients: [{ kind: 'generic_food', foodId, label: 'Avena', grams: 40 }] },
      true,
    );

    expect((await get(path)).status).toBe(404); // in review: not public
    await serviceClient().from('community_recipes').update({ status: 'published' }).eq('id', id);
    const ok = await get(path);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('image/jpeg');
    expect((await get(`${userId}/${randomUUID()}.jpg`)).status).toBe(404);
    expect((await get('../etc/passwd')).status).toBe(404);
  });
});
