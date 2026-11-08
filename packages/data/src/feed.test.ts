import { describe, expect, it } from 'vitest';
import { sumNutrients, type NutrientValues } from '@repo/core';
import { buildFeed, entryTitle, shiftDailyTotal } from './feed';
import type { DailyTotal, DiaryEntry } from './diary';
import type { ProductScan } from './scans';

const values = (kcal: number | null, protein: number | null = null): NutrientValues => ({
  energy_kcal: kcal,
  protein_g: protein,
  carbs_g: null,
  sugars_g: null,
  fat_g: null,
  saturated_fat_g: null,
  fiber_g: null,
  salt_g: null,
});

function entry(id: string, at: string, kcal: number, title: string | null = null): DiaryEntry {
  const nutrients = values(kcal, 10);
  return {
    id,
    consumedOn: '2026-11-08',
    consumedAt: at,
    mealType: 'snack',
    title,
    method: 'barcode',
    photoPath: null,
    createdAt: at,
    items: [
      {
        id: `${id}-i`,
        entryId: id,
        position: 0,
        foodKind: 'product',
        genericFoodId: null,
        productId: 'p1',
        displayName: `Item ${id}`,
        amount: 100,
        quantityLabel: null,
        basis: '100g',
        per100: nutrients,
        nutrients,
        dataSource: 'open_food_facts',
        dataSourceRef: null,
        isEstimate: false,
        foodSlug: null,
        foodCategory: null,
        productImageUrl: null,
      },
    ],
    totals: sumNutrients([nutrients]),
  };
}

function scan(id: string, at: string, entryId: string | null = null): ProductScan {
  return {
    id,
    productId: 'p1',
    scannedOn: '2026-11-08',
    scannedAt: at,
    source: 'barcode',
    entryId,
    product: { gtin: '1', name: 'Producto', names: {}, brand: null, imageUrl: null, basis: '100g', nutritionAvailable: true },
  };
}

describe('Today feed', () => {
  it('mixes logged entries and scans in time order, newest first', () => {
    const feed = buildFeed([entry('a', '2026-11-08T08:00:00Z', 300)], [scan('s1', '2026-11-08T09:30:00Z'), scan('s2', '2026-11-08T07:00:00Z')]);
    expect(feed.map((i) => i.key)).toEqual(['s:s1', 'e:a', 's:s2']);
  });

  it('shows a scan that was added to the day only once (as the entry)', () => {
    const feed = buildFeed([entry('a', '2026-11-08T08:00:00Z', 300)], [scan('s1', '2026-11-08T07:59:00Z', 'a')]);
    expect(feed).toHaveLength(1);
    expect(feed[0]!.kind).toBe('entry');
  });

  it('drops items being deleted (undo window)', () => {
    const feed = buildFeed([entry('a', '2026-11-08T08:00:00Z', 300)], [scan('s1', '2026-11-08T09:00:00Z')], new Set(['a', 's1']));
    expect(feed).toHaveLength(0);
  });

  it('uses the meal title, or the item names', () => {
    expect(entryTitle(entry('a', '2026-11-08T08:00:00Z', 1, 'Tostada'))).toBe('Tostada');
    expect(entryTitle(entry('b', '2026-11-08T08:00:00Z', 1))).toBe('Item b');
  });
});

describe('optimistic daily totals', () => {
  const day: DailyTotal = { date: '2026-11-08', entryCount: 2, itemCount: 2, nutrients: values(500, 20), hasEstimates: false };

  it('removes an entry and restores it exactly', () => {
    const e = entry('a', '2026-11-08T08:00:00Z', 300);
    const removed = shiftDailyTotal(day, e, -1);
    expect(removed).toMatchObject({ entryCount: 1, itemCount: 1 });
    expect(removed.nutrients.energy_kcal).toBe(200);
    expect(removed.nutrients.protein_g).toBe(10);
    expect(shiftDailyTotal(removed, e, 1)).toEqual(day);
  });

  it('keeps unknown as unknown and never goes below zero', () => {
    const e = entry('a', '2026-11-08T08:00:00Z', 900);
    const removed = shiftDailyTotal(day, e, -1);
    expect(removed.nutrients.energy_kcal).toBe(0);
    expect(removed.nutrients.carbs_g).toBeNull();
  });

  it('ignores other days', () => {
    const e = { ...entry('a', '2026-11-08T08:00:00Z', 300), consumedOn: '2026-11-07' };
    expect(shiftDailyTotal(day, e, -1)).toBe(day);
  });
});
