import { randomUUID } from 'node:crypto';
import { AiError, MealPhotoFormat, PROMPT_VERSIONS, mealPhotoSystemPrompt, sanitizeMealPhoto } from '@repo/ai';
import { MealPhotoModelOutputSchema, type MealPhotoModelOutput } from '@repo/core';
import { aiProvider } from '@/server/ai';
import { catalogIndex, supabaseCatalog } from '@/server/catalog';
import { requireConsent } from '@/server/consent';
import { buildPhotoDraft } from '@/server/drafts';
import { ApiFailure, handler, json, preferredLocale } from '@/server/http';
import { aiFailure, enforceQuota, recordUsage } from '@/server/quota';
import { requireUser, serviceClient } from '@/server/supabase';
import { readForm, readImage } from '@/server/uploads';

export const maxDuration = 90;

export const POST = handler(async (request: Request) => {
  const { user } = await requireUser(request);
  const provider = aiProvider();
  if (!provider.isConfigured()) throw aiFailure(new AiError('not_configured', 'AI provider missing'));
  await requireConsent(user.id, 'ai_processing');
  const locale = preferredLocale(request);
  const image = await readImage(await readForm(request));
  const db = serviceClient();

  const { data: hit, error: cacheError } = await db
    .from('ai_analyses')
    .select('id, result')
    .eq('user_id', user.id)
    .eq('feature', 'meal_photo')
    .eq('input_hash', image.sha256)
    .eq('prompt_version', PROMPT_VERSIONS.mealPhoto)
    .maybeSingle();
  if (cacheError) throw cacheError;

  let output: MealPhotoModelOutput;
  let draftId: string;
  const cached = !!hit && MealPhotoModelOutputSchema.safeParse(hit.result).success;
  if (hit && cached) {
    output = MealPhotoModelOutputSchema.parse(hit.result);
    draftId = hit.id;
    await recordUsage(user.id, 'meal_photo', 'cached');
  } else {
    await enforceQuota(user.id, 'meal_photo');
    try {
      const { data, usage } = await provider.generate({
        task: 'vision',
        system: { stable: mealPhotoSystemPrompt(await catalogIndex()) },
        user: { text: 'Analyse the meal in this photo.', images: [image] },
        schema: MealPhotoFormat,
        maxTokens: 16_000,
      });
      output = sanitizeMealPhoto(data);
      await recordUsage(user.id, 'meal_photo', 'ok', usage);
    } catch (error) {
      await recordUsage(user.id, 'meal_photo', error instanceof AiError && error.code === 'refused' ? 'rejected' : 'error');
      throw aiFailure(error);
    }
    const { data: saved, error } = await db
      .from('ai_analyses')
      .upsert(
        {
          user_id: user.id,
          feature: 'meal_photo',
          input_hash: image.sha256,
          prompt_version: PROMPT_VERSIONS.mealPhoto,
          model: provider.modelFor('vision'),
          result: output,
        },
        { onConflict: 'user_id,feature,input_hash,prompt_version' },
      )
      .select('id')
      .single();
    if (error) console.error('[meal-photo] cache write failed', error.message);
    draftId = saved?.id ?? randomUUID();
  }

  if (!output.is_food && output.items.length === 0 && output.image_issue === 'none') {
    throw new ApiFailure(422, 'ai_failed', 'No food was recognised in this photo.');
  }
  const draft = await buildPhotoDraft({ output, locale, catalog: supabaseCatalog(), draftId, cached });
  return json(draft);
});
