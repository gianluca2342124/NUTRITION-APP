import 'server-only';
import type { GenericFood } from '@repo/core';
import { getGenericFoodIndex, getGenericFoodsByIds, getGenericFoodsBySlugs, type CatalogIndexEntry } from '@repo/data';
import type { CatalogLookup } from './drafts';
import { publicClient } from './supabase';

let indexCache: { at: number; entries: CatalogIndexEntry[] } | null = null;
const INDEX_TTL_MS = 10 * 60_000;

/** Slug + English name of every generic food, used to ground AI prompts. */
export async function catalogIndex(): Promise<CatalogIndexEntry[]> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) return indexCache.entries;
  const entries = await getGenericFoodIndex(publicClient());
  indexCache = { at: Date.now(), entries };
  return entries;
}

export function supabaseCatalog(): CatalogLookup {
  const client = publicClient();
  return {
    async foodsBySlug(slugs) {
      const foods = await getGenericFoodsBySlugs(client, slugs);
      return new Map(foods.map((f) => [f.slug, f]));
    },
    async candidates(query, limit) {
      const { data, error } = await client.rpc('match_generic_foods', { q: query, lim: limit });
      if (error) throw error;
      const rows = (data ?? []) as { id: string; score: number }[];
      const foods = await getGenericFoodsByIds(
        client,
        rows.map((r) => r.id),
      );
      const byId = new Map<string, GenericFood>(foods.map((f) => [f.id, f]));
      return rows
        .map((r) => ({ food: byId.get(r.id), score: Number(r.score) }))
        .filter((r): r is { food: GenericFood; score: number } => !!r.food);
    },
  };
}
