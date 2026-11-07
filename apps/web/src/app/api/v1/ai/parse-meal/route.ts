import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AiError, ParsedLogFormat, parseMealSystemPrompt, parseMealUserText, sanitizeParsedLog } from '@repo/ai';
import { aiProvider } from '@/server/ai';
import { catalogIndex, supabaseCatalog } from '@/server/catalog';
import { requireConsent } from '@/server/consent';
import { buildParsedDraft } from '@/server/drafts';
import { ApiFailure, handler, json, preferredLocale } from '@/server/http';
import { aiFailure, enforceQuota, recordUsage } from '@/server/quota';
import { requireUser } from '@/server/supabase';

export const maxDuration = 60;

const BodySchema = z.object({
  text: z.string().trim().min(2).max(1000),
  source: z.enum(['voice', 'text']).default('text'),
  /** Client's local date, so "ayer" resolves in the user's time zone. */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const POST = handler(async (request: Request) => {
  const { user } = await requireUser(request);
  const provider = aiProvider();
  if (!provider.isConfigured()) throw aiFailure(new AiError('not_configured', 'AI provider missing'));
  await requireConsent(user.id, 'ai_processing');
  const parsedBody = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) throw new ApiFailure(400, 'invalid_input', 'Send { text } with 2–1000 characters.');
  const { text, source } = parsedBody.data;
  const today = parsedBody.data.today ?? new Date().toISOString().slice(0, 10);
  await enforceQuota(user.id, 'parse_meal');

  let output;
  try {
    const { data, usage } = await provider.generate({
      task: 'classification',
      system: { stable: parseMealSystemPrompt(await catalogIndex()) },
      user: { text: parseMealUserText(text, today) },
      schema: ParsedLogFormat,
      maxTokens: 8_000,
    });
    output = sanitizeParsedLog(data);
    await recordUsage(user.id, 'parse_meal', 'ok', usage);
  } catch (error) {
    await recordUsage(user.id, 'parse_meal', error instanceof AiError && error.code === 'refused' ? 'rejected' : 'error');
    throw aiFailure(error);
  }

  const draft = await buildParsedDraft({
    output,
    locale: preferredLocale(request),
    catalog: supabaseCatalog(),
    draftId: randomUUID(),
    source,
    transcript: source === 'voice' ? text : null,
  });
  return json(draft);
});
