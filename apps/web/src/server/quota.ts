import 'server-only';
import { AiError, type AiUsage } from '@repo/ai';
import { env } from './env';
import { ApiFailure } from './http';
import { serviceClient } from './supabase';

export type AiFeature = 'meal_photo' | 'label' | 'parse_meal' | 'transcribe';

function dailyLimit(feature: AiFeature): number {
  const e = env();
  switch (feature) {
    case 'meal_photo':
      return e.AI_DAILY_LIMIT_MEAL_PHOTO;
    case 'label':
      return e.AI_DAILY_LIMIT_LABEL;
    case 'parse_meal':
      return e.AI_DAILY_LIMIT_PARSE_MEAL;
    case 'transcribe':
      return e.AI_DAILY_LIMIT_TRANSCRIBE;
  }
}

/** Per-user rolling 24 h quota. Cached results do not count. */
export async function enforceQuota(userId: string, feature: AiFeature): Promise<void> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count, error } = await serviceClient()
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', feature)
    .in('status', ['ok', 'error'])
    .gte('created_at', since);
  if (error) throw error;
  if ((count ?? 0) >= dailyLimit(feature)) {
    throw new ApiFailure(429, 'quota_exceeded', 'Daily limit reached for this feature. It resets within 24 hours.');
  }
}

export async function recordUsage(
  userId: string,
  feature: AiFeature,
  status: 'ok' | 'error' | 'rejected' | 'cached',
  usage?: AiUsage | null,
): Promise<void> {
  const { error } = await serviceClient().from('ai_usage').insert({
    user_id: userId,
    feature,
    status,
    model: usage?.model ?? null,
    input_tokens: usage?.inputTokens ?? null,
    output_tokens: usage?.outputTokens ?? null,
    latency_ms: usage?.latencyMs ?? null,
  });
  if (error) console.error('[quota] failed to record usage', error.message);
}

/** Maps provider errors to API failures with honest, user-facing messages. */
export function aiFailure(error: unknown): ApiFailure {
  if (error instanceof ApiFailure) return error;
  if (error instanceof AiError) {
    switch (error.code) {
      case 'not_configured':
        return new ApiFailure(503, 'ai_not_configured', 'AI analysis is not available on this server yet.');
      case 'rate_limited':
        return new ApiFailure(429, 'rate_limited', 'The analysis service is busy. Try again shortly.');
      case 'refused':
        return new ApiFailure(422, 'ai_failed', 'This content could not be analysed.');
      case 'invalid_output':
        return new ApiFailure(502, 'ai_failed', 'The analysis did not produce a usable result. Try again or log manually.');
      default:
        return new ApiFailure(502, 'upstream_unavailable', 'The analysis service is temporarily unavailable.');
    }
  }
  return new ApiFailure(500, 'internal', 'Unexpected error during analysis.');
}
