import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import {
  deleteCommunityArticle,
  deleteCommunityRecipe,
  getCommunityArticle,
  getCommunityRecipe,
  getPublicProfile,
  listMyArticles,
  listMyRecipes,
  listPublishedRecipes,
  publicAchievements,
  savePublicProfile,
  signedMediaUrl,
  type MediaBucket,
  type PublicProfile,
} from '@repo/data';
import { uuid } from './ids';
import { prepareImage } from './images';
import { useSession } from './session';
import { supabase } from './supabase';

/** Public profile (only what the person chose to show) and their publications. */
export function usePublicProfile() {
  const { userId, status } = useSession();
  return useQuery({ queryKey: ['public-profile', userId], queryFn: () => getPublicProfile(supabase(), userId!), enabled: status === 'ready' && !!userId });
}

export function useSavePublicProfile() {
  const qc = useQueryClient();
  const { userId } = useSession();
  return useMutation({
    mutationFn: (patch: Partial<Omit<PublicProfile, 'userId'>>) => savePublicProfile(supabase(), userId!, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-profile'] }),
  });
}

export function usePublicAchievements(userId: string | null, enabled: boolean) {
  return useQuery({ queryKey: ['public-achievements', userId], queryFn: () => publicAchievements(supabase(), userId!), enabled: enabled && !!userId });
}

export function useMyRecipes() {
  const { userId, status } = useSession();
  return useQuery({ queryKey: ['my-recipes', userId], queryFn: () => listMyRecipes(supabase(), userId!), enabled: status === 'ready' && !!userId });
}

export function useMyArticles() {
  const { userId, status } = useSession();
  return useQuery({ queryKey: ['my-articles', userId], queryFn: () => listMyArticles(supabase(), userId!), enabled: status === 'ready' && !!userId });
}

/** Approved community recipes (published by a moderator), newest first. */
export function usePublishedRecipes() {
  return useQuery({ queryKey: ['community-published'], queryFn: () => listPublishedRecipes(supabase()), staleTime: 10 * 60_000 });
}

/** Someone else's public profile (null when it is private). */
export function useAuthorProfile(userId: string | undefined) {
  return useQuery({ queryKey: ['author-profile', userId], queryFn: () => getPublicProfile(supabase(), userId!), enabled: !!userId, staleTime: 10 * 60_000 });
}

export function useCommunityRecipe(id: string | undefined) {
  return useQuery({ queryKey: ['community-recipe', id], queryFn: () => getCommunityRecipe(supabase(), id!), enabled: !!id });
}

export function useCommunityArticle(id: string | undefined) {
  return useQuery({ queryKey: ['community-article', id], queryFn: () => getCommunityArticle(supabase(), id!), enabled: !!id });
}

export function useDeletePublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { kind: 'recipe' | 'article'; id: string }) =>
      v.kind === 'recipe' ? deleteCommunityRecipe(supabase(), v.id) : deleteCommunityArticle(supabase(), v.id),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['my-recipes'] }), qc.invalidateQueries({ queryKey: ['my-articles'] })]),
  });
}

/**
 * Private image → signed URL (cached for less than its lifetime). Returns
 * null while loading, without access, or when there is no image.
 */
export function useMediaUrl(bucket: MediaBucket, path: string | null | undefined): string | null {
  const q = useQuery({
    queryKey: ['media', bucket, path],
    enabled: !!path,
    staleTime: 45 * 60_000,
    gcTime: 50 * 60_000,
    retry: 1,
    queryFn: () => signedMediaUrl(supabase(), bucket, path!, 3600),
  });
  return q.data ?? null;
}

/**
 * Lets the person pick a photo from their library, downsizes it and uploads
 * it to their own folder. Returns the storage path, or null if cancelled.
 */
export async function pickAndUpload(bucket: 'avatars' | 'community-media', userId: string, opts: { square?: boolean; maxSide?: number } = {}): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: !!opts.square, aspect: opts.square ? [1, 1] : undefined });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const img = await prepareImage(asset.uri, { width: asset.width, height: asset.height }, opts.maxSide ?? 1440);
  const path = `${userId}/${uuid()}.jpg`;
  const body = await (await fetch(img.uri)).arrayBuffer();
  const { error } = await supabase().storage.from(bucket).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

/** Best-effort cleanup of an image that is no longer used. */
export function removeMedia(bucket: 'avatars' | 'community-media', path: string | null | undefined): void {
  if (path) void supabase().storage.from(bucket).remove([path]).catch(() => undefined);
}
