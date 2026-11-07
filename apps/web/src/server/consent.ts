import 'server-only';
import type { ConsentType } from '@repo/core';
import { ApiFailure } from './http';
import { serviceClient } from './supabase';

/** Requires the latest recorded consent of `type` to be granted. */
export async function requireConsent(userId: string, type: ConsentType): Promise<void> {
  const { data, error } = await serviceClient()
    .from('user_consents')
    .select('granted')
    .eq('user_id', userId)
    .eq('consent_type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.granted) {
    throw new ApiFailure(403, 'forbidden', `Consent "${type}" is required before using this feature.`);
  }
}
