import { AiError } from '@repo/ai';
import { transcriptionProvider } from '@/server/ai';
import { requireConsent } from '@/server/consent';
import { handler, json, preferredLocale } from '@/server/http';
import { aiFailure, enforceQuota, recordUsage } from '@/server/quota';
import { requireUser } from '@/server/supabase';
import { readAudio, readForm } from '@/server/uploads';

export const maxDuration = 60;

export const POST = handler(async (request: Request) => {
  const { user } = await requireUser(request);
  const provider = transcriptionProvider();
  if (!provider.isConfigured()) throw aiFailure(new AiError('not_configured', 'Transcription provider missing'));
  await requireConsent(user.id, 'ai_processing');
  const { blob, filename } = await readAudio(await readForm(request));
  await enforceQuota(user.id, 'transcribe');
  try {
    const result = await provider.transcribe(blob, { filename, language: preferredLocale(request) });
    await recordUsage(user.id, 'transcribe', 'ok', result.usage);
    return json({ text: result.text, language: result.language });
  } catch (error) {
    await recordUsage(user.id, 'transcribe', 'error');
    throw aiFailure(error);
  }
});
