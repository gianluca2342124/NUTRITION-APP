import type { NutrientValues } from './nutrients';
import { computeNutriScore2023, type NutriScoreCategory, type NutriScoreComponent, type NutriScoreInputs, type NutriScoreResult } from './nutriscore';
import type { Basis, EuAdditiveStatus } from './products';

/**
 * Fudyu Score — a 0–100 summary of a packaged product. Deterministic and
 * versioned; methodology in docs/fudyu-score.md.
 *
 * 1. Nutrition (the base): the product's Nutri-Score 2023 points, mapped
 *    linearly inside each grade band so that, before adjustments, the Fudyu
 *    level always matches the Nutri-Score grade (A→80–100 … E→0–19).
 * 2. Adjustments (never nutrient-based, so nothing is counted twice):
 *    – ultra-processed (NOVA 4): −8
 *    – an additive not authorised as a food additive in the EU: −15
 *    – additives for which EFSA estimated intakes above the ADI in some
 *      population groups: −4 each, at most −8
 *    The adjustments together never exceed −25. Authorised additives without
 *    such findings are not penalised.
 * 3. No invented numbers: without the data the Nutri-Score needs, there is no
 *    score ("Sin puntuación").
 *
 * This is an editorial summary, not a validated health measure.
 */

/**
 * 1.0.1 — explanations only (every score is unchanged): reasons list only what
 * moves the number; NOVA 1 is shown under "Procesamiento", not as a reason;
 * oils show one saturated-fat reason instead of two.
 */
export const FUDYU_SCORE_VERSION = '1.0.1';

export const SCORE_LEVELS = ['excellent', 'good', 'fair', 'poor', 'limit'] as const;
export type ScoreLevel = (typeof SCORE_LEVELS)[number];

/** 80–100 · 60–79 · 40–59 · 20–39 · 0–19 */
export function scoreLevel(score: number): ScoreLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'limit';
}

export const SCORE_ADJUSTMENTS = {
  ultraProcessed: -8,
  additiveNotAuthorised: -15,
  additiveExposure: -4,
  additiveExposureMax: -8,
  total: -25,
} as const;

export interface ScoreAdditive {
  code: string;
  eNumber: string;
  euStatus: EuAdditiveStatus;
  exposureConcern: boolean;
}

export interface ScoreInput {
  basis: Basis;
  nutrientsPer100: NutrientValues;
  nutritionAvailable: boolean;
  nutriscoreInputs: NutriScoreInputs | null;
  novaGroup: number | null;
  /** True when an ingredient list exists (otherwise additives are unknown). */
  ingredientsKnown: boolean;
  /** Additive data from the catalogue; null when not available. */
  additives: ScoreAdditive[] | null;
}

export type FactorKey =
  | 'sugars'
  | 'saturated_fat'
  | 'saturated_fat_ratio'
  | 'salt'
  | 'energy'
  | 'sweeteners'
  | 'ultra_processed'
  | 'additive_not_authorised'
  | 'additive_exposure'
  | 'fiber'
  | 'protein'
  | 'fruits_vegetables_legumes'
  | 'low_sugars'
  | 'low_salt'
  | 'low_saturated_fat'
  | 'water';

export interface ScoreFactor {
  key: FactorKey;
  /** +1 helps the score, −1 lowers it. */
  sign: 1 | -1;
  /** "very_high" / "high" for negatives taken from the Nutri-Score scale. */
  intensity?: 'very_high' | 'high';
  /** Value per 100 g/ml in the unit of the factor (g, %, kJ), when meaningful. */
  value?: number | null;
  unit?: 'g' | '%' | 'kJ' | 'kcal';
  /** Additive codes for additive factors. */
  codes?: string[];
  /** Relative weight used only to pick the most relevant reasons. */
  impact: number;
}

export interface ScoreAdjustment {
  key: 'ultra_processed' | 'additive_not_authorised' | 'additive_exposure';
  points: number;
  codes?: string[];
}

export type MissingData = 'fiber' | 'protein' | 'fruits_vegetables_legumes' | 'processing' | 'additives';

export type UnscoredReason = 'no_nutrition' | 'missing_nutrients' | 'not_applicable' | 'unknown_category';

export type FudyuScoreResult =
  | {
      status: 'scored';
      version: string;
      score: number;
      level: ScoreLevel;
      /** Nutrition sub-score (0–100) before adjustments. */
      nutritionScore: number;
      nutriscore: Extract<NutriScoreResult, { status: 'computed' }>;
      adjustments: ScoreAdjustment[];
      /** Every reason, most relevant first; the UI shows 2–3 via topFactors(). */
      factors: ScoreFactor[];
      /** Data that was unknown and therefore could not count either way. */
      unknown: MissingData[];
    }
  | { status: 'unscored'; version: string; reason: UnscoredReason; missing: string[] };

/* ----------------------------- nutrition mapping --------------------------- */

interface Band {
  lo: number;
  hi: number;
  top: number;
  bottom: number;
}

const GENERAL_BANDS: Band[] = [
  { lo: -15, hi: 0, top: 100, bottom: 80 },
  { lo: 1, hi: 2, top: 79, bottom: 60 },
  { lo: 3, hi: 10, top: 59, bottom: 40 },
  { lo: 11, hi: 18, top: 39, bottom: 20 },
  { lo: 19, hi: 40, top: 19, bottom: 0 },
];

const FATS_BANDS: Band[] = [
  { lo: -15, hi: -6, top: 100, bottom: 80 },
  { lo: -5, hi: 2, top: 79, bottom: 60 },
  ...GENERAL_BANDS.slice(2),
];

const BEVERAGE_BANDS: Band[] = [
  { lo: -10, hi: 2, top: 79, bottom: 60 },
  { lo: 3, hi: 6, top: 59, bottom: 40 },
  { lo: 7, hi: 9, top: 39, bottom: 20 },
  { lo: 10, hi: 30, top: 19, bottom: 0 },
];

/** Maps Nutri-Score points to 0–100 inside the band of the product's grade. */
export function nutritionScoreFromPoints(points: number, category: NutriScoreCategory): number {
  if (category === 'water') return 100;
  const bands = category === 'fats_oils_nuts_seeds' ? FATS_BANDS : category === 'beverage' ? BEVERAGE_BANDS : GENERAL_BANDS;
  const first = bands[0]!;
  const last = bands[bands.length - 1]!;
  if (points < first.lo) return first.top;
  if (points > last.hi) return last.bottom;
  const band = bands.find((b) => points >= b.lo && points <= b.hi) ?? last;
  if (band.hi === band.lo) return band.top;
  return band.top - ((points - band.lo) * (band.top - band.bottom)) / (band.hi - band.lo);
}

/* ---------------------------------- factors -------------------------------- */

const NEGATIVE_KEYS: Partial<Record<NutriScoreComponent['id'], FactorKey>> = {
  sugars: 'sugars',
  saturated_fat: 'saturated_fat',
  saturated_fat_ratio: 'saturated_fat_ratio',
  salt: 'salt',
  energy: 'energy',
  energy_from_saturated_fat: 'saturated_fat',
  non_nutritive_sweeteners: 'sweeteners',
};

const POSITIVE_KEYS: Partial<Record<NutriScoreComponent['id'], FactorKey>> = {
  fiber: 'fiber',
  proteins: 'protein',
  fruits_vegetables_legumes: 'fruits_vegetables_legumes',
};

function componentFactors(ns: Extract<NutriScoreResult, { status: 'computed' }>, input: ScoreInput): ScoreFactor[] {
  const out: ScoreFactor[] = [];
  for (const c of ns.components) {
    if (!c.counted || c.points === 0) continue;
    const ratio = c.points / c.max;
    if (c.kind === 'negative') {
      const key = NEGATIVE_KEYS[c.id];
      // Energy alone is a weak signal; it is only a reason when clearly high.
      if (!key || ratio < (c.id === 'energy' ? 0.6 : 0.4)) continue;
      const kcal = c.id === 'energy' ? input.nutrientsPer100.energy_kcal : null;
      out.push({
        key,
        sign: -1,
        intensity: ratio >= 0.67 || c.id === 'non_nutritive_sweeteners' ? 'very_high' : 'high',
        value: c.id === 'energy' ? kcal : c.id === 'energy_from_saturated_fat' ? input.nutrientsPer100.saturated_fat_g : c.value,
        unit: c.id === 'energy' ? 'kcal' : c.id === 'saturated_fat_ratio' ? '%' : 'g',
        impact: ratio,
      });
    } else {
      const key = POSITIVE_KEYS[c.id];
      if (!key || ratio < 0.4) continue;
      out.push({ key, sign: 1, value: c.value, unit: c.unit === '%' ? '%' : 'g', impact: ratio });
    }
  }
  return out;
}

/**
 * "Low" claims use the thresholds of Regulation (EC) No 1924/2006 on nutrition
 * claims (per 100 g, or per 100 ml for liquids).
 */
function claimFactors(input: ScoreInput, category: NutriScoreCategory): ScoreFactor[] {
  const v = input.nutrientsPer100;
  const liquid = input.basis === '100ml' || category === 'beverage' || category === 'water';
  const out: ScoreFactor[] = [];
  if (category === 'water') return [{ key: 'water', sign: 1, impact: 1 }];
  if (v.sugars_g != null && v.sugars_g <= (liquid ? 2.5 : 5)) out.push({ key: 'low_sugars', sign: 1, value: v.sugars_g, unit: 'g', impact: 0.35 });
  if (v.salt_g != null && v.salt_g <= 0.3) out.push({ key: 'low_salt', sign: 1, value: v.salt_g, unit: 'g', impact: 0.3 });
  if (
    v.saturated_fat_g != null &&
    v.saturated_fat_g <= (liquid ? 0.75 : 1.5) &&
    (v.energy_kcal == null || v.energy_kcal === 0 || (v.saturated_fat_g * 9) / v.energy_kcal <= 0.1)
  ) {
    out.push({ key: 'low_saturated_fat', sign: 1, value: v.saturated_fat_g, unit: 'g', impact: 0.3 });
  }
  return out;
}

/* ----------------------------------- engine -------------------------------- */

export function computeFudyuScore(input: ScoreInput): FudyuScoreResult {
  const version = FUDYU_SCORE_VERSION;
  // Water is graded by category alone; everything else needs the nutrition table.
  const water = input.nutriscoreInputs?.applicable === true && input.nutriscoreInputs.category === 'water';
  if (!input.nutritionAvailable && !water) return { status: 'unscored', version, reason: 'no_nutrition', missing: [] };
  const ns = computeNutriScore2023(input.nutrientsPer100, input.nutriscoreInputs);
  if (ns.status === 'missing_nutrients') return { status: 'unscored', version, reason: 'missing_nutrients', missing: ns.missing };
  if (ns.status === 'not_applicable') return { status: 'unscored', version, reason: 'not_applicable', missing: ns.reason ? [ns.reason] : [] };
  if (ns.status === 'unknown_category') return { status: 'unscored', version, reason: 'unknown_category', missing: [] };

  const nutritionScore = nutritionScoreFromPoints(ns.score, ns.category);
  const adjustments: ScoreAdjustment[] = [];
  const unknown: MissingData[] = [];

  if (input.novaGroup === 4) adjustments.push({ key: 'ultra_processed', points: SCORE_ADJUSTMENTS.ultraProcessed });
  else if (input.novaGroup == null && ns.category !== 'water') unknown.push('processing');

  if (input.additives && input.ingredientsKnown) {
    const banned = input.additives.filter((a) => a.euStatus === 'not_authorised');
    if (banned.length) adjustments.push({ key: 'additive_not_authorised', points: SCORE_ADJUSTMENTS.additiveNotAuthorised, codes: banned.map((a) => a.eNumber) });
    const exposure = input.additives.filter((a) => a.exposureConcern && a.euStatus !== 'not_authorised');
    if (exposure.length) {
      adjustments.push({
        key: 'additive_exposure',
        points: Math.max(SCORE_ADJUSTMENTS.additiveExposureMax, SCORE_ADJUSTMENTS.additiveExposure * exposure.length),
        codes: exposure.map((a) => a.eNumber),
      });
    }
  } else if (ns.category !== 'water') {
    unknown.push('additives');
  }

  const totalAdjustment = Math.max(SCORE_ADJUSTMENTS.total, adjustments.reduce((s, a) => s + a.points, 0));
  const score = Math.min(100, Math.max(0, Math.round(nutritionScore + totalAdjustment)));

  for (const c of ns.components) {
    if (c.value != null) continue;
    if (c.id === 'fiber') unknown.push('fiber');
    if (c.id === 'proteins') unknown.push('protein');
    if (c.id === 'fruits_vegetables_legumes') unknown.push('fruits_vegetables_legumes');
  }

  // Reasons are only things that move the number: Nutri-Score components that
  // scored, the adjustments, and "low" values that kept a component at 0 points.
  const factors: ScoreFactor[] = [
    ...componentFactors(ns, input),
    ...adjustments.map<ScoreFactor>((a) => ({ key: a.key, sign: -1, codes: a.codes, impact: Math.abs(a.points) / 10 })),
    ...claimFactors(input, ns.category),
  ];
  const deduped = factors.filter((f, i) => factors.findIndex((g) => g.key === f.key) === i);
  // Oils and nuts have two saturated-fat components in the official algorithm;
  // they are one reason for a person, so only the stronger one is shown.
  const satFat = deduped.filter((f) => f.sign < 0 && (f.key === 'saturated_fat' || f.key === 'saturated_fat_ratio'));
  const weaker = satFat.length === 2 ? satFat.reduce((a, b) => (a.impact < b.impact ? a : b)) : null;
  const reasons = weaker ? deduped.filter((f) => f !== weaker) : deduped;
  reasons.sort((a, b) => b.impact - a.impact);

  return { status: 'scored', version, score, level: scoreLevel(score), nutritionScore: Math.round(nutritionScore), nutriscore: ns, adjustments, factors: reasons, unknown };
}

/**
 * The 2–3 reasons shown under the score: strengths first for good scores,
 * concerns first otherwise. A reason of the opposite sign is added only when
 * it is substantial, so a minor claim never softens a clear concern (or the
 * other way round).
 */
export function topFactors(result: Extract<FudyuScoreResult, { status: 'scored' }>, max = 3): ScoreFactor[] {
  const negatives = result.factors.filter((f) => f.sign < 0);
  const positives = result.factors.filter((f) => f.sign > 0);
  const good = result.level === 'excellent' || result.level === 'good';
  const [first, second] = good ? [positives, negatives] : [negatives, positives];
  const picked = [...first.slice(0, max - 1), ...second.filter((f) => f.impact >= 0.4).slice(0, 1)];
  for (const f of [...first, ...second]) {
    if (picked.length >= max) break;
    if (!picked.includes(f)) picked.push(f);
  }
  return picked.slice(0, max);
}

/** Builds the score input from a catalogue product (shared by web and mobile). */
export function scoreInputFromProduct(p: {
  basis: Basis;
  nutrientsPer100: NutrientValues;
  nutritionAvailable: boolean;
  nutriscoreInputs: NutriScoreInputs | null;
  novaGroup: number | null;
  ingredientsText: string | null;
  additives: readonly string[];
  additiveInfo?: readonly ScoreAdditive[] | undefined;
}): ScoreInput {
  return {
    basis: p.basis,
    nutrientsPer100: p.nutrientsPer100,
    nutritionAvailable: p.nutritionAvailable,
    nutriscoreInputs: p.nutriscoreInputs,
    novaGroup: p.novaGroup,
    ingredientsKnown: !!p.ingredientsText || p.additives.length > 0,
    additives: p.additiveInfo ? [...p.additiveInfo] : null,
  };
}
