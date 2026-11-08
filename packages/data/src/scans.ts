import type { SupabaseClient } from '@supabase/supabase-js';
import type { Basis } from '@repo/core';

export type ScanSource = 'barcode' | 'search' | 'label';

/** A product the user scanned or looked at on a day. Never counts as eaten. */
export interface ProductScan {
  id: string;
  productId: string;
  scannedOn: string;
  scannedAt: string;
  source: ScanSource;
  /** Diary entry created from this scan ("Añadir al día"), if any. */
  entryId: string | null;
  product: {
    gtin: string;
    name: string | null;
    names: Record<string, string>;
    brand: string | null;
    imageUrl: string | null;
    basis: Basis;
    nutritionAvailable: boolean;
  };
}

const SCAN_SELECT = 'id, product_id, scanned_on, scanned_at, source, entry_id, products(gtin, name, names, brand, image_url, basis, nutrition_available)';

type Row = Record<string, unknown>;

function mapScan(r: Row): ProductScan {
  const p = (Array.isArray(r.products) ? r.products[0] : r.products) as Row;
  return {
    id: String(r.id),
    productId: String(r.product_id),
    scannedOn: String(r.scanned_on),
    scannedAt: String(r.scanned_at),
    source: r.source as ScanSource,
    entryId: (r.entry_id as string | null) ?? null,
    product: {
      gtin: String(p.gtin),
      name: (p.name as string | null) ?? null,
      names: (p.names as Record<string, string> | null) ?? {},
      brand: (p.brand as string | null) ?? null,
      imageUrl: (p.image_url as string | null) ?? null,
      basis: p.basis === '100ml' ? '100ml' : '100g',
      nutritionAvailable: p.nutrition_available === true,
    },
  };
}

/**
 * Records an interaction with a product on the user's local day. Repeating it
 * the same day only refreshes the time (one card per product and day).
 */
export async function recordScan(client: SupabaseClient, productId: string, localDate: string, source: ScanSource): Promise<void> {
  const { error } = await client
    .from('product_scans')
    .upsert({ product_id: productId, scanned_on: localDate, scanned_at: new Date().toISOString(), source }, { onConflict: 'user_id,product_id,scanned_on' });
  if (error) throw error;
}

export async function listScans(client: SupabaseClient, date: string): Promise<ProductScan[]> {
  const { data, error } = await client.from('product_scans').select(SCAN_SELECT).eq('scanned_on', date).order('scanned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapScan(r as Row));
}

/** Removes a scan from the history (the product and any diary entry stay). */
export async function deleteScan(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('product_scans').delete().eq('id', id);
  if (error) throw error;
}

export async function linkScanToEntry(client: SupabaseClient, scanId: string, entryId: string): Promise<void> {
  const { error } = await client.from('product_scans').update({ entry_id: entryId }).eq('id', scanId);
  if (error) throw error;
}

/** Links today's scan of a product (if any) to the entry created from it. */
export async function linkProductScan(client: SupabaseClient, productId: string, localDate: string, entryId: string): Promise<void> {
  const { error } = await client.from('product_scans').update({ entry_id: entryId }).eq('product_id', productId).eq('scanned_on', localDate);
  if (error) throw error;
}
