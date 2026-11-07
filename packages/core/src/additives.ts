/** Technological functions of food additives (as classified in the OFF taxonomy). */
export const ADDITIVE_CLASSES = [
  'acid',
  'acidity-regulator',
  'anti-caking-agent',
  'anti-foaming-agent',
  'antioxidant',
  'bulking-agent',
  'carrier',
  'coagulant',
  'colour',
  'emulsifier',
  'firming-agent',
  'flavour-enhancer',
  'flour-treatment-agent',
  'foaming-agent',
  'gelling-agent',
  'glazing-agent',
  'humectant',
  'modified-starch',
  'packaging-gas',
  'preservative',
  'propellent-gas',
  'raising-agent',
  'sequestrant',
  'stabiliser',
  'sweetener',
  'thickener',
] as const;
export type AdditiveClass = (typeof ADDITIVE_CLASSES)[number];

/** "en:e322i" | "E322i" | "e 322 i" → "e322i". Returns null if not an E-number. */
export function normalizeAdditiveCode(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/^[a-z]{2}:/, '').replace(/[\s-]/g, '');
  const m = /^e(\d{3,4}[a-z]?(?:i{1,3}|iv|v|vi{0,3})?)$/.exec(s);
  return m ? `e${m[1]}` : null;
}

/** "e322i" → "E322i" */
export function displayENumber(code: string): string {
  return code.replace(/^e/i, 'E');
}

export function parseAdditiveClasses(raw: string | null | undefined): AdditiveClass[] {
  if (!raw) return [];
  const out: AdditiveClass[] = [];
  for (const part of raw.split(',')) {
    const key = part.trim().replace(/^en:/, '') as AdditiveClass;
    if ((ADDITIVE_CLASSES as readonly string[]).includes(key) && !out.includes(key)) out.push(key);
  }
  return out;
}
