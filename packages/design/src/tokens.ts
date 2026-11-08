import { brand } from '@repo/config/brand';

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  /** Slightly stronger tint for selected states on soft surfaces. */
  primaryTint: string;
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
  /* Evaluation scale: fill (rings, bars), soft surface, contrast-checked text. */
  scaleGreen: string;
  scaleGreenSoft: string;
  scaleGreenText: string;
  scaleLime: string;
  scaleLimeSoft: string;
  scaleLimeText: string;
  scaleAmber: string;
  scaleAmberSoft: string;
  scaleAmberText: string;
  scaleOrange: string;
  scaleOrangeSoft: string;
  scaleOrangeText: string;
  scaleCoral: string;
  scaleCoralSoft: string;
  scaleCoralText: string;
  /** Streak flame (warm, friendly — not an alarm). */
  streak: string;
  streakSoft: string;
  streakText: string;
  energy: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  glassFallback: string;
  glassBorder: string;
  shadow: string;
}

const scale = brand.scaleColors;

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    primary: brand.primaryColor,
    primaryPressed: '#1E49D9',
    primarySoft: '#EEF2FF',
    primaryTint: '#DDE6FF',
    primaryText: '#1F4FE8',
    onPrimary: '#FFFFFF',
    secondary: brand.secondaryColor,
    secondarySoft: '#E6F8F1',
    secondaryText: '#0B7A55',
    ink: brand.textColor,
    textSecondary: brand.secondaryTextColor,
    textTertiary: '#8E9AAE',
    textInverse: '#FFFFFF',
    background: brand.backgroundColor,
    surface: brand.surfaceColor,
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F1F4F9',
    border: brand.borderColor,
    borderStrong: '#D5DCE7',
    scrim: 'rgba(12, 18, 34, 0.40)',
    warning: brand.warningColor,
    warningSoft: '#FEF5E2',
    warningText: '#8A5A00',
    error: brand.errorColor,
    errorSoft: '#FCEBED',
    errorText: '#B42E3B',
    scaleGreen: scale.green,
    scaleGreenSoft: '#E6F8F1',
    scaleGreenText: '#0B7A55',
    scaleLime: scale.lime,
    scaleLimeSoft: '#F2F9E4',
    scaleLimeText: '#4E7A12',
    scaleAmber: scale.amber,
    scaleAmberSoft: '#FEF5E2',
    scaleAmberText: '#8A5A00',
    scaleOrange: scale.orange,
    scaleOrangeSoft: '#FDEEE5',
    scaleOrangeText: '#A4461A',
    scaleCoral: scale.coral,
    scaleCoralSoft: '#FCEBED',
    scaleCoralText: '#B42E3B',
    streak: scale.orange,
    streakSoft: '#FFF1E8',
    streakText: '#A4461A',
    energy: brand.primaryColor,
    protein: '#7A5AF8',
    carbs: '#1DA8D8',
    fat: '#C77DDB',
    fiber: brand.secondaryColor,
    glassFallback: 'rgba(255, 255, 255, 0.86)',
    glassBorder: 'rgba(255, 255, 255, 0.9)',
    shadow: '#172033',
  },
  dark: {
    primary: '#4673FF',
    primaryPressed: '#3A63E6',
    primarySoft: '#17234A',
    primaryTint: '#22336A',
    primaryText: '#8AA8FF',
    onPrimary: '#FFFFFF',
    secondary: '#2BD69A',
    secondarySoft: '#0E2E24',
    secondaryText: '#5BE3B2',
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
    warning: '#F7C057',
    warningSoft: '#33260F',
    warningText: '#F9CF7A',
    error: '#F0707A',
    errorSoft: '#3A1820',
    errorText: '#FF98A0',
    scaleGreen: '#2BD69A',
    scaleGreenSoft: '#0E2E24',
    scaleGreenText: '#5BE3B2',
    scaleLime: '#B4E266',
    scaleLimeSoft: '#232E12',
    scaleLimeText: '#C5EA88',
    scaleAmber: '#F7C057',
    scaleAmberSoft: '#33260F',
    scaleAmberText: '#F9CF7A',
    scaleOrange: '#F59362',
    scaleOrangeSoft: '#3A2112',
    scaleOrangeText: '#F8AE88',
    scaleCoral: '#F0707A',
    scaleCoralSoft: '#3A1820',
    scaleCoralText: '#FF98A0',
    streak: '#F59362',
    streakSoft: '#3A2112',
    streakText: '#F8AE88',
    energy: '#5A86FF',
    protein: '#9B85FF',
    carbs: '#4CC3EA',
    fat: '#D99BE8',
    fiber: '#2BD69A',
    glassFallback: 'rgba(26, 34, 54, 0.88)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    shadow: '#000000',
  },
};

/** Evaluation level keys (mirrors SCORE_LEVELS in @repo/core). */
export type ScaleLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'limit';

/** Fill / soft surface / text colours for an evaluation level. */
export function scaleTone(p: Palette, level: ScaleLevel): { fill: string; soft: string; text: string } {
  switch (level) {
    case 'excellent':
      return { fill: p.scaleGreen, soft: p.scaleGreenSoft, text: p.scaleGreenText };
    case 'good':
      return { fill: p.scaleLime, soft: p.scaleLimeSoft, text: p.scaleLimeText };
    case 'fair':
      return { fill: p.scaleAmber, soft: p.scaleAmberSoft, text: p.scaleAmberText };
    case 'poor':
      return { fill: p.scaleOrange, soft: p.scaleOrangeSoft, text: p.scaleOrangeText };
    case 'limit':
      return { fill: p.scaleCoral, soft: p.scaleCoralSoft, text: p.scaleCoralText };
  }
}

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
  md: 18,
  lg: 24,
  xl: 32,
  xxl: 40,
  pill: 999,
} as const;

/** Type scale in points. Mobile uses the system font so Dynamic Type applies. */
export const typography = {
  hero: { fontSize: 56, lineHeight: 60, fontWeight: '800', letterSpacing: -2 },
  display: { fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1.2 },
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
  section: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400', letterSpacing: -0.1 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.1 },
  secondary: { fontSize: 14, lineHeight: 19, fontWeight: '400', letterSpacing: 0 },
  secondaryStrong: { fontSize: 14, lineHeight: 19, fontWeight: '600', letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '500', letterSpacing: 0 },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.2 },
} as const;

export type TypeVariant = keyof typeof typography;

export const motion = {
  fast: 160,
  base: 240,
  slow: 320,
  /** Count-up of numbers that matter (score, calories). */
  reveal: 700,
  /** Delay between cards appearing in reading order. */
  stagger: 45,
  spring: { damping: 18, stiffness: 220, mass: 1 },
  /** Softer spring for celebrations and sheets. */
  gentle: { damping: 16, stiffness: 140, mass: 1 },
} as const;

export const elevation = {
  card: { opacity: 0.05, radius: 24, offsetY: 8 },
  floating: { opacity: 0.12, radius: 32, offsetY: 12 },
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
