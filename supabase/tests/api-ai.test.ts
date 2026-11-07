import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LabelDraftSchema, MealDraftSchema } from '@repo/core';
import type { StructuredProvider } from '@repo/ai';
import { deleteUser, localStack, newAnonymousUser } from './helpers';

/**
 * Runs the real Next.js route handlers (auth, consent, quotas, cache, draft
 * building against the real catalogue) with a STUB model provider. The stub
 * returns fixed perception output — test fixtures, never shown to users.
 */
const stub = vi.hoisted(() => ({ calls: 0, next: null as unknown }));

vi.mock('@/server/ai', () => {
  const provider: StructuredProvider = {
    id: 'stub',
    isConfigured: () => true,
    modelFor: () => 'stub-model',
    async generate() {
      stub.calls += 1;
      return { data: stub.next as never, usage: { provider: 'stub', model: 'stub-model', inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, latencyMs: 1 } };
    },
  };
  return {
    aiProvider: () => provider,
    transcriptionProvider: () => ({ id: 'stub', isConfigured: () => false, transcribe: async () => ({ text: '', language: null, usage: null }) }),
  };
});

const MEAL_FIXTURE = {
  is_food: true,
  image_issue: 'none',
  meal_name_es: 'Arroz con pollo',
  meal_name_en: 'Chicken with rice',
  items: [
    { name_es: 'Arroz blanco', name_en: 'White rice', catalog_slug: 'arroz-blanco-cocido', food_query: 'white rice cooked', estimated_grams: 180, min_grams: 140, max_grams: 220, confidence: 'high' },
    { name_es: 'Pollo a la plancha', name_en: 'Grilled chicken', catalog_slug: null, food_query: 'chicken breast', estimated_grams: 120, min_grams: 90, max_grams: 150, confidence: 'medium' },
    { name_es: 'Salsa misteriosa', name_en: 'Mystery sauce', catalog_slug: 'not-in-catalogue', food_query: 'zzqx sauce', estimated_grams: 30, min_grams: 10, max_grams: 50, confidence: 'low' },
  ],
  questions: [
    {
      id: 'oil',
      question_es: '¿Se cocinó con aceite?',
      question_en: 'Was it cooked with oil?',
      if_yes_name_es: 'Aceite de oliva',
      if_yes_name_en: 'Olive oil',
      if_yes_catalog_slug: 'aceite-de-oliva',
      if_yes_food_query: 'olive oil',
      if_yes_grams: 10,
    },
  ],
};

let mealPhoto: typeof import('../../apps/web/src/app/api/v1/ai/meal-photo/route');
let parseMeal: typeof import('../../apps/web/src/app/api/v1/ai/parse-meal/route');
let label: typeof import('../../apps/web/src/app/api/v1/ai/label/route');
let user: Awaited<ReturnType<typeof newAnonymousUser>>;
let token: string;

function jpeg(seed: number): Blob {
  // Only the JPEG signature matters for upload validation; the stub never decodes it.
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, seed, 1, 2, 3])], { type: 'image/jpeg' });
}

function postImage(handler: (r: Request) => Promise<Response>, seed: number) {
  const form = new FormData();
  form.append('image', jpeg(seed), 'photo.jpg');
  return handler(new Request('http://test/api', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'es' }, body: form }));
}

beforeAll(async () => {
  const s = localStack();
  process.env.NEXT_PUBLIC_SUPABASE_URL = s.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = s.anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = s.serviceKey;
  process.env.AI_DAILY_LIMIT_MEAL_PHOTO = '1';
  mealPhoto = await import('../../apps/web/src/app/api/v1/ai/meal-photo/route');
  parseMeal = await import('../../apps/web/src/app/api/v1/ai/parse-meal/route');
  label = await import('../../apps/web/src/app/api/v1/ai/label/route');
  user = await newAnonymousUser();
  token = (await user.client.auth.getSession()).data.session!.access_token;
});

afterAll(async () => {
  await deleteUser(user.userId);
});

describe('AI routes (stub provider, real database)', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await mealPhoto.POST(new Request('http://test/api', { method: 'POST', body: new FormData() }));
    expect(res.status).toBe(401);
  });

  it('requires AI-processing consent', async () => {
    stub.next = MEAL_FIXTURE;
    const res = await postImage(mealPhoto.POST, 1);
    expect(res.status).toBe(403);
    expect(stub.calls).toBe(0);
  });

  it('builds a catalogue-backed draft, caches it and enforces quotas', async () => {
    await user.client.from('user_consents').insert({ consent_type: 'ai_processing', granted: true, policy_version: 'test' });
    stub.next = MEAL_FIXTURE;

    const res = await postImage(mealPhoto.POST, 1);
    expect(res.status).toBe(200);
    const draft = MealDraftSchema.parse(await res.json());
    expect(stub.calls).toBe(1);
    expect(draft.cached).toBe(false);
    expect(draft.title).toBe('Arroz con pollo');

    const [rice, chicken, sauce] = draft.items;
    expect(rice!.match).toMatchObject({ kind: 'generic_food', name: 'Arroz blanco cocido', score: 1 });
    expect(rice!.match!.nutrientsPer100.energy_kcal).toBe(130); // USDA FDC 169757
    expect(chicken!.match?.name).toBe('Pechuga de pollo asada sin piel'); // matched by text, no slug
    expect(sauce!.match).toBeNull(); // unknown slug and no text match: the user must choose
    expect(draft.notices).toEqual(expect.arrayContaining(['unmatched_items', 'low_confidence', 'quantities_estimated']));
    expect(draft.questions[0]!.item.match?.name).toBe('Aceite de oliva');

    const again = await postImage(mealPhoto.POST, 1);
    expect(MealDraftSchema.parse(await again.json()).cached).toBe(true);
    expect(stub.calls).toBe(1);

    const overQuota = await postImage(mealPhoto.POST, 2);
    expect(overQuota.status).toBe(429);
    expect((await overQuota.json()).error.code).toBe('quota_exceeded');

    const { data: usage } = await user.client.from('ai_usage').select('status').eq('feature', 'meal_photo');
    expect(usage?.map((u) => u.status).sort()).toEqual(['cached', 'ok']);
  });

  it('turns a spoken description into amounts using USDA household portions', async () => {
    stub.next = {
      intent: 'log_food',
      meal_type: 'breakfast',
      day_offset: -1,
      items: [
        { spoken_text: 'dos huevos', name_es: 'Huevos', name_en: 'Eggs', catalog_slug: 'huevo', food_query: 'egg', quantity: 2, unit: 'unit', quantity_specified: true, estimated_grams: 100 },
        { spoken_text: 'un vaso de leche', name_es: 'Leche', name_en: 'Milk', catalog_slug: 'leche-entera', food_query: 'whole milk', quantity: 250, unit: 'ml', quantity_specified: true, estimated_grams: 250 },
      ],
      clarification_es: null,
      clarification_en: null,
    };
    const res = await parseMeal.POST(
      new Request('http://test/api', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept-Language': 'es' },
        body: JSON.stringify({ text: 'ayer desayuné dos huevos y un vaso de leche', source: 'voice', today: '2026-11-07' }),
      }),
    );
    expect(res.status).toBe(200);
    const draft = MealDraftSchema.parse(await res.json());
    expect(draft).toMatchObject({ mealType: 'breakfast', dayOffset: -1, source: 'voice' });
    expect(draft.items[0]).toMatchObject({ grams: 88, quantityLabel: '2 × huevo mediano', amountIsEstimate: true });
    // 250 ml × USDA-derived density of whole milk (244 g per US cup).
    expect(draft.items[1]!.grams).toBeCloseTo(257.8, 0);
    expect(draft.items[1]!.amountIsEstimate).toBe(false);
  });

  it('validates label readings deterministically', async () => {
    stub.next = {
      legibility: 'good',
      basis: 'per_100g',
      serving_size_g: null,
      product_name: 'Galletas',
      brand: null,
      net_quantity_text: '200 g',
      nutrition: { energy_kj: 2000, energy_kcal: 2000, fat_g: 20, saturated_fat_g: 25, carbs_g: 60, sugars_g: 30, fiber_g: 3, protein_g: 6, salt_g: 0.5, sodium_g: null },
      ingredients_text: 'Harina de trigo, azúcar, aceite de girasol',
      allergens_mentioned: ['gluten'],
      low_confidence_fields: ['energy_kcal'],
    };
    const res = await postImage(label.POST, 9);
    expect(res.status).toBe(200);
    const draft = LabelDraftSchema.parse(await res.json());
    const codes = draft.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['kj_kcal_mismatch', 'saturates_exceed_fat', 'value_out_of_range']));
    expect(draft.allergens).toEqual(['gluten']);
  });
});
