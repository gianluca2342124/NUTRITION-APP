import { randomUUID } from 'node:crypto';
import { AiError, LABEL_SYSTEM_PROMPT, LabelFormat, PROMPT_VERSIONS, sanitizeLabel } from '@repo/ai';
import { LabelModelOutputSchema, type LabelModelOutput } from '@repo/core';
import { aiProvider } from '@/server/ai';
import { requireConsent } from '@/server/consent';
import { buildLabelDraft } from '@/server/drafts';
import { handler, json } from '@/server/http';
import { aiFailure, enforceQuota, recordUsage } from '@/server/quota';
import { requireUser, serviceClient } from '@/server/supabase';
import { readForm, readImage } from '@/server/uploads';

export const maxDuration = 90;

export const POST = handler(async (request: Request) => {
  const { user } = await requireUser(request);
  const provider = aiProvider();
  if (!provider.isConfigured()) throw aiFailure(new AiError('not_configured', 'AI provider missing'));
  await requireConsent(user.id, 'ai_processing');
  const image = await readImage(await readForm(request));
  const db = serviceClient();

  const { data: hit } = await db
    .from('ai_analyses')
    .select('id, result')
    .eq('user_id', user.id)
    .eq('feature', 'label')
    .eq('input_hash', image.sha256)
    .eq('prompt_version', PROMPT_VERSIONS.label)
    .maybeSingle();

  let output: LabelModelOutput;
  let draftId: string;
  if (hit && LabelModelOutputSchema.safeParse(hit.result).success) {
    output = LabelModelOutputSchema.parse(hit.result);
    draftId = hit.id;
    await recordUsage(user.id, 'label', 'cached');
  } else {
    await enforceQuota(user.id, 'label');
    try {
      const { data, usage } = await provider.generate({
        task: 'extraction',
        system: { stable: LABEL_SYSTEM_PROMPT },
        user: { text: 'Read the nutrition information visible on this packaging photo.', images: [image] },
        schema: LabelFormat,
        maxTokens: 16_000,
      });
      output = sanitizeLabel(data);
      await recordUsage(user.id, 'label', 'ok', usage);
    } catch (error) {
      await recordUsage(user.id, 'label', error instanceof AiError && error.code === 'refused' ? 'rejected' : 'error');
      throw aiFailure(error);
    }
    const { data: saved } = await db
      .from('ai_analyses')
      .upsert(
        {
          user_id: user.id,
          feature: 'label',
          input_hash: image.sha256,
          prompt_version: PROMPT_VERSIONS.label,
          model: provider.modelFor('extraction'),
          result: output,
        },
        { onConflict: 'user_id,feature,input_hash,prompt_version' },
      )
      .select('id')
      .single();
    draftId = saved?.id ?? randomUUID();
  }
  return json(buildLabelDraft(output, draftId));
});
