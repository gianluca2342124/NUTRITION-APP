import 'server-only';
import {
  OFF_FIELDS,
  normalizeOffProduct,
  offProductUrl,
  type CatalogProduct,
  type OffProduct,
} from '@repo/core';
import { getProductByGtin, productSlug, productToRow } from '@repo/data';
import { env } from './env';
import { ApiFailure } from './http';
import { publicClient, serviceClient } from './supabase';

export type LookupResult =
  | { status: 'found'; origin: 'cache' | 'open_food_facts'; product: CatalogProduct }
  | { status: 'not_found'; gtin: string };

function isFresh(p: CatalogProduct): boolean {
  const days = env().OFF_CACHE_DAYS;
  return Date.now() - new Date(p.updatedAt).getTime() < days * 86_400_000;
}

async function fetchFromOff(gtin: string): Promise<OffProduct | null | 'unavailable'> {
  try {
    const res = await fetch(offProductUrl(gtin), {
      headers: { 'User-Agent': env().OFF_USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) return 'unavailable';
    const body = (await res.json()) as { status?: number; product?: OffProduct };
    if (body.status !== 1 || !body.product) return null;
    return body.product;
  } catch {
    return 'unavailable';
  }
}

/**
 * Barcode lookup: serves the cached catalogue record when fresh, otherwise
 * refreshes it from Open Food Facts. Stale records are served (and flagged by
 * their timestamps) when the upstream is unavailable. Never fabricates data.
 */
export async function lookupProduct(gtin: string): Promise<LookupResult> {
  const cached = await getProductByGtin(publicClient(), gtin);
  if (cached && (isFresh(cached) || cached.source !== 'open_food_facts')) {
    return { status: 'found', origin: 'cache', product: cached };
  }

  const remote = await fetchFromOff(gtin);
  if (remote === 'unavailable') {
    if (cached) return { status: 'found', origin: 'cache', product: cached };
    throw new ApiFailure(503, 'upstream_unavailable', 'The product database is temporarily unavailable. Try again shortly.');
  }
  const normalized = remote ? normalizeOffProduct(remote) : null;
  if (!normalized) {
    if (cached) return { status: 'found', origin: 'cache', product: cached };
    return { status: 'not_found', gtin };
  }

  const db = serviceClient();
  const { data, error } = await db
    .from('products')
    .upsert(productToRow(normalized, cached?.slug ?? productSlug(normalized)), { onConflict: 'gtin' })
    .select('id')
    .single();
  if (error) throw error;

  const trimmed = Object.fromEntries(OFF_FIELDS.filter((f) => f in remote!).map((f) => [f, remote![f]]));
  const snap = await db.from('product_snapshots').insert({ product_id: data.id, source: 'open_food_facts', payload: trimmed });
  if (snap.error) console.error('[products] snapshot failed', snap.error.message);

  const fresh = await getProductByGtin(db, gtin);
  if (!fresh) throw new ApiFailure(500, 'internal', 'Product was saved but could not be read back.');
  return { status: 'found', origin: 'open_food_facts', product: fresh };
}
