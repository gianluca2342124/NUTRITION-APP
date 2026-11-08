import { CURATED_FOOD_IMAGES } from './food-images.generated';

/** Attribution data (TASL: title, author, source, licence) for a reused photo. */
export interface ImageCredit {
  title: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
  source: string;
  /** Changes made to the original (CC BY / BY-SA require saying so). */
  changes?: string;
}

/** A curated photo served by the web app at a relative path. */
export interface CuratedImage {
  /** 1:1, 512 px — thumbnails and cards. */
  square: string;
  /** 4:3, 960×720 — heroes. */
  wide: string;
  credit: ImageCredit;
}

export { CURATED_FOOD_IMAGES };

export function curatedFoodImage(slug: string | null | undefined): CuratedImage | null {
  if (!slug) return null;
  return CURATED_FOOD_IMAGES[slug] ?? null;
}

/** "Foto: Author · CC BY-SA 4.0 · Wikimedia Commons" */
export function creditLine(credit: ImageCredit, locale: 'es' | 'en' = 'es'): string {
  const photo = locale === 'en' ? 'Photo' : 'Foto';
  return `${photo}: ${credit.author} · ${credit.license} · ${credit.source}`;
}
