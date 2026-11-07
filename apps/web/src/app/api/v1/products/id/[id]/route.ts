import { getProductById } from '@repo/data';
import { ApiFailure, handler, json, rateLimit } from '@/server/http';
import { publicClient } from '@/server/supabase';

export const GET = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(request, 'product-read', 120);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiFailure(400, 'invalid_input', 'Invalid product id.');
  const product = await getProductById(publicClient(), id);
  if (!product) throw new ApiFailure(404, 'not_found', 'Product not found.');
  return json(product, { cacheSeconds: 300 });
});
