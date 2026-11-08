import { handler, json, rateLimit } from '@/server/http';
import { serviceClient } from '@/server/supabase';

/**
 * Stable, cacheable URL for images of published publications, for web pages
 * and link previews. Anything else (drafts, items in review) is a 404: the
 * bucket stays private.
 */
export const GET = handler(async (request: Request, ctx: { params: Promise<{ path: string[] }> }) => {
  rateLimit(request, 'community-media', 120);
  const { path } = await ctx.params;
  const name = path.map(decodeURIComponent).join('/');
  const notFound = () => json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404 });
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i.test(name)) return notFound();

  const db = serviceClient();
  const [recipes, articles] = await Promise.all([
    db.from('community_recipes').select('id').eq('image_path', name).eq('status', 'published').limit(1),
    db.from('community_articles').select('id').eq('cover_path', name).eq('status', 'published').limit(1),
  ]);
  if (!recipes.data?.length && !articles.data?.length) return notFound();

  const { data, error } = await db.storage.from('community-media').download(name);
  if (error || !data) return notFound();
  return new Response(data, {
    headers: { 'Content-Type': data.type || 'image/jpeg', 'Cache-Control': 'public, max-age=600, s-maxage=3600' },
  });
});
