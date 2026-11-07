import type { z } from 'zod';

/**
 * Provider-agnostic contracts. Server-only: never import this package from
 * client bundles (it reads secrets and calls paid APIs).
 */

export type AiTask = 'vision' | 'extraction' | 'classification' | 'conversation';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  /** Base64 without data-URI prefix. */
  data: string;
}

export interface StructuredRequest<S extends z.ZodType> {
  task: AiTask;
  /** `stable` is identical across requests (cacheable); `dynamic` varies. */
  system: { stable: string; dynamic?: string };
  user: { text: string; images?: ImageInput[] };
  schema: S;
  maxTokens?: number;
  effort?: Effort;
}

export interface AiUsage {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  latencyMs: number;
}

export interface StructuredProvider {
  readonly id: string;
  isConfigured(): boolean;
  modelFor(task: AiTask): string;
  generate<S extends z.ZodType>(req: StructuredRequest<S>): Promise<{ data: z.infer<S>; usage: AiUsage }>;
}

export interface TranscriptionResult {
  text: string;
  language: string | null;
  usage: AiUsage;
}

export interface TranscriptionProvider {
  readonly id: string;
  isConfigured(): boolean;
  transcribe(audio: Blob, opts: { filename: string; language?: 'es' | 'en' }): Promise<TranscriptionResult>;
}

/* --------------------------------- errors -------------------------------- */

export class AiError extends Error {
  constructor(
    readonly code: 'not_configured' | 'refused' | 'invalid_output' | 'upstream' | 'rate_limited',
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export const notConfigured = (what: string) => new AiError('not_configured', `${what} is not configured`);
