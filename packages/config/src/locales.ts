export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

/** Maps any BCP-47 tag (es-ES, en-US, es-419…) to a supported locale. */
export function resolveLocale(tag: string | null | undefined): Locale {
  const base = (tag ?? '').toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(base ?? '') ? (base as Locale) : DEFAULT_LOCALE;
}
