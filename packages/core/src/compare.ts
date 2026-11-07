import type { Goal } from './targets';
import { NUTRIENT_KEYS, type NutrientKey, type NutrientValues } from './nutrients';
import type { Basis } from './products';

export interface ComparableItem {
  id: string;
  name: string;
  basis: Basis;
  nutrientsPer100: NutrientValues;
  categories: readonly string[];
  additives: readonly string[];
  novaGroup: number | null;
  netQuantity: number | null;
}

export type CompareIssue = 'different_basis' | 'different_category' | 'missing_nutrition';

export interface CompareRow {
  key: NutrientKey;
  values: (number | null)[];
  /** Index of the item with the highest value when the difference is meaningful. */
  highest: number | null;
  lowest: number | null;
}

export interface CompareStatement {
  key: NutrientKey;
  /** Item that contains MORE of the nutrient. */
  moreIndex: number;
  lessIndex: number;
  more: number;
  less: number;
}

export interface Comparison {
  comparable: boolean;
  issues: CompareIssue[];
  basis: Basis | null;
  rows: CompareRow[];
  /** Pairwise, neutral statements ("A contains more protein per 100 g"). */
  statements: CompareStatement[];
  additiveCounts: number[];
  novaGroups: (number | null)[];
}

/** Absolute per-100 differences below which values are considered equivalent. */
const MIN_ABS_DIFF: Record<NutrientKey, number> = {
  energy_kcal: 15,
  protein_g: 1,
  carbs_g: 2,
  sugars_g: 1,
  fat_g: 1,
  saturated_fat_g: 0.5,
  fiber_g: 0.5,
  salt_g: 0.1,
};
const MIN_REL_DIFF = 0.1;

/** Very broad OFF categories that do not make two products comparable. */
const BROAD_CATEGORIES = new Set([
  'plant-based-foods-and-beverages',
  'plant-based-foods',
  'beverages-and-beverages-preparations',
  'snacks',
  'dairies',
  'groceries',
  'meats-and-their-products',
  'foods-and-beverages',
]);

/** Order in which nutrients are discussed, by user goal. */
export function nutrientOrderForGoal(goal: Goal | null): NutrientKey[] {
  switch (goal) {
    case 'increase_protein':
    case 'build_muscle':
      return ['protein_g', 'energy_kcal', 'sugars_g', 'fiber_g', 'saturated_fat_g', 'salt_g', 'fat_g', 'carbs_g'];
    case 'lose_weight':
      return ['energy_kcal', 'protein_g', 'fiber_g', 'sugars_g', 'saturated_fat_g', 'salt_g', 'fat_g', 'carbs_g'];
    case 'gain_weight':
      return ['energy_kcal', 'protein_g', 'fat_g', 'carbs_g', 'fiber_g', 'sugars_g', 'saturated_fat_g', 'salt_g'];
    default:
      return ['energy_kcal', 'protein_g', 'fiber_g', 'sugars_g', 'saturated_fat_g', 'salt_g', 'fat_g', 'carbs_g'];
  }
}

function meaningful(key: NutrientKey, a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  return diff >= MIN_ABS_DIFF[key] && diff >= MIN_REL_DIFF * Math.max(a, b);
}

export function compareItems(items: readonly ComparableItem[], goal: Goal | null = null): Comparison {
  const issues: CompareIssue[] = [];
  const bases = new Set(items.map((i) => i.basis));
  if (bases.size > 1) issues.push('different_basis');

  const specific = items.map((i) => new Set(i.categories.filter((c) => !BROAD_CATEGORIES.has(c))));
  const first = specific[0];
  const sharesCategory =
    !!first && specific.slice(1).every((set) => Array.from(set).some((c) => first.has(c)));
  if (items.length > 1 && !sharesCategory) issues.push('different_category');

  if (items.some((i) => i.nutrientsPer100.energy_kcal == null)) issues.push('missing_nutrition');

  const order = nutrientOrderForGoal(goal);
  const rows: CompareRow[] = order.map((key) => {
    const values = items.map((i) => i.nutrientsPer100[key]);
    const known = values.map((v, idx) => ({ v, idx })).filter((x): x is { v: number; idx: number } => x.v != null);
    let highest: number | null = null;
    let lowest: number | null = null;
    if (known.length >= 2) {
      const max = known.reduce((a, b) => (b.v > a.v ? b : a));
      const min = known.reduce((a, b) => (b.v < a.v ? b : a));
      if (meaningful(key, max.v, min.v)) {
        highest = max.idx;
        lowest = min.idx;
      }
    }
    return { key, values, highest, lowest };
  });

  const statements: CompareStatement[] = [];
  const comparable = !issues.includes('different_basis');
  if (comparable && items.length === 2) {
    for (const key of order) {
      const a = items[0]!.nutrientsPer100[key];
      const b = items[1]!.nutrientsPer100[key];
      if (a == null || b == null || !meaningful(key, a, b)) continue;
      statements.push(a > b ? { key, moreIndex: 0, lessIndex: 1, more: a, less: b } : { key, moreIndex: 1, lessIndex: 0, more: b, less: a });
    }
  }

  return {
    comparable,
    issues,
    basis: bases.size === 1 ? (items[0]?.basis ?? null) : null,
    rows,
    statements,
    additiveCounts: items.map((i) => i.additives.length),
    novaGroups: items.map((i) => i.novaGroup),
  };
}

export { NUTRIENT_KEYS };
