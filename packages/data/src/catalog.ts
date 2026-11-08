import type { SupabaseClient } from '@supabase/supabase-js';
import { displayENumber, type Additive, type AdditiveInfo, type CatalogProduct, type EuAdditiveStatus, type GenericFood } from '@repo/core';
import { GENERIC_FOOD_COLUMNS, PRODUCT_COLUMNS, mapGenericFoodRow, mapProductRow } from './mappers';

const ADDITIVE_INFO_COLUMNS = 'code, e_number, name_es, name_en, classes, eu_status, efsa_exposure_above_adi_groups';

/** Catalogue data for a list of additive codes, in the given order. Unknown codes stay "unknown". */
export async function getAdditiveInfo(client: SupabaseClient, codes: readonly string[]): Promise<AdditiveInfo[]> {
  if (codes.length === 0) return [];
  const { data, error } = await client.from('additives').select(ADDITIVE_INFO_COLUMNS).in('code', [...codes]);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return codes.map((code) => {
    const r = rows.find((x) => x.code === code);
    if (!r) return { code, eNumber: displayENumber(code), nameEs: null, nameEn: null, classes: [], euStatus: 'unknown', exposureConcern: false };
    return {
      code,
      eNumber: String(r.e_number),
      nameEs: (r.name_es as string | null) ?? null,
      nameEn: (r.name_en as string | null) ?? null,
      classes: (r.classes as string[] | null) ?? [],
      euStatus: (r.eu_status as EuAdditiveStatus | null) ?? 'unknown',
      exposureConcern: Array.isArray(r.efsa_exposure_above_adi_groups) && r.efsa_exposure_above_adi_groups.length > 0,
    };
  });
}

async function withAdditiveInfo(client: SupabaseClient, product: CatalogProduct | null): Promise<CatalogProduct | null> {
  if (!product) return null;
  return { ...product, additiveInfo: await getAdditiveInfo(client, product.additives) };
}

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
  return withAdditiveInfo(client, data ? mapProductRow(data as Record<string, unknown>) : null);
}

export async function getProductById(client: SupabaseClient, id: string): Promise<CatalogProduct | null> {
  const { data, error } = await client.from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return withAdditiveInfo(client, data ? mapProductRow(data as Record<string, unknown>) : null);
}

export async function getProductBySlug(client: SupabaseClient, slug: string): Promise<CatalogProduct | null> {
  const { data, error } = await client.from('products').select(PRODUCT_COLUMNS).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return withAdditiveInfo(client, data ? mapProductRow(data as Record<string, unknown>) : null);
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

/** Full additive record with its linked sources (public catalogue data). */
export async function getAdditive(client: SupabaseClient, code: string): Promise<Additive | null> {
  const { data, error } = await client
    .from('additives')
    .select('*, additive_sources(relation, scientific_sources(title, url, publisher, published_on, kind))')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const sources = ((data.additive_sources ?? []) as { relation: string; scientific_sources: Record<string, unknown> | null }[])
    .filter((s) => !!s.scientific_sources)
    .map((s) => ({
      title: String(s.scientific_sources!.title),
      url: (s.scientific_sources!.url as string | null) ?? null,
      publisher: String(s.scientific_sources!.publisher),
      publishedOn: (s.scientific_sources!.published_on as string | null) ?? null,
      kind: String(s.scientific_sources!.kind),
      relation: s.relation,
    }))
    .sort((a, b) => (b.publishedOn ?? '').localeCompare(a.publishedOn ?? ''));
  return {
    code: data.code,
    eNumber: data.e_number,
    nameEs: data.name_es,
    nameEn: data.name_en,
    classes: data.classes ?? [],
    efsa:
      data.efsa_evaluation_url || data.efsa_adi_mg_per_kg != null
        ? {
            title: data.efsa_evaluation_title,
            url: data.efsa_evaluation_url,
            date: data.efsa_evaluation_date,
            adiMgPerKgBw: data.efsa_adi_mg_per_kg == null ? null : Number(data.efsa_adi_mg_per_kg),
            exposureAboveAdiGroups: data.efsa_exposure_above_adi_groups ?? [],
          }
        : null,
    editorialNoteEs: data.editorial_note_es,
    editorialNoteEn: data.editorial_note_en,
    euStatus: data.eu_status ?? 'unknown',
    euStatusSince: data.eu_status_since,
    euStatusNoteEs: data.eu_status_note_es,
    euStatusNoteEn: data.eu_status_note_en,
    summaryEs: data.summary_es,
    summaryEn: data.summary_en,
    implicationEs: data.implication_es,
    implicationEn: data.implication_en,
    reviewStatus: data.review_status,
    reviewedAt: data.reviewed_at,
    sources,
  };
}
