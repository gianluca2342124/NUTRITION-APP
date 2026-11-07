import { normalizeAdditiveCode, type Additive } from '@repo/core';
import { ApiFailure, handler, json, rateLimit } from '@/server/http';
import { publicClient } from '@/server/supabase';

export const GET = handler(async (request: Request, ctx: { params: Promise<{ code: string }> }) => {
  rateLimit(request, 'additive-read', 120);
  const { code: raw } = await ctx.params;
  const code = normalizeAdditiveCode(decodeURIComponent(raw));
  if (!code) throw new ApiFailure(400, 'invalid_input', 'Invalid E-number.');
  const { data, error } = await publicClient()
    .from('additives')
    .select('*, additive_sources(relation, scientific_sources(title, url, publisher, published_on, kind))')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiFailure(404, 'not_found', 'Additive not found.');

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

  const additive: Additive = {
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
  return json(additive, { cacheSeconds: 3600 });
});
