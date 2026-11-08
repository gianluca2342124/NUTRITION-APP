import 'server-only';
import { cacheLife } from 'next/cache';
import { computeFudyuScore, scoreInputFromProduct, type Additive, type AdditiveInfo, type CatalogProduct, type FudyuScoreResult, type GenericFood, type Recipe, type SearchHit, type SearchKind } from '@repo/core';
import { getAdditive, getAdditiveInfo, getCommunityRecipe, getGenericFood, getProductBySlug, getPublicProfile, getRecipe, listPublishedRecipes, listRecipes, mapGenericFoodRow, GENERIC_FOOD_COLUMNS, type CommunityRecipe, type PublicProfile } from '@repo/data';
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
  return getAdditive(publicClient(), code);
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

export interface ScoredProduct {
  product: CatalogProduct;
  score: FudyuScoreResult;
}

/**
 * Products already in the catalogue with a photo and a computable score,
 * best first. Used to show real examples — never placeholders.
 */
export async function scoredProducts(limit = 8): Promise<ScoredProduct[]> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return [];
  const { data } = await publicClient()
    .from('products')
    .select('slug')
    .eq('nutrition_available', true)
    .not('image_url', 'is', null)
    .not('nutriscore_inputs', 'is', null)
    .not('name', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(60);
  const products = (await Promise.all((data ?? []).map((r) => getProductBySlug(publicClient(), String(r.slug))))).filter(
    (p): p is CatalogProduct => !!p,
  );
  return products
    .map((product) => ({ product, score: computeFudyuScore(scoreInputFromProduct(product)) }))
    .filter((x) => x.score.status === 'scored')
    .sort((a, b) => (b.score.status === 'scored' ? b.score.score : 0) - (a.score.status === 'scored' ? a.score.score : 0))
    .slice(0, limit);
}

export async function additiveCards(codes: readonly string[]): Promise<AdditiveInfo[]> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return [];
  try {
    return (await getAdditiveInfo(publicClient(), codes)).filter((a) => a.nameEs || a.nameEn);
  } catch {
    return [];
  }
}

export async function allRecipes(): Promise<Recipe[]> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return [];
  try {
    return await listRecipes(publicClient());
  } catch {
    return [];
  }
}

export async function recipeBySlug(slug: string): Promise<Recipe | null> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return null;
  return getRecipe(publicClient(), slug);
}

/* ------------------------------------------------- community (published only) */

export async function publishedCommunityRecipes(): Promise<CommunityRecipe[]> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return [];
  try {
    return await listPublishedRecipes(publicClient());
  } catch {
    return [];
  }
}

/** A published community recipe (anonymous reads only ever see published rows). */
export async function communityRecipeById(id: string): Promise<CommunityRecipe | null> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await getCommunityRecipe(publicClient(), id);
  return r?.status === 'published' ? r : null;
}

/** The author's public profile, or null when it is private. */
export async function publicAuthor(userId: string): Promise<PublicProfile | null> {
  'use cache';
  cacheLife('hours');
  if (!supabaseConfigured()) return null;
  try {
    return await getPublicProfile(publicClient(), userId);
  } catch {
    return null;
  }
}
