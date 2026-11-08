import Image from 'next/image';
import type { IllustrationKey } from '@repo/design';
import { Illustration } from './art';

/**
 * Real image first (curated licensed photo or the product's own photo), an
 * original illustration otherwise. `contain` keeps whole packs visible.
 */
export function FoodImage({
  src,
  alt,
  fallback,
  fit = 'cover',
  className = '',
  sizes = '(min-width: 1024px) 25vw, 50vw',
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  fallback: IllustrationKey;
  fit?: 'cover' | 'contain';
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) return <Illustration name={fallback} className={className} />;
  return (
    <div className={`relative overflow-hidden ${fit === 'contain' ? 'bg-white' : 'bg-surface-muted'} ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={fit === 'contain' ? 'object-contain p-4' : 'object-cover'} />
    </div>
  );
}
