import type { MetadataRoute } from 'next';
import { allFoodSlugs, allRecipes, indexableProducts, publishedCommunityRecipes } from '@/lib/data';
import { siteUrl } from '@/lib/site';

/**
 * Indexing policy: only pages with distinctive content are listed — generic
 * foods (verified nutrient data), products with nutrition data and a name,
 * editorial recipes, published community recipes and the score methodology.
 * Search results and unreviewed additive records are excluded.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [foods, products, recipes, community] = await Promise.all([allFoodSlugs(), indexableProducts(), allRecipes(), publishedCommunityRecipes()]);
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/recetas`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/metodologia`, changeFrequency: 'monthly', priority: 0.4 },
    ...recipes.map((r) => ({ url: `${base}/recetas/${r.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
    // Community recipes appear only once a moderator has published them.
    ...community.map((r) => ({ url: `${base}/recetas/comunidad/${r.id}`, lastModified: r.publishedAt ?? r.updatedAt, changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...foods.map((f) => ({ url: `${base}/ingredients/${f.slug}`, lastModified: f.updatedAt, changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'monthly' as const, priority: 0.5 })),
  ];
}
