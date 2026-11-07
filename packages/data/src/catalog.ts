import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogProduct, GenericFood } from '@repo/core';
import { GENERIC_FOOD_COLUMNS, PRODUCT_COLUMNS, mapGenericFoodRow, mapProductRow } from './mappers';

export async function getGenericFood(client: SupabaseClient, idOrSlug: string): Promise<GenericFood | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const { data, error } = await client
    .from('generic_foods')
    .select(GENERIC_FOOD_COLUMNS)
    .eq(isUuid ? 'id' : 'slug', idOrSlug)
    .maybeSingle();
  if (error) throw error;
  return data ? mapGenericFoodRow(data as Record<string, unknown>) : null;
}

export async function getGenericFoodsBySlugs(client: SupabaseClient, slugs: string[]): Promise<GenericFood[]> {
  if (!slugs.length) return [];
  const { data, error } = await client.from('generic_foods').select(GENERIC_FOOD_COLUMNS).in('slug', slugs);
  if (error) throw error;
  return (data ?? []).map((r) => mapGenericFoodRow(r as Record<string, unknown>));
}

export async function getGenericFoodsByIds(client: SupabaseClient, ids: string[]): Promise<GenericFood[]> {
  if (!ids.length) return [];
  const { data, error } = await client.from('generic_foods').select(GENERIC_FOOD_COLUMNS).in('id', ids);
  if (error) throw error;
  return (data ?? []).map((r) => mapGenericFoodRow(r as Record<string, unknown>));
}

export async function getProductByGtin(client: SupabaseClient, gtin: string): Promise<CatalogProduct | null> {
  const { data, error } = await client.from('products').select(PRODUCT_COLUMNS).eq('gtin', gtin).maybeSingle();
  if (error) throw error;
  return data ? mapProductRow(data as Record<string, unknown>) : null;
}

export async function getProductById(client: SupabaseClient, id: string): Promise<CatalogProduct | null> {
  const { data, error } = await client.from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapProductRow(data as Record<string, unknown>) : null;
}

export async function getProductBySlug(client: SupabaseClient, slug: string): Promise<CatalogProduct | null> {
  const { data, error } = await client.from('products').select(PRODUCT_COLUMNS).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? mapProductRow(data as Record<string, unknown>) : null;
}

export interface CatalogIndexEntry {
  slug: string;
  nameEn: string;
}

/** Compact list of generic foods (slug + English name) used to ground AI matching. */
export async function getGenericFoodIndex(client: SupabaseClient): Promise<CatalogIndexEntry[]> {
  const { data, error } = await client.from('generic_foods').select('slug, name_en').order('slug');
  if (error) throw error;
  return (data ?? []).map((r) => ({ slug: String(r.slug), nameEn: String(r.name_en) }));
}

export async function favoriteIds(client: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await client.from('favorites').select('target_type, target_id');
  if (error) throw error;
  return new Set((data ?? []).map((r) => `${r.target_type}:${r.target_id}`));
}

export async function setFavorite(
  client: SupabaseClient,
  target: { type: 'generic_food' | 'product'; id: string },
  favorite: boolean,
): Promise<void> {
  if (favorite) {
    const { error } = await client
      .from('favorites')
      .upsert({ target_type: target.type, target_id: target.id }, { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await client.from('favorites').delete().eq('target_type', target.type).eq('target_id', target.id);
    if (error) throw error;
  }
}

export async function submitContribution(
  client: SupabaseClient,
  input: { kind: 'new_product' | 'product_correction' | 'label_scan'; gtin: string | null; productId?: string | null; payload: unknown },
): Promise<void> {
  const { error } = await client.from('contributions').insert({
    kind: input.kind,
    gtin: input.gtin,
    product_id: input.productId ?? null,
    payload: input.payload,
  });
  if (error) throw error;
}
