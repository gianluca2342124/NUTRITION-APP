import 'server-only';
import { cacheLife } from 'next/cache';
import type { Additive, CatalogProduct, GenericFood, SearchHit, SearchKind } from '@repo/core';
import { getGenericFood, getProductBySlug, mapGenericFoodRow, GENERIC_FOOD_COLUMNS } from '@repo/data';
import { supabaseConfigured } from '@/server/env';
import { publicClient } from '@/server/supabase';

/**
 * Cached reads for public pages (Cache Components). Every function returns
 * null/[] when the database is not configured so pages can render an honest
 * "service not available" state instead of failing.
 */

export async function foodBySlug(slug: string): Promise<GenericFood | null> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return null;
  return getGenericFood(publicClient(), slug);
}

export async function popularFoods(slugs: readonly string[]): Promise<GenericFood[]> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return [];
  const { data, error } = await publicClient().from('generic_foods').select(GENERIC_FOOD_COLUMNS).in('slug', [...slugs]);
  if (error) return [];
  const foods = (data ?? []).map((r) => mapGenericFoodRow(r as Record<string, unknown>));
  return slugs.map((s) => foods.find((f) => f.slug === s)).filter((f): f is GenericFood => !!f);
}

export async function allFoodSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return [];
  const { data } = await publicClient().from('generic_foods').select('slug, updated_at').order('slug');
  return (data ?? []).map((r) => ({ slug: String(r.slug), updatedAt: String(r.updated_at) }));
}

export async function productBySlug(slug: string): Promise<CatalogProduct | null> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return null;
  return getProductBySlug(publicClient(), slug);
}

export async function indexableProducts(): Promise<{ slug: string; updatedAt: string }[]> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return [];
  const { data } = await publicClient()
    .from('products')
    .select('slug, updated_at')
    .eq('nutrition_available', true)
    .not('name', 'is', null)
    .limit(5000);
  return (data ?? []).map((r) => ({ slug: String(r.slug), updatedAt: String(r.updated_at) }));
}

export async function additiveByCode(code: string): Promise<Additive | null> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return null;
  const { data } = await publicClient()
    .from('additives')
    .select('*, additive_sources(relation, scientific_sources(title, url, publisher, published_on, kind))')
    .eq('code', code)
    .maybeSingle();
  if (!data) return null;
  const sources = ((data.additive_sources ?? []) as { scientific_sources: Record<string, unknown> | null }[])
    .map((s) => s.scientific_sources)
    .filter((s): s is Record<string, unknown> => !!s)
    .map((s) => ({
      title: String(s.title),
      url: (s.url as string | null) ?? null,
      publisher: String(s.publisher),
      publishedOn: (s.published_on as string | null) ?? null,
      kind: String(s.kind),
    }));
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
    reviewStatus: data.review_status,
    reviewedAt: data.reviewed_at,
    sources,
  };
}

export async function searchCatalog(q: string, kinds?: SearchKind[]): Promise<SearchHit[]> {
  'use cache';
  cacheLife('minutes');
  if (!supabaseConfigured() || q.trim().length < 2) return [];
  const { data, error } = await publicClient().rpc('search_catalog', {
    q: q.trim().slice(0, 80),
    kinds: kinds?.length ? kinds : ['generic_food', 'product', 'additive'],
    lim: 40,
    lang: 'es',
  });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    kind: r.kind as SearchKind,
    id: String(r.id),
    slug: (r.slug as string | null) ?? null,
    title: String(r.title),
    subtitle: (r.subtitle as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
    energyKcalPer100: r.energy_kcal == null ? null : Number(r.energy_kcal),
    basis: r.basis === '100ml' ? '100ml' : r.basis === '100g' ? '100g' : null,
    score: Number(r.score),
  }));
}
