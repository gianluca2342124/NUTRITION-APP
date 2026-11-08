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

  /** Brand and primary actions only. */
  primaryColor: '#295BFF',
  /** The seed of the mark; also the top of the evaluation scale. */
  secondaryColor: '#20C78A',
  backgroundColor: '#F7F9FC',
  surfaceColor: '#FFFFFF',
  textColor: '#172033',
  warningColor: '#F4B23A',
  errorColor: '#E65762',
  borderColor: '#E9EDF4',
  secondaryTextColor: '#546177',
  /**
   * Evaluation scale — reserved for scores, states and data-justified charts.
   * Never decorative.
   */
  scaleColors: {
    green: '#20C78A',
    lime: '#A4D950',
    amber: '#F4B23A',
    orange: '#F08042',
    coral: '#E65762',
  },
  /** Gradient of the mark (top-left → bottom-right). */
  markGradient: ['#4775FF', '#1F4FF0'],

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
