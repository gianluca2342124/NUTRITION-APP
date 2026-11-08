import { normalizeAdditiveCode } from '@repo/core';
import { getAdditive } from '@repo/data';
import { ApiFailure, handler, json, rateLimit } from '@/server/http';
import { publicClient } from '@/server/supabase';

export const GET = handler(async (request: Request, ctx: { params: Promise<{ code: string }> }) => {
  rateLimit(request, 'additive-read', 120);
  const { code: raw } = await ctx.params;
  const code = normalizeAdditiveCode(decodeURIComponent(raw));
  if (!code) throw new ApiFailure(400, 'invalid_input', 'Invalid E-number.');
  const additive = await getAdditive(publicClient(), code);
  if (!additive) throw new ApiFailure(404, 'not_found', 'Additive not found.');
  return json(additive, { cacheSeconds: 3600 });
});
