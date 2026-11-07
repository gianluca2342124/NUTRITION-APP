export type MassUnit = 'mg' | 'g' | 'kg' | 'oz' | 'lb';
export type VolumeUnit = 'ml' | 'cl' | 'dl' | 'l' | 'fl_oz';
export type Unit = MassUnit | VolumeUnit;
export type BaseUnit = 'g' | 'ml';

const TO_BASE: Record<Unit, { base: BaseUnit; factor: number }> = {
  mg: { base: 'g', factor: 0.001 },
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  oz: { base: 'g', factor: 28.349523125 },
  lb: { base: 'g', factor: 453.59237 },
  ml: { base: 'ml', factor: 1 },
  cl: { base: 'ml', factor: 10 },
  dl: { base: 'ml', factor: 100 },
  l: { base: 'ml', factor: 1000 },
  fl_oz: { base: 'ml', factor: 29.5735295625 },
};

const UNIT_ALIASES: Record<string, Unit> = {
  mg: 'mg',
  g: 'g',
  gr: 'g',
  grs: 'g',
  gram: 'g',
  grams: 'g',
  gramo: 'g',
  gramos: 'g',
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilogramo: 'kg',
  kilogramos: 'kg',
  oz: 'oz',
  lb: 'lb',
  lbs: 'lb',
  ml: 'ml',
  millilitre: 'ml',
  milliliter: 'ml',
  mililitro: 'ml',
  mililitros: 'ml',
  cl: 'cl',
  dl: 'dl',
  l: 'l',
  lt: 'l',
  ltr: 'l',
  litre: 'l',
  liter: 'l',
  litro: 'l',
  litros: 'l',
  'fl oz': 'fl_oz',
  floz: 'fl_oz',
  fl_oz: 'fl_oz',
};

export function normalizeUnit(raw: string): Unit | null {
  const key = raw.trim().toLowerCase().replace(/\.$/, '');
  return UNIT_ALIASES[key] ?? null;
}

export function toBase(value: number, unit: Unit): { amount: number; base: BaseUnit } {
  const { base, factor } = TO_BASE[unit];
  return { amount: value * factor, base };
}

export function baseOf(unit: Unit): BaseUnit {
  return TO_BASE[unit].base;
}

export interface ParsedQuantity {
  amount: number;
  unit: Unit;
  /** Number of units in a multipack ("6 x 125 g" → 6). */
  count: number;
  /** Total amount in base units (g or ml). */
  total: number;
  base: BaseUnit;
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`(fl\.?\s?oz|[a-zA-Z]+)`;
const MULTI = new RegExp(String.raw`^\s*(\d+)\s*[x×*]\s*${NUM}\s*${UNIT}\b`, 'i');
const SINGLE = new RegExp(String.raw`^\s*${NUM}\s*${UNIT}\b`, 'i');

function toNumber(s: string): number {
  return Number(s.replace(',', '.'));
}

/**
 * Parses free-text package quantities such as "500 g", "1,5 kg", "6 x 125 g",
 * "75 cl". Returns null when the text cannot be interpreted unambiguously.
 */
export function parseQuantity(text: string | null | undefined): ParsedQuantity | null {
  if (!text) return null;
  const multi = MULTI.exec(text);
  if (multi) {
    const count = Number(multi[1]);
    const amount = toNumber(multi[2] ?? '');
    const unit = normalizeUnit((multi[3] ?? '').replace(/\s+/g, ' '));
    if (!unit || !Number.isFinite(amount) || amount <= 0 || count <= 0) return null;
    const { amount: base, base: baseUnit } = toBase(amount, unit);
    return { amount, unit, count, total: base * count, base: baseUnit };
  }
  const single = SINGLE.exec(text);
  if (!single) return null;
  const amount = toNumber(single[1] ?? '');
  const unit = normalizeUnit((single[2] ?? '').replace(/\s+/g, ' '));
  if (!unit || !Number.isFinite(amount) || amount <= 0) return null;
  const { amount: base, base: baseUnit } = toBase(amount, unit);
  return { amount, unit, count: 1, total: base, base: baseUnit };
}
