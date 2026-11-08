import { describe, expect, it } from 'vitest';
import { palettes, type Palette } from './tokens';

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

const SURFACES: (keyof Palette)[] = ['background', 'surface', 'surfaceMuted'];

describe.each(['light', 'dark'] as const)('%s palette contrast (WCAG AA)', (scheme) => {
  const p = palettes[scheme];
  const check = (fg: keyof Palette, bg: keyof Palette, min: number) =>
    expect(contrast(p[fg] as string, p[bg] as string), `${String(fg)} on ${String(bg)}`).toBeGreaterThanOrEqual(min);

  it('body, secondary and tertiary text on every surface ≥ 4.5', () => {
    for (const bg of SURFACES) {
      check('ink', bg, 7);
      check('textSecondary', bg, 4.5);
      check('textTertiary', bg, 4.5);
    }
    check('textSecondary', 'primarySoft', 4.5);
  });

  it('buttons, chips and notices ≥ 4.5', () => {
    check('onPrimary', 'primary', 4.5);
    check('primaryText', 'primarySoft', 4.5);
    check('secondaryText', 'secondarySoft', 4.5);
    check('errorText', 'errorSoft', 4.5);
    check('warningText', 'warningSoft', 4.5);
    check('streakText', 'streakSoft', 4.5);
    check('textInverse', 'ink', 4.5);
    check('primaryTint', 'ink', 4.5);
  });

  it('score colours: small labels ≥ 4.5, big numbers ≥ 3 on their tint', () => {
    for (const level of ['Green', 'Lime', 'Amber', 'Orange', 'Coral'] as const) {
      check(`scale${level}Text` as keyof Palette, `scale${level}Soft` as keyof Palette, 4.5);
      check(`scale${level}Strong` as keyof Palette, `scale${level}Soft` as keyof Palette, 3);
    }
  });
});
