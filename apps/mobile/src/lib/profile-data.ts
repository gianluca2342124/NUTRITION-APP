import { useQuery } from '@tanstack/react-query';
import type { Allergen } from '@repo/core';
import { useSession } from './session';
import { supabase } from './supabase';

export interface HealthProfile {
  birthYear: number | null;
  sex: 'female' | 'male' | 'unspecified' | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  activity: string | null;
  allergies: Allergen[];
}

/** Health data only exists when the user consented; otherwise null. */
export function useHealthProfile() {
  const { userId, status } = useSession();
  return useQuery({
    queryKey: ['health-profile', userId],
    enabled: status === 'ready' && !!userId,
    queryFn: async (): Promise<HealthProfile | null> => {
      const { data, error } = await supabase()
        .from('health_profiles')
        .select('birth_year, sex, height_cm, weight_kg, target_weight_kg, activity_level, allergies')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const num = (v: unknown) => (v == null ? null : Number(v));
      return {
        birthYear: num(data.birth_year),
        sex: data.sex,
        heightCm: num(data.height_cm),
        weightKg: num(data.weight_kg),
        targetWeightKg: num(data.target_weight_kg),
        activity: data.activity_level,
        allergies: (data.allergies ?? []) as Allergen[],
      };
    },
  });
}
