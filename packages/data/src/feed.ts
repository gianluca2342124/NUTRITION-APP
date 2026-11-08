import { NUTRIENT_KEYS } from '@repo/core';
import type { DailyTotal, DiaryEntry } from './diary';
import type { ProductScan } from './scans';

/**
 * Today's chronological feed: what the person logged (counts towards the
 * day) and what they only scanned (never counts until "Añadir al día").
 */
export type FeedItem =
  | { kind: 'entry'; key: string; at: number; entry: DiaryEntry }
  | { kind: 'scan'; key: string; at: number; scan: ProductScan };

export function buildFeed(entries: readonly DiaryEntry[], scans: readonly ProductScan[], hidden: ReadonlySet<string> = new Set()): FeedItem[] {
  const items: FeedItem[] = [];
  for (const entry of entries) {
    if (!hidden.has(entry.id)) items.push({ kind: 'entry', key: `e:${entry.id}`, at: Date.parse(entry.consumedAt ?? entry.createdAt), entry });
  }
  // A scan that became an entry is shown once, as the entry.
  for (const scan of scans) {
    if (!scan.entryId && !hidden.has(scan.id)) items.push({ kind: 'scan', key: `s:${scan.id}`, at: Date.parse(scan.scannedAt), scan });
  }
  return items.sort((a, b) => b.at - a.at);
}

export function entryTitle(entry: DiaryEntry): string {
  return entry.title || entry.items.map((i) => i.displayName).join(', ');
}

/**
 * Adds (+1) or removes (-1) an entry from a cached daily total, so every
 * screen updates at once. Unknown stays unknown; totals never go negative.
 */
export function shiftDailyTotal(day: DailyTotal, entry: DiaryEntry, sign: 1 | -1): DailyTotal {
  if (day.date !== entry.consumedOn) return day;
  const nutrients = { ...day.nutrients };
  for (const k of NUTRIENT_KEYS) {
    const current = nutrients[k];
    const delta = entry.totals.values[k];
    if (current == null || delta == null) continue;
    nutrients[k] = Math.max(0, Math.round((current + sign * delta) * 1000) / 1000);
  }
  return {
    ...day,
    entryCount: Math.max(0, day.entryCount + sign),
    itemCount: Math.max(0, day.itemCount + sign * entry.items.length),
    nutrients,
  };
}
