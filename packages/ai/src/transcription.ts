import { AiError, notConfigured, type TranscriptionProvider } from './provider';

export interface HttpTranscriptionConfig {
  /** Full endpoint URL of an OpenAI-compatible `/audio/transcriptions` API. */
  url?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Speech-to-text through any OpenAI-compatible transcription endpoint
 * (multipart `file` + `model`). Claude does not transcribe audio, so this is a
 * separate, optional provider; without it the apps fall back to typed input.
 */
export function createHttpTranscriptionProvider(cfg: HttpTranscriptionConfig): TranscriptionProvider {
  const configured = Boolean(cfg.url && cfg.apiKey && cfg.model);
  return {
    id: 'http-transcription',
    isConfigured: () => configured,
    async transcribe(audio, opts) {
      if (!configured) throw notConfigured('Transcription');
      const started = Date.now();
      const form = new FormData();
      form.append('file', audio, opts.filename);
      form.append('model', cfg.model!);
      form.append('response_format', 'json');
      if (opts.language) form.append('language', opts.language);
      let res: Response;
      try {
        res = await fetch(cfg.url!, {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfg.apiKey}` },
          body: form,
          signal: AbortSignal.timeout(cfg.timeoutMs ?? 60_000),
        });
      } catch (e) {
        throw new AiError('upstream', e instanceof Error ? e.message : 'Transcription request failed');
      }
      if (res.status === 401 || res.status === 403) throw new AiError('not_configured', 'Transcription credentials were rejected');
      if (res.status === 429) throw new AiError('rate_limited', 'Transcription rate limit reached');
      if (!res.ok) throw new AiError('upstream', `Transcription error (${res.status})`);
      const json = (await res.json().catch(() => null)) as { text?: unknown; language?: unknown } | null;
      const text = typeof json?.text === 'string' ? json.text.trim() : '';
      return {
        text,
        language: typeof json?.language === 'string' ? json.language : (opts.language ?? null),
        usage: { provider: 'http-transcription', model: cfg.model!, inputTokens: null, outputTokens: null, cacheReadTokens: null, latencyMs: Date.now() - started },
      };
    },
  };
}
