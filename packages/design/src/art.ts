/**
 * Original vector art shared by the mobile and web renderers: the brand mark,
 * the Fudyu character (five expressions), fallback food illustrations and
 * achievement badges. Geometry only — each platform maps tones to colours.
 */

export type ArtTone =
  /** Character / mark body (rendered as the brand gradient). */
  | 'body'
  /** Features drawn on the body (eyes, smile). */
  | 'face'
  | 'seed'
  | 'lime'
  | 'amber'
  | 'primary'
  | 'primaryDeep'
  | 'tint'
  | 'tintStrong'
  | 'white';

interface ShapeBase {
  fill?: ArtTone;
  stroke?: ArtTone;
  /** Stroke width (round caps and joins). */
  sw?: number;
  opacity?: number;
}

export type ArtShape =
  | (ShapeBase & { t: 'circle'; cx: number; cy: number; r: number })
  | (ShapeBase & { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotate?: number })
  | (ShapeBase & { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number })
  | (ShapeBase & { t: 'path'; d: string });

/* -------------------------------- brand mark ------------------------------- */

export const MARK_VIEWBOX = 1024;
export const MARK_RADIUS = 236;
export const MARK_BOWL = 'M286 488 A226 226 0 0 0 738 488';
export const MARK_BOWL_WIDTH = 100;
export const MARK_SEED = { cx: 610, cy: 326, r: 78 } as const;

/* --------------------------------- character ------------------------------- */

export type CharacterExpression = 'smile' | 'curious' | 'celebrate' | 'attention' | 'thinking';
export const CHARACTER_EXPRESSIONS: readonly CharacterExpression[] = ['smile', 'curious', 'celebrate', 'attention', 'thinking'];
export const CHARACTER_VIEWBOX = 120;

const body: ArtShape[] = [
  { t: 'rect', x: 10, y: 12, w: 100, h: 100, rx: 34, fill: 'body' },
  { t: 'ellipse', cx: 40, cy: 30, rx: 20, ry: 8, rotate: -18, fill: 'white', opacity: 0.16 },
];

const smileMouth: ArtShape = { t: 'path', d: 'M40 72 A20 20 0 0 0 80 72', stroke: 'face', sw: 9 };

const EXPRESSIONS: Record<CharacterExpression, ArtShape[]> = {
  smile: [
    { t: 'ellipse', cx: 45, cy: 54, rx: 6, ry: 7.5, fill: 'face' },
    { t: 'ellipse', cx: 75, cy: 54, rx: 6, ry: 7.5, fill: 'face' },
    smileMouth,
    { t: 'circle', cx: 87, cy: 33, r: 7, fill: 'seed' },
  ],
  curious: [
    { t: 'ellipse', cx: 45, cy: 56, rx: 5.5, ry: 7, fill: 'face' },
    { t: 'ellipse', cx: 76, cy: 53, rx: 7, ry: 9, fill: 'face' },
    { t: 'path', d: 'M68 39 Q76 33.5 84 37.5', stroke: 'face', sw: 4.5 },
    { t: 'path', d: 'M50 79 Q60 85 72 77', stroke: 'face', sw: 7.5 },
    { t: 'circle', cx: 93, cy: 26, r: 6.5, fill: 'seed' },
  ],
  celebrate: [
    { t: 'path', d: 'M38 57 Q45 47 52 57', stroke: 'face', sw: 5.5 },
    { t: 'path', d: 'M68 57 Q75 47 82 57', stroke: 'face', sw: 5.5 },
    { t: 'path', d: 'M39 69 L81 69 A21 21 0 0 1 39 69 Z', fill: 'face' },
    { t: 'circle', cx: 88, cy: 27, r: 6.5, fill: 'seed' },
    { t: 'circle', cx: 104, cy: 10, r: 4, fill: 'lime' },
    { t: 'circle', cx: 14, cy: 20, r: 3.5, fill: 'amber' },
    { t: 'path', d: 'M110 48 l2 4.6 4.6 2 -4.6 2 -2 4.6 -2 -4.6 -4.6 -2 4.6 -2z', fill: 'lime' },
    { t: 'circle', cx: 7, cy: 74, r: 3, fill: 'seed' },
    { t: 'path', d: 'M22 6 l1.5 3.4 3.4 1.5 -3.4 1.5 -1.5 3.4 -1.5 -3.4 -3.4 -1.5 3.4 -1.5z', fill: 'amber' },
  ],
  attention: [
    { t: 'circle', cx: 45, cy: 55, r: 7, fill: 'face' },
    { t: 'circle', cx: 75, cy: 55, r: 7, fill: 'face' },
    { t: 'path', d: 'M37 41 L52 43', stroke: 'face', sw: 4.5 },
    { t: 'path', d: 'M68 43 L83 41', stroke: 'face', sw: 4.5 },
    { t: 'path', d: 'M51 80 L69 80', stroke: 'face', sw: 7.5 },
    { t: 'circle', cx: 88, cy: 31, r: 7, fill: 'amber' },
  ],
  thinking: [
    { t: 'ellipse', cx: 48, cy: 51, rx: 5.5, ry: 7, fill: 'face' },
    { t: 'ellipse', cx: 78, cy: 51, rx: 5.5, ry: 7, fill: 'face' },
    { t: 'path', d: 'M50 80 Q59 84 70 76', stroke: 'face', sw: 7.5 },
    { t: 'circle', cx: 92, cy: 35, r: 3.2, fill: 'seed' },
    { t: 'circle', cx: 100, cy: 23, r: 4.6, fill: 'seed' },
    { t: 'circle', cx: 108, cy: 9, r: 6, fill: 'seed' },
  ],
};

export function characterShapes(expression: CharacterExpression): ArtShape[] {
  return [...body, ...EXPRESSIONS[expression]];
}

/* --------------------------- fallback illustrations ------------------------ */

export const ILLUSTRATION_VIEWBOX = 96;

export type IllustrationKey =
  | 'fruits'
  | 'vegetables'
  | 'legumes'
  | 'grains'
  | 'dairy'
  | 'eggs'
  | 'meat'
  | 'fish_seafood'
  | 'fats_oils'
  | 'nuts_seeds'
  | 'sweets_snacks'
  | 'beverages'
  | 'condiments'
  | 'prepared'
  | 'other'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'product'
  | 'recipe';

const apple: ArtShape[] = [
  { t: 'path', d: 'M48 31 C36 22 19 30 21 51 C23 71 37 82 48 77 C59 82 73 71 75 51 C77 30 60 22 48 31 Z', fill: 'primary' },
  { t: 'path', d: 'M48 32 C48 25 46 20 43 16', stroke: 'primaryDeep', sw: 3.5 },
  { t: 'path', d: 'M50 28 C52 18 60 13 69 15 C67 24 59 30 50 28 Z', fill: 'seed' },
  { t: 'ellipse', cx: 34, cy: 47, rx: 4.5, ry: 9, rotate: 12, fill: 'white', opacity: 0.35 },
];

const bowl = (withLeaf: boolean): ArtShape[] => [
  { t: 'path', d: 'M40 24 C36 19 44 16 40 10', stroke: 'tintStrong', sw: 3.5 },
  { t: 'path', d: 'M54 24 C50 19 58 16 54 10', stroke: 'tintStrong', sw: 3.5 },
  { t: 'ellipse', cx: 48, cy: 46, rx: 28, ry: 9, fill: 'tintStrong' },
  ...(withLeaf ? ([{ t: 'path', d: 'M50 44 C54 35 63 33 70 36 C66 43 58 46 50 44 Z', fill: 'seed' }] as ArtShape[]) : []),
  { t: 'path', d: 'M16 48 L80 48 C80 68 66 82 48 82 C30 82 16 68 16 48 Z', fill: 'primary' },
  { t: 'path', d: 'M26 56 C29 66 36 72 44 74', stroke: 'white', sw: 3, opacity: 0.35 },
];

const ILLUSTRATIONS: Record<IllustrationKey, ArtShape[]> = {
  fruits: apple,
  snack: apple,
  vegetables: [
    { t: 'path', d: 'M26 76 C38 62 51 46 59 36 C63 31 70 35 67 40 C61 51 46 65 26 76 Z', fill: 'primary' },
    { t: 'path', d: 'M61 34 C59 24 63 17 70 14 C71 22 68 29 64 33 Z', fill: 'seed' },
    { t: 'path', d: 'M66 37 C73 30 80 29 85 31 C81 37 75 40 67 39 Z', fill: 'seed' },
    { t: 'path', d: 'M43 58 L49 60', stroke: 'white', sw: 2.5, opacity: 0.5 },
    { t: 'path', d: 'M51 48 L56 50', stroke: 'white', sw: 2.5, opacity: 0.5 },
    { t: 'path', d: 'M35 67 L40 69', stroke: 'white', sw: 2.5, opacity: 0.5 },
  ],
  legumes: [
    { t: 'ellipse', cx: 33, cy: 54, rx: 11, ry: 15, rotate: -24, fill: 'primary' },
    { t: 'ellipse', cx: 53, cy: 43, rx: 11, ry: 15, rotate: 12, fill: 'primaryDeep' },
    { t: 'ellipse', cx: 62, cy: 65, rx: 11, ry: 15, rotate: 40, fill: 'primary' },
    { t: 'path', d: 'M28 47 C27 52 28 57 31 61', stroke: 'white', sw: 2.5, opacity: 0.4 },
    { t: 'path', d: 'M49 36 C48 41 49 46 52 50', stroke: 'white', sw: 2.5, opacity: 0.4 },
    { t: 'path', d: 'M58 59 C58 64 60 68 64 71', stroke: 'white', sw: 2.5, opacity: 0.4 },
  ],
  grains: [
    { t: 'path', d: 'M48 84 L48 26', stroke: 'primaryDeep', sw: 3.5 },
    { t: 'ellipse', cx: 48, cy: 20, rx: 5.5, ry: 9, fill: 'primary' },
    { t: 'ellipse', cx: 40, cy: 34, rx: 5.5, ry: 10, rotate: -32, fill: 'primary' },
    { t: 'ellipse', cx: 56, cy: 34, rx: 5.5, ry: 10, rotate: 32, fill: 'primary' },
    { t: 'ellipse', cx: 40, cy: 49, rx: 5.5, ry: 10, rotate: -32, fill: 'primary' },
    { t: 'ellipse', cx: 56, cy: 49, rx: 5.5, ry: 10, rotate: 32, fill: 'primary' },
    { t: 'ellipse', cx: 40, cy: 64, rx: 5.5, ry: 10, rotate: -32, fill: 'primary' },
    { t: 'ellipse', cx: 56, cy: 64, rx: 5.5, ry: 10, rotate: 32, fill: 'primary' },
    { t: 'path', d: 'M58 78 C62 70 70 68 76 70 C72 76 65 79 58 78 Z', fill: 'seed' },
  ],
  dairy: [
    { t: 'rect', x: 37, y: 14, w: 22, h: 9, rx: 3, fill: 'primaryDeep' },
    { t: 'path', d: 'M38 23 L58 23 L58 30 L65 42 L65 77 C65 81 62 84 58 84 L38 84 C34 84 31 81 31 77 L31 42 L38 30 Z', fill: 'white', stroke: 'primary', sw: 4 },
    { t: 'rect', x: 31, y: 52, w: 34, h: 16, fill: 'primary' },
    { t: 'circle', cx: 48, cy: 60, r: 4, fill: 'white', opacity: 0.85 },
  ],
  eggs: [
    { t: 'path', d: 'M44 18 C57 18 67 39 67 54 C67 69 57 80 44 80 C31 80 21 69 21 54 C21 39 31 18 44 18 Z', fill: 'white', stroke: 'primary', sw: 4 },
    { t: 'path', d: 'M62 34 C72 34 80 50 80 61 C80 72 72 81 62 81 C59 81 56 80 54 79', stroke: 'tintStrong', sw: 4 },
    { t: 'ellipse', cx: 35, cy: 42, rx: 4, ry: 8, rotate: 16, fill: 'tintStrong' },
  ],
  meat: [
    { t: 'path', d: 'M58 22 C71 22 80 33 78 46 C76 57 65 62 56 58 L43 71 C45 76 41 82 35 79 C30 81 26 75 30 71 C25 68 30 61 35 64 L49 51 C45 40 47 22 58 22 Z', fill: 'primary' },
    { t: 'circle', cx: 33.5, cy: 75.5, r: 5, fill: 'white' },
    { t: 'circle', cx: 29, cy: 69, r: 4, fill: 'white' },
    { t: 'path', d: 'M58 30 C66 30 71 36 70 43', stroke: 'white', sw: 3, opacity: 0.35 },
  ],
  fish_seafood: [
    { t: 'path', d: 'M18 50 C31 33 56 31 70 48 C56 66 31 66 18 50 Z', fill: 'primary' },
    { t: 'path', d: 'M68 48 L84 36 L81 49 L84 62 Z', fill: 'primaryDeep' },
    { t: 'path', d: 'M40 38 C44 31 52 30 56 34', stroke: 'primaryDeep', sw: 3.5 },
    { t: 'circle', cx: 31, cy: 47, r: 3.2, fill: 'white' },
    { t: 'path', d: 'M43 55 C49 58 55 58 60 55', stroke: 'white', sw: 2.5, opacity: 0.45 },
  ],
  fats_oils: [
    { t: 'path', d: 'M46 14 C56 30 67 43 67 57 C67 70 57 79 46 79 C35 79 25 70 25 57 C25 43 36 30 46 14 Z', fill: 'primary' },
    { t: 'path', d: 'M34 56 C34 63 38 68 44 70', stroke: 'white', sw: 3, opacity: 0.4 },
    { t: 'ellipse', cx: 68, cy: 72, rx: 8, ry: 10, rotate: 30, fill: 'seed' },
    { t: 'path', d: 'M72 62 C75 56 80 54 85 55', stroke: 'primaryDeep', sw: 3 },
  ],
  nuts_seeds: [
    { t: 'path', d: 'M48 14 C64 25 71 46 65 65 C61 76 55 82 48 82 C41 82 35 76 31 65 C25 46 32 25 48 14 Z', fill: 'primary' },
    { t: 'path', d: 'M48 22 C47 40 47 58 48 76', stroke: 'primaryDeep', sw: 2.5, opacity: 0.6 },
    { t: 'path', d: 'M40 36 C38 46 38 56 41 66', stroke: 'white', sw: 2.5, opacity: 0.35 },
  ],
  sweets_snacks: [
    { t: 'circle', cx: 48, cy: 50, r: 28, fill: 'tintStrong', stroke: 'primary', sw: 4 },
    { t: 'circle', cx: 38, cy: 40, r: 4, fill: 'primary' },
    { t: 'circle', cx: 56, cy: 37, r: 3.5, fill: 'primary' },
    { t: 'circle', cx: 60, cy: 55, r: 4, fill: 'primary' },
    { t: 'circle', cx: 42, cy: 60, r: 3.5, fill: 'primary' },
    { t: 'circle', cx: 50, cy: 49, r: 2.5, fill: 'primaryDeep' },
  ],
  beverages: [
    { t: 'path', d: 'M56 10 L49 46', stroke: 'seed', sw: 4 },
    { t: 'path', d: 'M28 22 L68 22 L62 79 C62 82 60 84 57 84 L39 84 C36 84 34 82 34 79 Z', fill: 'white', stroke: 'primary', sw: 4 },
    { t: 'path', d: 'M31.6 44 L64.4 44 L60.6 79 C60.4 81 59 82 57 82 L39 82 C37 82 35.6 81 35.4 79 Z', fill: 'primary' },
    { t: 'path', d: 'M40 52 L41.5 72', stroke: 'white', sw: 2.5, opacity: 0.4 },
  ],
  condiments: [
    { t: 'rect', x: 28, y: 18, w: 40, h: 13, rx: 5, fill: 'primaryDeep' },
    { t: 'rect', x: 30, y: 30, w: 36, h: 52, rx: 9, fill: 'white', stroke: 'primary', sw: 4 },
    { t: 'rect', x: 36, y: 46, w: 24, h: 18, rx: 4, fill: 'primary' },
    { t: 'path', d: 'M42 55 L54 55', stroke: 'white', sw: 2.5, opacity: 0.7 },
  ],
  prepared: bowl(true),
  dinner: bowl(true),
  recipe: bowl(true),
  other: [
    { t: 'circle', cx: 48, cy: 50, r: 29, fill: 'white', stroke: 'primary', sw: 4 },
    { t: 'circle', cx: 48, cy: 50, r: 18, fill: 'tintStrong' },
    { t: 'path', d: 'M50 47 C54 39 62 37 68 40 C64 47 57 49 50 47 Z', fill: 'seed' },
  ],
  breakfast: [
    { t: 'path', d: 'M37 30 C33 24 41 20 37 14', stroke: 'tintStrong', sw: 3.5 },
    { t: 'path', d: 'M49 30 C45 24 53 20 49 14', stroke: 'tintStrong', sw: 3.5 },
    { t: 'path', d: 'M64 46 C76 46 76 64 63 64', stroke: 'primary', sw: 6 },
    { t: 'path', d: 'M22 38 L66 38 L63 68 C62 76 56 82 48 82 L40 82 C32 82 26 76 25 68 Z', fill: 'primary' },
    { t: 'path', d: 'M30 46 C31 56 33 64 38 70', stroke: 'white', sw: 3, opacity: 0.35 },
  ],
  lunch: [
    { t: 'circle', cx: 50, cy: 50, r: 25, fill: 'white', stroke: 'primary', sw: 4 },
    { t: 'circle', cx: 50, cy: 50, r: 15, fill: 'tintStrong' },
    { t: 'path', d: 'M52 47 C56 40 63 39 68 41 C65 47 59 49 52 47 Z', fill: 'seed' },
    { t: 'path', d: 'M14 24 L14 40 C14 44 17 46 19 46 L19 78', stroke: 'primary', sw: 4 },
    { t: 'path', d: 'M24 24 L24 40 C24 44 21 46 19 46', stroke: 'primary', sw: 4 },
    { t: 'path', d: 'M84 24 C78 30 78 42 84 48 L84 78', stroke: 'primary', sw: 4 },
  ],
  product: [
    { t: 'rect', x: 26, y: 20, w: 44, h: 62, rx: 10, fill: 'white', stroke: 'primary', sw: 4 },
    { t: 'rect', x: 34, y: 30, w: 28, h: 18, rx: 5, fill: 'primary' },
    { t: 'path', d: 'M36 58 L36 72 M41 58 L41 72 M47 58 L47 72 M51 58 L51 72 M56 58 L56 72 M60 58 L60 72', stroke: 'primaryDeep', sw: 2.5 },
  ],
};

export function illustrationShapes(key: IllustrationKey): ArtShape[] {
  return ILLUSTRATIONS[key];
}

/* -------------------------------- achievements ----------------------------- */

export type BadgeGlyph = 'first_scan' | 'food_explorer' | 'smart_choices' | 'recipe_discoverer' | 'weekly_explorer' | 'food_curious' | 'consistency';

/** Badge glyphs on a 24-unit grid, drawn as round-capped strokes. */
export const BADGE_GLYPHS: Record<BadgeGlyph, string[]> = {
  first_scan: ['M5 8V6a1 1 0 0 1 1-1h2', 'M16 5h2a1 1 0 0 1 1 1v2', 'M19 16v2a1 1 0 0 1-1 1h-2', 'M8 19H6a1 1 0 0 1-1-1v-2', 'M9 9v6', 'M12 9v6', 'M15 9v6'],
  food_explorer: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'M15.5 8.5l-2 5-5 2 2-5z'],
  smart_choices: ['M8 4.5v15', 'M16 4.5v15', 'M5 8l3-3.5L11 8', 'M13 16l3 3.5 3-3.5'],
  recipe_discoverer: ['M7 13.5a3.5 3.5 0 1 1 2.2-6.2A4 4 0 0 1 15.8 7.3 3.5 3.5 0 1 1 17 13.5V19H7z', 'M7 16h10'],
  weekly_explorer: ['M5.5 6.5h13v13h-13z', 'M5.5 10h13', 'M9 4v4', 'M15 4v4', 'M10 13.5h4l-2.5 4.5'],
  food_curious: ['M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M15.5 15.5 20 20', 'M8 12.5c0-3 2-5 5-5.2 0 3-2 5.2-5 5.2z'],
  consistency: ['M12 3.5c1 3.3 5 5.4 5 9.9a5 5 0 0 1-10 0c0-2.1.9-3.5 1.9-4.4.3 1.7 1.1 2.6 2.1 2.9-.4-2.9-.1-5.8 1-8.4z'],
};
