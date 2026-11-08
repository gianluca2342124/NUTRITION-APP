import type { SupabaseClient } from '@supabase/supabase-js';
import { recipeNutrition, type Basis, type NutrientValues, type RecipeNutrition } from '@repo/core';
import { nutrientsFromRow } from './mappers';

/**
 * Public profile and community publications. The public profile only holds
 * what the person chose to show; publications go through moderation.
 */
export type PublicationStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

export interface PublicProfile {
  userId: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarPath: string | null;
  showAchievements: boolean;
}

type Row = Record<string, unknown>;

function mapProfile(r: Row): PublicProfile {
  return {
    userId: String(r.user_id),
    username: (r.username as string | null) ?? null,
    displayName: (r.display_name as string | null) ?? null,
    bio: (r.bio as string | null) ?? null,
    avatarPath: (r.avatar_path as string | null) ?? null,
    showAchievements: r.show_achievements === true,
  };
}

export async function getPublicProfile(client: SupabaseClient, userId: string): Promise<PublicProfile | null> {
  const { data, error } = await client.from('public_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as Row) : null;
}

export async function savePublicProfile(
  client: SupabaseClient,
  userId: string,
  patch: Partial<Omit<PublicProfile, 'userId'>>,
): Promise<void> {
  const row: Row = { user_id: userId };
  if (patch.username !== undefined) row.username = patch.username ? patch.username.trim().toLowerCase() : null;
  if (patch.displayName !== undefined) row.display_name = patch.displayName?.trim() || null;
  if (patch.bio !== undefined) row.bio = patch.bio?.trim() || null;
  if (patch.avatarPath !== undefined) row.avatar_path = patch.avatarPath;
  if (patch.showAchievements !== undefined) row.show_achievements = patch.showAchievements;
  const { error } = await client.from('public_profiles').upsert(row, { onConflict: 'user_id', defaultToNull: false });
  if (error) throw error;
}

/** Public URL of an image in a public bucket (avatars, community-media). */
export function publicMediaUrl(client: SupabaseClient, bucket: 'avatars' | 'community-media', path: string | null): string | null {
  if (!path) return null;
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export interface PublicAchievement {
  achievement: string;
  earnedAt: string;
}

/** Empty unless the person chose to show their achievements. */
export async function publicAchievements(client: SupabaseClient, userId: string): Promise<PublicAchievement[]> {
  const { data, error } = await client.rpc('public_achievements', { p_user: userId });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({ achievement: String(r.achievement), earnedAt: String(r.earned_at) }));
}

/* ------------------------------------------------------------------ recipes */

export interface CommunityIngredient {
  kind: 'generic_food' | 'product';
  foodId: string;
  label: string;
  grams: number;
  basis: Basis;
  per100: NutrientValues;
}

export interface CommunityRecipe {
  id: string;
  authorId: string;
  title: string;
  summary: string | null;
  imagePath: string | null;
  minutes: number | null;
  servings: number;
  steps: string[];
  status: PublicationStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  ingredients: CommunityIngredient[];
}

const NUTRIENTS = 'basis, energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, salt_g';
const RECIPE_SELECT = `*, community_recipe_ingredients(position, generic_food_id, product_id, grams, label, generic_foods(${NUTRIENTS}), products(${NUTRIENTS}))`;

function embedded(v: unknown): Row | null {
  if (Array.isArray(v)) return (v[0] as Row | undefined) ?? null;
  return v && typeof v === 'object' ? (v as Row) : null;
}

function mapRecipe(r: Row): CommunityRecipe {
  const rows = (Array.isArray(r.community_recipe_ingredients) ? (r.community_recipe_ingredients as Row[]) : []).sort(
    (a, b) => Number(a.position) - Number(b.position),
  );
  return {
    id: String(r.id),
    authorId: String(r.author_id),
    title: String(r.title),
    summary: (r.summary as string | null) ?? null,
    imagePath: (r.image_path as string | null) ?? null,
    minutes: r.minutes == null ? null : Number(r.minutes),
    servings: Number(r.servings ?? 1),
    steps: (r.steps as string[] | null) ?? [],
    status: r.status as PublicationStatus,
    reviewNote: (r.review_note as string | null) ?? null,
    submittedAt: (r.submitted_at as string | null) ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
    updatedAt: String(r.updated_at),
    ingredients: rows.map((i) => {
      const food = embedded(i.generic_foods) ?? embedded(i.products) ?? {};
      return {
        kind: i.generic_food_id ? 'generic_food' : 'product',
        foodId: String(i.generic_food_id ?? i.product_id),
        label: String(i.label),
        grams: Number(i.grams),
        basis: food.basis === '100ml' ? '100ml' : '100g',
        per100: nutrientsFromRow(food),
      };
    }),
  };
}

/** Nutrition from catalogue values only (the author never types numbers). */
export function communityRecipeNutrition(recipe: Pick<CommunityRecipe, 'servings' | 'ingredients'>): RecipeNutrition {
  return recipeNutrition({
    servings: Math.max(1, recipe.servings),
    ingredients: recipe.ingredients.map((i, idx) => ({
      position: idx,
      foodId: i.foodId,
      foodSlug: '',
      foodNameEs: i.label,
      foodNameEn: i.label,
      category: 'other',
      basis: i.basis,
      grams: i.grams,
      labelEs: i.label,
      labelEn: i.label,
      per100: i.per100,
    })),
  });
}

export async function listMyRecipes(client: SupabaseClient, userId: string): Promise<CommunityRecipe[]> {
  const { data, error } = await client.from('community_recipes').select(RECIPE_SELECT).eq('author_id', userId).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapRecipe(r as Row));
}

export async function listPublishedRecipes(client: SupabaseClient, authorId?: string): Promise<CommunityRecipe[]> {
  let q = client.from('community_recipes').select(RECIPE_SELECT).eq('status', 'published');
  if (authorId) q = q.eq('author_id', authorId);
  const { data, error } = await q.order('published_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => mapRecipe(r as Row));
}

export async function getCommunityRecipe(client: SupabaseClient, id: string): Promise<CommunityRecipe | null> {
  const { data, error } = await client.from('community_recipes').select(RECIPE_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRecipe(data as Row) : null;
}

export interface RecipeDraft {
  id: string;
  title: string;
  summary: string | null;
  imagePath: string | null;
  minutes: number | null;
  servings: number;
  steps: string[];
  ingredients: { kind: 'generic_food' | 'product'; foodId: string; label: string; grams: number }[];
}

/** Saves a draft or sends it to review. Never publishes: moderators do. */
export async function saveCommunityRecipe(client: SupabaseClient, draft: RecipeDraft, submit: boolean): Promise<PublicationStatus> {
  const { data, error } = await client.rpc('save_community_recipe', {
    p_recipe: {
      id: draft.id,
      title: draft.title,
      summary: draft.summary,
      image_path: draft.imagePath,
      minutes: draft.minutes,
      servings: draft.servings,
      steps: draft.steps.map((s) => s.trim()).filter(Boolean),
    },
    p_ingredients: draft.ingredients.map((i) => ({
      generic_food_id: i.kind === 'generic_food' ? i.foodId : null,
      product_id: i.kind === 'product' ? i.foodId : null,
      grams: Math.round(i.grams * 100) / 100,
      label: i.label.slice(0, 120),
    })),
    p_submit: submit,
  });
  if (error) throw error;
  return data as PublicationStatus;
}

export async function deleteCommunityRecipe(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('community_recipes').delete().eq('id', id);
  if (error) throw error;
}

/* ----------------------------------------------------------------- articles */

export interface CommunityArticle {
  id: string;
  authorId: string;
  title: string;
  coverPath: string | null;
  body: string;
  sources: string[];
  status: PublicationStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

function mapArticle(r: Row): CommunityArticle {
  return {
    id: String(r.id),
    authorId: String(r.author_id),
    title: String(r.title),
    coverPath: (r.cover_path as string | null) ?? null,
    body: String(r.body ?? ''),
    sources: (r.sources as string[] | null) ?? [],
    status: r.status as PublicationStatus,
    reviewNote: (r.review_note as string | null) ?? null,
    submittedAt: (r.submitted_at as string | null) ?? null,
    publishedAt: (r.published_at as string | null) ?? null,
    updatedAt: String(r.updated_at),
  };
}

export async function listMyArticles(client: SupabaseClient, userId: string): Promise<CommunityArticle[]> {
  const { data, error } = await client.from('community_articles').select('*').eq('author_id', userId).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapArticle(r as Row));
}

export async function listPublishedArticles(client: SupabaseClient, authorId?: string): Promise<CommunityArticle[]> {
  let q = client.from('community_articles').select('*').eq('status', 'published');
  if (authorId) q = q.eq('author_id', authorId);
  const { data, error } = await q.order('published_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => mapArticle(r as Row));
}

export async function getCommunityArticle(client: SupabaseClient, id: string): Promise<CommunityArticle | null> {
  const { data, error } = await client.from('community_articles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapArticle(data as Row) : null;
}

export interface ArticleDraft {
  id: string;
  title: string;
  coverPath: string | null;
  body: string;
  sources: string[];
}

/** Minimums for review: a real body and at least one source. */
export const ARTICLE_MIN_BODY = 200;

export async function saveCommunityArticle(client: SupabaseClient, draft: ArticleDraft, submit: boolean): Promise<PublicationStatus> {
  const status: PublicationStatus = submit ? 'pending_review' : 'draft';
  const { error } = await client.from('community_articles').upsert(
    {
      id: draft.id,
      title: draft.title.trim(),
      cover_path: draft.coverPath,
      body: draft.body.trim(),
      sources: draft.sources.map((s) => s.trim()).filter(Boolean),
      status,
    },
    { onConflict: 'id', defaultToNull: false },
  );
  if (error) throw error;
  return status;
}

export async function deleteCommunityArticle(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('community_articles').delete().eq('id', id);
  if (error) throw error;
}
