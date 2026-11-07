import { z } from 'zod';
import { LabelDraftSchema, MealDraftSchema, TranscriptSchema } from './ai';
import { GenericFoodSchema } from './foods';
import { CatalogProductSchema, BASES } from './products';

/* --------------------------------- DTOs --------------------------------- */

export const SEARCH_KINDS = ['generic_food', 'product', 'additive'] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export const SearchHitSchema = z.object({
  kind: z.enum(SEARCH_KINDS),
  id: z.string(),
  slug: z.string().nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  imageUrl: z.string().nullable(),
  energyKcalPer100: z.number().nullable(),
  basis: z.enum(BASES).nullable(),
  score: z.number(),
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const SearchResponseSchema = z.object({ query: z.string(), hits: z.array(SearchHitSchema) });
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const ProductLookupSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('found'),
    origin: z.enum(['cache', 'open_food_facts']),
    product: CatalogProductSchema,
  }),
  z.object({ status: z.literal('not_found'), gtin: z.string() }),
  z.object({ status: z.literal('invalid_code') }),
]);
export type ProductLookup = z.infer<typeof ProductLookupSchema>;

export const AdditiveSourceSchema = z.object({
  title: z.string(),
  url: z.string().nullable(),
  publisher: z.string(),
  publishedOn: z.string().nullable(),
  kind: z.string(),
});

export const AdditiveSchema = z.object({
  code: z.string(),
  eNumber: z.string(),
  nameEs: z.string().nullable(),
  nameEn: z.string().nullable(),
  classes: z.array(z.string()),
  efsa: z
    .object({
      title: z.string().nullable(),
      url: z.string().nullable(),
      date: z.string().nullable(),
      adiMgPerKgBw: z.number().nullable(),
      exposureAboveAdiGroups: z.array(z.string()),
    })
    .nullable(),
  editorialNoteEs: z.string().nullable(),
  editorialNoteEn: z.string().nullable(),
  reviewStatus: z.enum(['not_reviewed', 'in_review', 'reviewed']),
  reviewedAt: z.string().nullable(),
  sources: z.array(AdditiveSourceSchema),
});
export type Additive = z.infer<typeof AdditiveSchema>;

export const HealthSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  services: z.object({
    database: z.boolean(),
    openFoodFacts: z.boolean(),
    aiVision: z.boolean(),
    aiText: z.boolean(),
    transcription: z.boolean(),
  }),
});
export type Health = z.infer<typeof HealthSchema>;

export const API_ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'invalid_input',
  'not_found',
  'rate_limited',
  'quota_exceeded',
  'ai_not_configured',
  'ai_failed',
  'upstream_unavailable',
  'payload_too_large',
  'internal',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const ApiErrorBodySchema = z.object({
  error: z.object({ code: z.enum(API_ERROR_CODES), message: z.string() }),
});

/* -------------------------------- client -------------------------------- */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network' | 'invalid_response',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
  locale?: () => string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type Parser<T> = { safeParse(data: unknown): { success: true; data: T } | { success: false } };

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;
  const base = options.baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, parser: Parser<T>, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
    const headers = new Headers(init.headers);
    const token = await options.getAccessToken?.();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const locale = options.locale?.();
    if (locale) headers.set('Accept-Language', locale);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? options.timeoutMs ?? 30_000);
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, { ...init, headers, signal: controller.signal });
    } catch (e) {
      throw new ApiError(0, 'network', e instanceof Error ? e.message : 'Network error');
    } finally {
      clearTimeout(timer);
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const parsed = ApiErrorBodySchema.safeParse(body);
      if (parsed.success) throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message);
      throw new ApiError(res.status, res.status === 401 ? 'unauthorized' : 'internal', `HTTP ${res.status}`);
    }
    const parsed = parser.safeParse(body);
    if (!parsed.success) throw new ApiError(res.status, 'invalid_response', 'Unexpected response shape');
    return parsed.data;
  }

  const json = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    health: () => request('/api/v1/health', HealthSchema),
    search: (q: string, kinds?: SearchKind[], limit = 20) => {
      const params = new URLSearchParams({ q, limit: String(limit) });
      if (kinds?.length) params.set('kinds', kinds.join(','));
      return request(`/api/v1/search?${params.toString()}`, SearchResponseSchema);
    },
    lookupProduct: (code: string) => request(`/api/v1/products/${encodeURIComponent(code)}`, ProductLookupSchema),
    getProductById: (id: string) => request(`/api/v1/products/id/${encodeURIComponent(id)}`, CatalogProductSchema),
    getGenericFood: (id: string) => request(`/api/v1/foods/${encodeURIComponent(id)}`, GenericFoodSchema),
    getAdditive: (code: string) => request(`/api/v1/additives/${encodeURIComponent(code)}`, AdditiveSchema),
    analyzeMealPhoto: (form: FormData) =>
      request('/api/v1/ai/meal-photo', MealDraftSchema, { method: 'POST', body: form, timeoutMs: 90_000 }),
    parseMealText: (text: string, source: 'voice' | 'text' = 'text', today?: string) =>
      request('/api/v1/ai/parse-meal', MealDraftSchema, { ...json({ text, source, today }), timeoutMs: 60_000 }),
    transcribe: (form: FormData) =>
      request('/api/v1/ai/transcribe', TranscriptSchema, { method: 'POST', body: form, timeoutMs: 60_000 }),
    extractLabel: (form: FormData) =>
      request('/api/v1/ai/label', LabelDraftSchema, { method: 'POST', body: form, timeoutMs: 90_000 }),
    deleteAccount: () => request('/api/v1/account', z.object({ deleted: z.literal(true) }), { method: 'DELETE' }),
    exportAccount: () => request('/api/v1/account/export', z.record(z.string(), z.unknown())),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
