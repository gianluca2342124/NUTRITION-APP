/**
 * Single source of truth for brand identity.
 *
 * The product name, taglines, colours and identifiers are provisional. Change them
 * here (and only here) to rebrand. Nothing in this file assumes that the domain,
 * store listings or trademarks are registered or available.
 */
export const brand = {
  brandName: 'Fudyu',
  brandSlug: 'fudyu',
  /** Lower-case wordmark used by the logo lockup. */
  wordmark: 'fudyu',
  taglineEn: 'Know your food.',
  taglineEs: 'Entiende lo que comes.',
  positioningEn: 'Your personal food intelligence platform.',
  positioningEs: 'Tu plataforma personal de inteligencia alimentaria.',

  primaryColor: '#245CFF',
  secondaryColor: '#17C995',
  backgroundColor: '#F7F9FC',
  surfaceColor: '#FFFFFF',
  textColor: '#172033',
  warningColor: '#F5A524',
  errorColor: '#E45065',
  borderColor: '#E9EDF4',
  secondaryTextColor: '#66758B',

  /**
   * Provisional defaults. Real values come from environment variables
   * (see .env.example): PUBLIC_SITE_URL, APP_IOS_BUNDLE_ID, APP_ANDROID_PACKAGE.
   */
  provisionalDomain: 'fudyu.com',
  appScheme: 'fudyu',
  defaultIosBundleId: 'com.example.fudyu',
  defaultAndroidPackage: 'com.example.fudyu',
} as const;

export type Brand = typeof brand;

export function tagline(locale: string): string {
  return locale.toLowerCase().startsWith('es') ? brand.taglineEs : brand.taglineEn;
}
