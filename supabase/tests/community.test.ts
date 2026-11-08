import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  communityRecipeNutrition,
  deleteCommunityArticle,
  getCommunityRecipe,
  getPublicProfile,
  listMyRecipes,
  listPublishedArticles,
  listPublishedRecipes,
  publicAchievements,
  saveCommunityArticle,
  saveCommunityRecipe,
  savePublicProfile,
  type RecipeDraft,
} from '@repo/data';
import { anonClient, deleteUser, newAnonymousUser, serviceClient } from './helpers';

/** Public profiles never carry health data; publications are moderated. */
const users: string[] = [];
let food: { id: string; kcal: number } = { id: '', kcal: 0 };

beforeAll(async () => {
  const { data, error } = await serviceClient().from('generic_foods').select('id, energy_kcal').not('energy_kcal', 'is', null).limit(1).single();
  if (error) throw error;
  food = { id: data.id as string, kcal: Number(data.energy_kcal) };
});

afterAll(async () => {
  await Promise.all(users.map(deleteUser));
});

async function user() {
  const u = await newAnonymousUser();
  users.push(u.userId);
  return u;
}

function recipe(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    id: randomUUID(),
    title: 'Tostada de prueba',
    summary: null,
    imagePath: null,
    minutes: 10,
    servings: 2,
    steps: ['Tostar el pan.', 'Servir.'],
    ingredients: [{ kind: 'generic_food', foodId: food.id, label: 'Ingrediente', grams: 200 }],
    ...overrides,
  };
}

describe('public profile', () => {
  it('is private by default and holds only what the person chose to show', async () => {
    const a = await user();
    const b = await user();
    await savePublicProfile(a.client, a.userId, { username: `ana_${a.userId.slice(0, 6)}`, displayName: 'Ana', bio: 'Cocino los domingos.' });

    // Private until the person turns it public.
    expect(await getPublicProfile(b.client, a.userId)).toBeNull();
    expect((await anonClient().from('public_profiles').select('user_id').eq('user_id', a.userId)).data ?? []).toHaveLength(0);
    expect(await getPublicProfile(a.client, a.userId)).toMatchObject({ isPublic: false, displayName: 'Ana' });

    await savePublicProfile(a.client, a.userId, { isPublic: true });
    const seen = await getPublicProfile(b.client, a.userId);
    expect(seen).toMatchObject({ isPublic: true, displayName: 'Ana', bio: 'Cocino los domingos.', showAchievements: false });
    // Privacy by construction: no health, goal or history columns exist here.
    const { data } = await anonClient().from('public_profiles').select('*').eq('user_id', a.userId).single();
    expect(Object.keys(data ?? {}).sort()).toEqual(['avatar_path', 'bio', 'display_name', 'is_public', 'show_achievements', 'updated_at', 'user_id', 'username']);

    // Others cannot edit it, and health data stays private.
    const hijack = await b.client.from('public_profiles').update({ bio: 'x' }).eq('user_id', a.userId).select();
    expect(hijack.data ?? []).toHaveLength(0);
    expect((await getPublicProfile(b.client, a.userId))?.bio).toBe('Cocino los domingos.');
    const health = await b.client.from('health_profiles').select('*').eq('user_id', a.userId);
    expect(health.data ?? []).toHaveLength(0);
  });

  it('shows achievements only on a public profile that opted in', async () => {
    const a = await user();
    await serviceClient().from('user_achievements').insert({ user_id: a.userId, achievement: 'first_scan' });
    await savePublicProfile(a.client, a.userId, { displayName: 'Ana', showAchievements: true });
    expect(await publicAchievements(anonClient(), a.userId)).toHaveLength(0);
    await savePublicProfile(a.client, a.userId, { isPublic: true, showAchievements: false });
    expect(await publicAchievements(anonClient(), a.userId)).toHaveLength(0);
    await savePublicProfile(a.client, a.userId, { showAchievements: true });
    expect((await publicAchievements(anonClient(), a.userId)).map((x) => x.achievement)).toEqual(['first_scan']);
  });
});

describe('private media', () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const canSign = async (client: ReturnType<typeof anonClient>, bucket: 'avatars' | 'community-media', path: string) =>
    !(await client.storage.from(bucket).createSignedUrl(path, 60)).error;

  it('serves drafts only to their owner, and published images to everyone', async () => {
    const a = await user();
    const b = await user();
    const path = `${a.userId}/${randomUUID()}.jpg`;
    const up = await a.client.storage.from('community-media').upload(path, bytes, { contentType: 'image/jpeg' });
    expect(up.error).toBeNull();

    // A hard-to-guess URL is not access: the bucket is private.
    const publicUrl = a.client.storage.from('community-media').getPublicUrl(path).data.publicUrl;
    expect((await fetch(publicUrl)).ok).toBe(false);
    expect(await canSign(a.client, 'community-media', path)).toBe(true);
    expect(await canSign(b.client, 'community-media', path)).toBe(false);
    expect(await canSign(anonClient(), 'community-media', path)).toBe(false);

    const draft = recipe({ imagePath: path });
    await saveCommunityRecipe(a.client, draft, true);
    expect(await canSign(b.client, 'community-media', path)).toBe(false);
    await serviceClient().from('community_recipes').update({ status: 'published' }).eq('id', draft.id);
    expect(await canSign(anonClient(), 'community-media', path)).toBe(true);
    const signed = await anonClient().storage.from('community-media').createSignedUrl(path, 60);
    expect((await fetch(signed.data!.signedUrl)).ok).toBe(true);

    // Others can never overwrite or delete it.
    const overwrite = await b.client.storage.from('community-media').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    expect(overwrite.error).not.toBeNull();
  });

  it('shows an avatar to others only when the profile is public', async () => {
    const a = await user();
    const b = await user();
    const path = `${a.userId}/${randomUUID()}.jpg`;
    await a.client.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg' });
    await savePublicProfile(a.client, a.userId, { displayName: 'Ana', avatarPath: path });
    expect(await canSign(a.client, 'avatars', path)).toBe(true);
    expect(await canSign(b.client, 'avatars', path)).toBe(false);
    await savePublicProfile(a.client, a.userId, { isPublic: true });
    expect(await canSign(b.client, 'avatars', path)).toBe(true);
    expect(await canSign(anonClient(), 'avatars', path)).toBe(true);
  });
});

describe('community recipes', () => {
  it('moves from draft to review and is only public once a moderator publishes it', async () => {
    const a = await user();
    const b = await user();
    const draft = recipe();
    expect(await saveCommunityRecipe(a.client, draft, false)).toBe('draft');
    expect(await getCommunityRecipe(b.client, draft.id)).toBeNull();

    expect(await saveCommunityRecipe(a.client, draft, true)).toBe('pending_review');
    const mine = await listMyRecipes(a.client, a.userId);
    expect(mine[0]).toMatchObject({ id: draft.id, status: 'pending_review', publishedAt: null });
    expect(mine[0]!.submittedAt).not.toBeNull();
    expect(await listPublishedRecipes(anonClient(), a.userId)).toHaveLength(0);

    // Authors cannot publish themselves.
    const self = await a.client.from('community_recipes').update({ status: 'published' }).eq('id', draft.id);
    expect(self.error?.code).toBe('42501');

    // A moderator publishes: now visible to everyone, with catalogue nutrition.
    const mod = await serviceClient().from('community_recipes').update({ status: 'published' }).eq('id', draft.id);
    expect(mod.error).toBeNull();
    const pub = await listPublishedRecipes(anonClient(), a.userId);
    expect(pub).toHaveLength(1);
    expect(pub[0]!.publishedAt).not.toBeNull();
    const n = communityRecipeNutrition(pub[0]!);
    expect(n.total.values.energy_kcal).toBeCloseTo(food.kcal * 2, 0);
    expect(n.perServing.energy_kcal).toBeCloseTo(food.kcal, 0);

    // Ingredients of a published recipe cannot change silently.
    const sneaky = await a.client.from('community_recipe_ingredients').update({ grams: 900 }).eq('recipe_id', draft.id).select();
    expect(sneaky.data ?? []).toHaveLength(0);

    // Editing it sends it back to review and takes it offline.
    expect(await saveCommunityRecipe(a.client, { ...draft, title: 'Tostada mejorada' }, true)).toBe('pending_review');
    expect(await listPublishedRecipes(anonClient(), a.userId)).toHaveLength(0);
  });

  it('needs ingredients to go to review and cannot touch other people’s recipes', async () => {
    const a = await user();
    const b = await user();
    await expect(saveCommunityRecipe(a.client, recipe({ ingredients: [] }), true)).rejects.toMatchObject({ code: '23514' });
    const draft = recipe();
    await saveCommunityRecipe(a.client, draft, false);
    await expect(saveCommunityRecipe(b.client, { ...draft, title: 'Robada' }, false)).rejects.toBeTruthy();
    expect((await getCommunityRecipe(a.client, draft.id))?.title).toBe('Tostada de prueba');
    const del = await b.client.from('community_recipes').delete().eq('id', draft.id).select();
    expect(del.data ?? []).toHaveLength(0);
  });
});

describe('community articles', () => {
  it('requires sources to be reviewed and is never self-published', async () => {
    const a = await user();
    const id = randomUUID();
    const body = 'La fibra alimentaria '.repeat(15);
    await expect(saveCommunityArticle(a.client, { id, title: 'Sobre la fibra', coverPath: null, body, sources: [] }, true)).rejects.toMatchObject({ code: '23514' });
    expect(await saveCommunityArticle(a.client, { id, title: 'Sobre la fibra', coverPath: null, body, sources: ['EFSA (2010) doi:10.2903/j.efsa.2010.1462'] }, true)).toBe('pending_review');
    expect(await listPublishedArticles(anonClient(), a.userId)).toHaveLength(0);
    const self = await a.client.from('community_articles').update({ status: 'published' }).eq('id', id);
    expect(self.error?.code).toBe('42501');
    await deleteCommunityArticle(a.client, id);
    expect((await a.client.from('community_articles').select('id').eq('id', id)).data ?? []).toHaveLength(0);
  });
});
