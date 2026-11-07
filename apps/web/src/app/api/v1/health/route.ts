import type { Health } from '@repo/core';
import { connection } from 'next/server';
import { aiProvider, transcriptionProvider } from '@/server/ai';
import { supabaseConfigured } from '@/server/env';
import { handler, json } from '@/server/http';
import { publicClient } from '@/server/supabase';

/** Honest service status so clients can show what is (not) available. */
export const GET = handler(async () => {
  await connection();
  let database = false;
  if (supabaseConfigured()) {
    const { error } = await publicClient().from('generic_foods').select('id', { head: true, count: 'exact' }).limit(1);
    database = !error;
  }
  const ai = aiProvider().isConfigured();
  const body: Health = {
    ok: database,
    version: '0.1.0',
    services: {
      database,
      openFoodFacts: true,
      aiVision: ai,
      aiText: ai,
      transcription: transcriptionProvider().isConfigured(),
    },
  };
  return json(body);
});
