import 'server-only';
import { createAnthropicProvider, createHttpTranscriptionProvider, type StructuredProvider, type TranscriptionProvider } from '@repo/ai';
import { env } from './env';

let structured: StructuredProvider | null = null;
let transcription: TranscriptionProvider | null = null;

export function aiProvider(): StructuredProvider {
  if (!structured) {
    const e = env();
    structured = createAnthropicProvider({
      apiKey: e.ANTHROPIC_API_KEY,
      models: {
        vision: e.AI_MODEL_VISION,
        extraction: e.AI_MODEL_EXTRACTION,
        classification: e.AI_MODEL_CLASSIFICATION,
        conversation: e.AI_MODEL_CONVERSATION,
      },
      effort: {
        vision: e.AI_EFFORT_VISION,
        extraction: e.AI_EFFORT_EXTRACTION,
        classification: e.AI_EFFORT_CLASSIFICATION,
        conversation: e.AI_EFFORT_CONVERSATION,
      },
      fallbacks: e.AI_FALLBACKS === 'default',
    });
  }
  return structured;
}

export function transcriptionProvider(): TranscriptionProvider {
  if (!transcription) {
    const e = env();
    transcription = createHttpTranscriptionProvider({
      url: e.TRANSCRIPTION_API_URL,
      apiKey: e.TRANSCRIPTION_API_KEY,
      model: e.TRANSCRIPTION_MODEL,
    });
  }
  return transcription;
}
