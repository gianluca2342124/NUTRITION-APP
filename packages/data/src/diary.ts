import type { SupabaseClient } from '@supabase/supabase-js';
import {
  sumNutrients,
  type Basis,
  type DataSource,
  type EntryMethod,
  type MealType,
  type NutrientTotals,
  type NutrientValues,
} from '@repo/core';
import { nutrientsFromJson, nutrientsFromRow } from './mappers';

export interface DiaryItem {
  id: string;
  entryId: string;
  position: number;
  foodKind: 'generic_food' | 'product' | 'custom';
  genericFoodId: string | null;
  productId: string | null;
  displayName: string;
  amount: number;
  quantityLabel: string | null;
  basis: Basis;
  per100: NutrientValues;
  nutrients: NutrientValues;
  dataSource: DataSource;
  dataSourceRef: string | null;
  isEstimate: boolean;
  /** Generic food slug (for curated images) and category (for fallbacks). */
  foodSlug: string | null;
  foodCategory: string | null;
  /** Authentic product photo from the catalogue, if any. */
  productImageUrl: string | null;
}

export interface DiaryEntry {
  id: string;
  consumedOn: string;
  consumedAt: string | null;
  mealType: MealType;
  title: string | null;
  method: EntryMethod;
  photoPath: string | null;
  createdAt: string;
  items: DiaryItem[];
  totals: NutrientTotals;
}

const ENTRY_SELECT =
  'id, consumed_on, consumed_at, meal_type, title, method, photo_path, created_at, food_entry_items(id, entry_id, position, food_kind, generic_food_id, product_id, display_name, amount, quantity_label, basis, per100, energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, salt_g, data_source, data_source_ref, is_estimate, generic_foods(slug, category), products(image_url))';

type Row = Record<string, unknown>;

function mapItem(row: Row): DiaryItem {
  return {
    id: String(row.id),
    entryId: String(row.entry_id),
    position: Number(row.position ?? 0),
    foodKind: row.food_kind as DiaryItem['foodKind'],
    genericFoodId: (row.generic_food_id as string | null) ?? null,
    productId: (row.product_id as string | null) ?? null,
    displayName: String(row.display_name),
    amount: Number(row.amount),
    quantityLabel: (row.quantity_label as string | null) ?? null,
    basis: row.basis === '100ml' ? '100ml' : '100g',
    per100: nutrientsFromJson(row.per100),
    nutrients: nutrientsFromRow(row),
    dataSource: row.data_source as DataSource,
    dataSourceRef: (row.data_source_ref as string | null) ?? null,
    isEstimate: row.is_estimate === true,
    foodSlug: (embedded(row.generic_foods)?.slug as string | undefined) ?? null,
    foodCategory: (embedded(row.generic_foods)?.category as string | undefined) ?? null,
    productImageUrl: (embedded(row.products)?.image_url as string | undefined) ?? null,
  };
}

/** PostgREST returns to-one embeds as an object (or null); tolerate arrays too. */
function embedded(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row | undefined) ?? null;
  return value && typeof value === 'object' ? (value as Row) : null;
}

function mapEntry(row: Row): DiaryEntry {
  const items = (Array.isArray(row.food_entry_items) ? (row.food_entry_items as Row[]) : [])
    .map(mapItem)
    .sort((a, b) => a.position - b.position);
  return {
    id: String(row.id),
    consumedOn: String(row.consumed_on),
    consumedAt: (row.consumed_at as string | null) ?? null,
    mealType: row.meal_type as MealType,
    title: (row.title as string | null) ?? null,
    method: row.method as EntryMethod,
    photoPath: (row.photo_path as string | null) ?? null,
    createdAt: String(row.created_at),
    items,
    totals: sumNutrients(items.map((i) => i.nutrients)),
  };
}

export async function listEntries(client: SupabaseClient, from: string, to: string = from): Promise<DiaryEntry[]> {
  const { data, error } = await client
    .from('food_entries')
    .select(ENTRY_SELECT)
    .gte('consumed_on', from)
    .lte('consumed_on', to)
    .order('consumed_on', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapEntry(r as Row));
}

export async function getEntry(client: SupabaseClient, id: string): Promise<DiaryEntry | null> {
  const { data, error } = await client.from('food_entries').select(ENTRY_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapEntry(data as Row) : null;
}

export interface NewMealItem {
  id: string;
  foodKind: DiaryItem['foodKind'];
  genericFoodId?: string | null;
  productId?: string | null;
  displayName: string;
  amount: number;
  quantityLabel?: string | null;
  /** Only used for custom items; catalogue items are snapshotted server-side. */
  per100?: NutrientValues;
  dataSource?: 'user_contribution' | 'label_scan';
  isEstimate?: boolean;
}

export interface NewMeal {
  id: string;
  consumedOn: string;
  consumedAt?: string | null;
  mealType: MealType;
  title?: string | null;
  method: EntryMethod;
  photoPath?: string | null;
  aiDraftId?: string | null;
  notes?: string | null;
  items: NewMealItem[];
}

/** Saves a meal atomically. Safe to retry with the same ids. */
export async function saveMeal(client: SupabaseClient, meal: NewMeal): Promise<string> {
  const { data, error } = await client.rpc('save_meal', {
    p_entry: {
      id: meal.id,
      consumed_on: meal.consumedOn,
      consumed_at: meal.consumedAt ?? null,
      meal_type: meal.mealType,
      title: meal.title ?? null,
      method: meal.method,
      photo_path: meal.photoPath ?? null,
      ai_draft_id: meal.aiDraftId ?? null,
      notes: meal.notes ?? null,
    },
    p_items: meal.items.map((i) => ({
      id: i.id,
      food_kind: i.foodKind,
      generic_food_id: i.genericFoodId ?? null,
      product_id: i.productId ?? null,
      display_name: i.displayName.slice(0, 120),
      amount: Math.round(i.amount * 100) / 100,
      quantity_label: i.quantityLabel ?? null,
      per100: i.foodKind === 'custom' ? (i.per100 ?? {}) : {},
      data_source: i.dataSource ?? 'user_contribution',
      is_estimate: i.isEstimate ?? false,
    })),
  });
  if (error) throw error;
  return String(data);
}

export async function updateItemAmount(
  client: SupabaseClient,
  itemId: string,
  amount: number,
  quantityLabel: string | null,
): Promise<void> {
  const { error } = await client
    .from('food_entry_items')
    .update({ amount: Math.round(amount * 100) / 100, quantity_label: quantityLabel, is_estimate: false })
    .eq('id', itemId);
  if (error) throw error;
}

export async function deleteItem(client: SupabaseClient, itemId: string): Promise<void> {
  const { error } = await client.from('food_entry_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function updateEntry(
  client: SupabaseClient,
  id: string,
  patch: { mealType?: MealType; consumedOn?: string; title?: string | null },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.mealType) row.meal_type = patch.mealType;
  if (patch.consumedOn) row.consumed_on = patch.consumedOn;
  if (patch.title !== undefined) row.title = patch.title;
  const { error } = await client.from('food_entries').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteEntry(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('food_entries').delete().eq('id', id);
  if (error) throw error;
}

/** Copies an existing meal to another day/meal with fresh ids. */
export async function copyEntry(
  client: SupabaseClient,
  source: DiaryEntry,
  target: { id: string; consumedOn: string; mealType: MealType; itemIds: string[] },
): Promise<string> {
  return saveMeal(client, {
    id: target.id,
    consumedOn: target.consumedOn,
    mealType: target.mealType,
    title: source.title,
    method: 'copy',
    items: source.items.map((item, idx) => ({
      id: target.itemIds[idx] ?? crypto.randomUUID(),
      foodKind: item.foodKind,
      genericFoodId: item.genericFoodId,
      productId: item.productId,
      displayName: item.displayName,
      amount: item.amount,
      quantityLabel: item.quantityLabel,
      per100: item.per100,
      dataSource: item.dataSource === 'label_scan' ? 'label_scan' : 'user_contribution',
      isEstimate: item.isEstimate,
    })),
  });
}

export interface DailyTotal {
  date: string;
  entryCount: number;
  itemCount: number;
  nutrients: NutrientValues;
  hasEstimates: boolean;
}

export async function dailyTotals(client: SupabaseClient, from: string, to: string): Promise<DailyTotal[]> {
  const { data, error } = await client
    .from('daily_nutrition')
    .select('*')
    .gte('consumed_on', from)
    .lte('consumed_on', to)
    .order('consumed_on');
  if (error) throw error;
  return (data ?? []).map((r: Row) => ({
    date: String(r.consumed_on),
    entryCount: Number(r.entry_count),
    itemCount: Number(r.item_count),
    nutrients: nutrientsFromRow(r),
    hasEstimates: r.has_estimates === true,
  }));
}

export interface RecentFood {
  foodKind: DiaryItem['foodKind'];
  genericFoodId: string | null;
  productId: string | null;
  displayName: string;
  amount: number;
  quantityLabel: string | null;
  basis: Basis;
  per100: NutrientValues;
}

export async function recentFoods(client: SupabaseClient, limit = 12): Promise<RecentFood[]> {
  const { data, error } = await client.rpc('recent_foods', { lim: limit });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    foodKind: r.food_kind as RecentFood['foodKind'],
    genericFoodId: (r.generic_food_id as string | null) ?? null,
    productId: (r.product_id as string | null) ?? null,
    displayName: String(r.display_name),
    amount: Number(r.amount),
    quantityLabel: (r.quantity_label as string | null) ?? null,
    basis: r.basis === '100ml' ? '100ml' : '100g',
    per100: nutrientsFromJson(r.per100),
  }));
}
