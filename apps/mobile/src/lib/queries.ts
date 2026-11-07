import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, localDateString, type ConsentType, type OnboardingAnswers } from '@repo/core';
import {
  dailyTotals,
  deleteEntry,
  deleteItem,
  getCurrentTarget,
  getProfile,
  latestConsents,
  listEntries,
  listWeights,
  logWeight,
  recentFoods,
  recordConsent,
  saveMeal,
  saveOnboarding,
  setTarget,
  updateEntry,
  updateItemAmount,
  type NewMeal,
  type TargetRow,
} from '@repo/data';
import { apiClient } from './api';
import { useSession } from './session';
import { supabase } from './supabase';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

export const today = () => localDateString(new Date());

function useUserScope() {
  const { userId, status } = useSession();
  return { userId, enabled: status === 'ready' && !!userId };
}

export function useProfile() {
  const { userId, enabled } = useUserScope();
  return useQuery({ queryKey: ['profile', userId], queryFn: () => getProfile(supabase()), enabled });
}

export function useTarget(date: string) {
  const { userId, enabled } = useUserScope();
  return useQuery({ queryKey: ['target', userId, date], queryFn: () => getCurrentTarget(supabase(), date), enabled });
}

export function useDiary(date: string) {
  const { userId, enabled } = useUserScope();
  return useQuery({ queryKey: ['diary', userId, date], queryFn: () => listEntries(supabase(), date), enabled });
}

export function useTotals(from: string, to: string) {
  const { userId, enabled } = useUserScope();
  return useQuery({ queryKey: ['totals', userId, from, to], queryFn: () => dailyTotals(supabase(), from, to), enabled });
}

export function useWeights(days = 90) {
  const { userId, enabled } = useUserScope();
  const to = today();
  const from = addDays(to, -days);
  return useQuery({ queryKey: ['weights', userId, from], queryFn: () => listWeights(supabase(), from, to), enabled });
}

export function useRecentFoods() {
  const { userId, enabled } = useUserScope();
  return useQuery({ queryKey: ['recent', userId], queryFn: () => recentFoods(supabase(), 12), enabled });
}

export function useConsents() {
  const { userId, enabled } = useUserScope();
  return useQuery({ queryKey: ['consents', userId], queryFn: () => latestConsents(supabase()), enabled });
}

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: () => apiClient().health(), staleTime: 5 * 60_000 });
}

function useInvalidateDiary() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['diary'] }),
      qc.invalidateQueries({ queryKey: ['totals'] }),
      qc.invalidateQueries({ queryKey: ['recent'] }),
    ]);
}

export function useSaveMeal() {
  const invalidate = useInvalidateDiary();
  return useMutation({ mutationFn: (meal: NewMeal) => saveMeal(supabase(), meal), onSuccess: invalidate });
}

export function useUpdateItem() {
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: (v: { id: string; amount: number; label: string | null }) => updateItemAmount(supabase(), v.id, v.amount, v.label),
    onSuccess: invalidate,
  });
}

export function useDeleteItem() {
  const invalidate = useInvalidateDiary();
  return useMutation({ mutationFn: (id: string) => deleteItem(supabase(), id), onSuccess: invalidate });
}

export function useDeleteEntry() {
  const invalidate = useInvalidateDiary();
  return useMutation({ mutationFn: (id: string) => deleteEntry(supabase(), id), onSuccess: invalidate });
}

export function useUpdateEntry() {
  const invalidate = useInvalidateDiary();
  return useMutation({
    mutationFn: (v: { id: string; mealType?: NewMeal['mealType']; consumedOn?: string }) => updateEntry(supabase(), v.id, v),
    onSuccess: invalidate,
  });
}

export function useSaveOnboarding() {
  const qc = useQueryClient();
  const { userId } = useSession();
  return useMutation({
    mutationFn: (answers: OnboardingAnswers) => saveOnboarding(supabase(), userId!, answers, today()),
    onSuccess: async () => {
      // Refetch inactive queries too, so Today never reads the pre-onboarding profile.
      await qc.refetchQueries({ queryKey: ['profile'], type: 'all' });
      await qc.invalidateQueries();
    },
  });
}

export function useSetTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target: Omit<TargetRow, 'method'>) => setTarget(supabase(), { ...target, method: 'user_defined' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['target'] }),
  });
}

export function useRecordConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { type: ConsentType; granted: boolean }) => recordConsent(supabase(), v.type, v.granted),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consents'] }),
  });
}

export function useLogWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { date: string; weightKg: number }) => logWeight(supabase(), v.date, v.weightKg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weights'] }),
  });
}
