import { messages } from '@repo/i18n';

/** Public site origin (no trailing slash). Configure PUBLIC_SITE_URL in production. */
export function siteUrl(): string {
  return (process.env.PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

/** The public site is Spanish-first; English pages arrive with localised routing. */
export const LOCALE = 'es' as const;
export const t = messages(LOCALE);
