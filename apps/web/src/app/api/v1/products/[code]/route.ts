import { normalizeBarcode } from '@repo/core';
import { handler, json, rateLimit } from '@/server/http';
import { lookupProduct } from '@/server/products';

export const GET = handler(async (request: Request, ctx: { params: Promise<{ code: string }> }) => {
  rateLimit(request, 'product-lookup', 60);
  const { code } = await ctx.params;
  const type = new URL(request.url).searchParams.get('type') ?? undefined;
  const gtin = normalizeBarcode(decodeURIComponent(code), type);
  if (!gtin) return json({ status: 'invalid_code' });
  const result = await lookupProduct(gtin);
  return json(result, result.status === 'found' ? { cacheSeconds: 300 } : {});
});
