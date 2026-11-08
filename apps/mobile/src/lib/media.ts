import { useQuery } from '@tanstack/react-query';
import { curatedFoodImage, type CuratedImage, type DiaryEntry, type DiaryItem } from '@repo/data';
import type { IllustrationKey } from '@repo/design';
import { env } from './env';
import { supabase } from './supabase';

/** Absolute URL of a curated image served by the web app. */
export function curatedUri(image: CuratedImage | null, variant: 'square' | 'wide' = 'square'): string | null {
  if (!image || !env.apiUrl) return null;
  return `${env.apiUrl}${image[variant]}`;
}

export function foodImageUri(slug: string | null | undefined, variant: 'square' | 'wide' = 'square'): string | null {
  return curatedUri(curatedFoodImage(slug), variant);
}

const CATEGORY_ART = new Set<IllustrationKey>([
  'fruits', 'vegetables', 'legumes', 'grains', 'dairy', 'eggs', 'meat', 'fish_seafood',
  'fats_oils', 'nuts_seeds', 'sweets_snacks', 'beverages', 'condiments', 'prepared', 'other',
]);

export function categoryArt(category: string | null | undefined): IllustrationKey {
  return category && CATEGORY_ART.has(category as IllustrationKey) ? (category as IllustrationKey) : 'other';
}

/** Best real image for a diary item: product photo, then curated food photo. */
export function itemImageUri(item: DiaryItem): string | null {
  return item.productImageUrl ?? foodImageUri(item.foodSlug);
}

/**
 * Short-lived signed URL for the user's own meal photo (private bucket,
 * owner-only RLS). Cached for less than the URL lifetime.
 */
export function useMealPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ['meal-photo', path],
    enabled: !!path,
    staleTime: 45 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase().storage.from('meal-photos').createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** What to show for a logged meal: the user's photo first, never substituted. */
export function entryImage(entry: DiaryEntry): { photoPath: string | null; uri: string | null; art: IllustrationKey } {
  const first = entry.items[0];
  const fromItems = entry.items.map(itemImageUri).find((u): u is string => !!u) ?? null;
  return { photoPath: entry.photoPath, uri: fromItems, art: first ? categoryArt(first.foodCategory) : 'other' };
}
