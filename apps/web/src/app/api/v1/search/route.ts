import { SEARCH_KINDS, type SearchHit, type SearchKind } from '@repo/core';
import type { NextRequest } from 'next/server';
import { ApiFailure, handler, json, preferredLocale, rateLimit } from '@/server/http';
import { publicClient } from '@/server/supabase';

export const GET = handler(async (request: NextRequest) => {
  rateLimit(request, 'search', 120);
  const params = request.nextUrl.searchParams;
  const q = (params.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) throw new ApiFailure(400, 'invalid_input', 'Query must have at least 2 characters.');
  const kinds = (params.get('kinds') ?? '')
    .split(',')
    .filter((k): k is SearchKind => (SEARCH_KINDS as readonly string[]).includes(k));
  const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), 50);

  const { data, error } = await publicClient().rpc('search_catalog', {
    q,
    kinds: kinds.length ? kinds : [...SEARCH_KINDS],
    lim: limit,
    lang: preferredLocale(request),
  });
  if (error) throw error;

  const hits: SearchHit[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
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
  return json({ query: q, hits }, { cacheSeconds: 60 });
});
