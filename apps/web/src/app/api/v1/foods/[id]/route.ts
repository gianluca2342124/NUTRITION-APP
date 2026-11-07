import { getGenericFood } from '@repo/data';
import { ApiFailure, handler, json, rateLimit } from '@/server/http';
import { publicClient } from '@/server/supabase';

export const GET = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(request, 'food-read', 120);
  const { id } = await ctx.params;
  if (!/^[a-z0-9-]{2,80}$/i.test(id)) throw new ApiFailure(400, 'invalid_input', 'Invalid food id.');
  const food = await getGenericFood(publicClient(), id);
  if (!food) throw new ApiFailure(404, 'not_found', 'Food not found.');
  return json(food, { cacheSeconds: 3600 });
});
