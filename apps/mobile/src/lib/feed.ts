import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { localizedName } from '@repo/core';
import { deleteEntry, deleteScan, shiftDailyTotal, type DailyTotal, type DiaryEntry, type FeedItem, type ProductScan } from '@repo/data';
import { haptic } from './haptics';
import { useT } from './i18n';
import { showToast } from './stores';
import { supabase } from './supabase';
import { deleteWithUndo } from './undo';

export { buildFeed, entryTitle, type FeedItem } from '@repo/data';

export function scanTitle(scan: ProductScan, locale: string): string {
  return localizedName(scan.product, locale) ?? scan.product.gtin;
}

/* ---- optimistic cache edits (every screen reading these caches updates at once) ---- */

function patchLists<T>(qc: QueryClient, root: string, fn: (list: T[], key: QueryKey) => T[]) {
  for (const [key, data] of qc.getQueriesData<T[]>({ queryKey: [root] })) {
    if (data) qc.setQueryData(key, fn(data, key));
  }
}

const byDiaryOrder = (a: DiaryEntry, b: DiaryEntry) =>
  a.consumedOn === b.consumedOn ? a.createdAt.localeCompare(b.createdAt) : a.consumedOn.localeCompare(b.consumedOn);

function removeEntry(qc: QueryClient, entry: DiaryEntry) {
  patchLists<DiaryEntry>(qc, 'diary', (list) => list.filter((e) => e.id !== entry.id));
}

function insertEntry(qc: QueryClient, entry: DiaryEntry) {
  patchLists<DiaryEntry>(qc, 'diary', (list, key) =>
    key[2] === entry.consumedOn && !list.some((e) => e.id === entry.id) ? [...list, entry].sort(byDiaryOrder) : list,
  );
}

/** Adds or removes an entry from the cached daily totals (week dots, progress). */
function shiftTotals(qc: QueryClient, entry: DiaryEntry, sign: 1 | -1) {
  patchLists<DailyTotal>(qc, 'totals', (list) => list.map((day) => shiftDailyTotal(day, entry, sign)));
}

function takeScans(qc: QueryClient, match: (s: ProductScan) => boolean): ProductScan[] {
  const taken: ProductScan[] = [];
  patchLists<ProductScan>(qc, 'scans', (list) =>
    list.filter((s) => {
      if (!match(s)) return true;
      taken.push(s);
      return false;
    }),
  );
  return taken;
}

function restoreScans(qc: QueryClient, scans: readonly ProductScan[]) {
  if (!scans.length) return;
  patchLists<ProductScan>(qc, 'scans', (list, key) => {
    const mine = scans.filter((s) => key[2] === s.scannedOn && !list.some((x) => x.id === s.id));
    return mine.length ? [...list, ...mine].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt)) : list;
  });
}

/** Marks a scan as added to the day so the feed shows only the new entry. */
export function markScanLinked(qc: QueryClient, scanId: string | null, entryId: string, productId?: string, date?: string) {
  patchLists<ProductScan>(qc, 'scans', (list) =>
    list.map((s) => (s.id === scanId || (productId && s.productId === productId && s.scannedOn === date) ? { ...s, entryId } : s)),
  );
}

function refresh(qc: QueryClient) {
  return Promise.all(['diary', 'totals', 'recent', 'scans'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

/**
 * Delete from the feed with a short "Deshacer" window. Deleting a logged
 * entry removes the scan it came from (same item); the public product and
 * any other record stay untouched.
 */
export function useFeedDelete() {
  const qc = useQueryClient();
  const { t } = useT();
  const onError = () => {
    haptic('error');
    showToast(t.today.deleteError, 'error');
    void refresh(qc);
  };
  return (item: FeedItem) => {
    haptic('medium');
    if (item.kind === 'entry') {
      const { entry } = item;
      deleteWithUndo({
        label: t.today.deletedEntry,
        ids: [entry.id],
        apply: () => {
          const linked = takeScans(qc, (s) => s.entryId === entry.id);
          removeEntry(qc, entry);
          shiftTotals(qc, entry, -1);
          return () => {
            insertEntry(qc, entry);
            shiftTotals(qc, entry, 1);
            restoreScans(qc, linked);
          };
        },
        commit: async () => {
          await deleteEntry(supabase(), entry.id);
          await refresh(qc);
        },
        onError,
      });
      return;
    }
    const { scan } = item;
    deleteWithUndo({
      label: t.today.deletedScan,
      ids: [scan.id],
      apply: () => {
        const removed = takeScans(qc, (s) => s.id === scan.id);
        return () => restoreScans(qc, removed);
      },
      commit: async () => {
        await deleteScan(supabase(), scan.id);
        await qc.invalidateQueries({ queryKey: ['scans'] });
      },
      onError,
    });
  };
}
