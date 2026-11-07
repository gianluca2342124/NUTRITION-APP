import { brand } from '@repo/config/brand';

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  /** Primary used as text/link colour (contrast-checked against background). */
  primaryText: string;
  onPrimary: string;
  secondary: string;
  secondarySoft: string;
  /** Darker green for text — the brand green is for fills and indicators only. */
  secondaryText: string;
  ink: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  scrim: string;
  warning: string;
  warningSoft: string;
  warningText: string;
  error: string;
  errorSoft: string;
  errorText: string;
  energy: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  glassFallback: string;
  glassBorder: string;
  shadow: string;
}

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    primary: brand.primaryColor,
    primaryPressed: '#1B4AD6',
    primarySoft: '#EAF0FF',
    primaryText: '#1F52E6',
    onPrimary: '#FFFFFF',
    secondary: brand.secondaryColor,
    secondarySoft: '#E2F8F0',
    secondaryText: '#0B7F5C',
    ink: brand.textColor,
    textSecondary: brand.secondaryTextColor,
    textTertiary: '#8E9AAE',
    textInverse: '#FFFFFF',
    background: brand.backgroundColor,
    surface: brand.surfaceColor,
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F0F3F8',
    border: brand.borderColor,
    borderStrong: '#D5DCE7',
    scrim: 'rgba(12, 18, 34, 0.42)',
    warning: brand.warningColor,
    warningSoft: '#FEF3E0',
    warningText: '#9A5B00',
    error: brand.errorColor,
    errorSoft: '#FCE9ED',
    errorText: '#B8304A',
    energy: brand.primaryColor,
    protein: '#7A5AF8',
    carbs: '#12A8C4',
    fat: '#FF7A59',
    fiber: brand.secondaryColor,
    glassFallback: 'rgba(255, 255, 255, 0.86)',
    glassBorder: 'rgba(255, 255, 255, 0.9)',
    shadow: '#172033',
  },
  dark: {
    primary: '#3F6BFF',
    primaryPressed: '#3259E0',
    primarySoft: '#18244A',
    primaryText: '#7C9DFF',
    onPrimary: '#FFFFFF',
    secondary: '#21D3A0',
    secondarySoft: '#0F2E28',
    secondaryText: '#4FE0B6',
    ink: '#EEF2F8',
    textSecondary: '#A1ACC0',
    textTertiary: '#6F7B92',
    textInverse: '#0A0F1E',
    background: '#0A0F1E',
    surface: '#131A2B',
    surfaceElevated: '#1A2236',
    surfaceMuted: '#1E2740',
    border: '#252F47',
    borderStrong: '#34405C',
    scrim: 'rgba(0, 0, 0, 0.6)',
    warning: '#F7B442',
    warningSoft: '#332611',
    warningText: '#F7C66E',
    error: '#F06A7E',
    errorSoft: '#3A1820',
    errorText: '#FF95A5',
    energy: '#5A86FF',
    protein: '#9B85FF',
    carbs: '#3CC7DE',
    fat: '#FF9478',
    fiber: '#21D3A0',
    glassFallback: 'rgba(26, 34, 54, 0.88)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    shadow: '#000000',
  },
};

/** 4/8-based spacing scale (px / dp). */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

/** Type scale in points. Mobile uses the system font so Dynamic Type applies. */
export const typography = {
  display: { fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1.2 },
  largeTitle: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  section: { fontSize: 21, lineHeight: 27, fontWeight: '700', letterSpacing: -0.3 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400', letterSpacing: -0.1 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.1 },
  secondary: { fontSize: 14, lineHeight: 19, fontWeight: '400', letterSpacing: 0 },
  secondaryStrong: { fontSize: 14, lineHeight: 19, fontWeight: '600', letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '500', letterSpacing: 0 },
} as const;

export type TypeVariant = keyof typeof typography;

export const motion = {
  fast: 180,
  base: 240,
  slow: 300,
  spring: { damping: 18, stiffness: 220, mass: 1 },
} as const;

export const elevation = {
  card: { opacity: 0.06, radius: 20, offsetY: 6 },
  floating: { opacity: 0.12, radius: 28, offsetY: 10 },
} as const;

/** Minimum touch target (Apple HIG: 44pt). */
export const hitTarget = 44;

const CSS_VAR_PREFIX = '--fy-';

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Serialises a palette into CSS custom properties (used by the web app). */
export function paletteToCssVars(p: Palette): string {
  return Object.entries(p)
    .map(([k, v]) => `${CSS_VAR_PREFIX}${kebab(k)}:${v};`)
    .join('');
}

/** Full stylesheet with light defaults, dark media query and explicit overrides. */
export function themeStylesheet(): string {
  const light = paletteToCssVars(palettes.light);
  const dark = paletteToCssVars(palettes.dark);
  return [
    `:root{${light}color-scheme:light;}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}color-scheme:dark;}}`,
    `:root[data-theme="dark"]{${dark}color-scheme:dark;}`,
  ].join('\n');
}
