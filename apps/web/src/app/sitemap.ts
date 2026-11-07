import type { MetadataRoute } from 'next';
import { allFoodSlugs, indexableProducts } from '@/lib/data';
import { siteUrl } from '@/lib/site';

/**
 * Indexing policy: only pages with distinctive content are listed — generic
 * foods (verified nutrient data) and products with nutrition data and a name.
 * Search results and unreviewed additive records are excluded.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [foods, products] = await Promise.all([allFoodSlugs(), indexableProducts()]);
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    ...foods.map((f) => ({ url: `${base}/ingredients/${f.slug}`, lastModified: f.updatedAt, changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: 'monthly' as const, priority: 0.5 })),
  ];
}
