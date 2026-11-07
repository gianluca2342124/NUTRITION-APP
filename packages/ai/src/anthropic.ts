import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { AiError, notConfigured, type AiTask, type Effort, type StructuredProvider, type StructuredRequest } from './provider';

export interface AnthropicProviderConfig {
  apiKey?: string;
  models: Record<AiTask, string>;
  effort: Record<AiTask, Effort>;
  /** Server-side refusal fallback ("default" routing). Disable only if unsupported. */
  fallbacks: boolean;
  timeoutMs?: number;
}

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

/**
 * Claude adapter using structured outputs (`output_config.format`).
 * Thinking is left at the model default (adaptive); depth is controlled with
 * `effort`, which is set explicitly per task.
 */
export function createAnthropicProvider(cfg: AnthropicProviderConfig): StructuredProvider {
  const client = cfg.apiKey
    ? new Anthropic({ apiKey: cfg.apiKey, timeout: cfg.timeoutMs ?? 90_000, maxRetries: 1 })
    : null;

  return {
    id: 'anthropic',
    isConfigured: () => client !== null,
    modelFor: (task) => cfg.models[task],
    async generate<S extends z.ZodType>(req: StructuredRequest<S>) {
      if (!client) throw notConfigured('Anthropic API');
      const model = cfg.models[req.task];
      const started = Date.now();

      const content: Anthropic.Beta.BetaContentBlockParam[] = [
        ...(req.user.images ?? []).map(
          (img): Anthropic.Beta.BetaImageBlockParam => ({
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType, data: img.data },
          }),
        ),
        { type: 'text', text: req.user.text },
      ];
      const system: Anthropic.Beta.BetaTextBlockParam[] = [
        { type: 'text', text: req.system.stable, cache_control: { type: 'ephemeral' } },
      ];
      if (req.system.dynamic) system.push({ type: 'text', text: req.system.dynamic });

      try {
        const response = await client.beta.messages.parse({
          model,
          max_tokens: req.maxTokens ?? 16_000,
          ...(cfg.fallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          system,
          messages: [{ role: 'user', content }],
          output_config: { format: betaZodOutputFormat(req.schema), effort: req.effort ?? cfg.effort[req.task] },
        });

        if (response.stop_reason === 'refusal') {
          throw new AiError('refused', `Request declined (${response.stop_details?.category ?? 'unspecified'})`);
        }
        if (response.stop_reason === 'max_tokens') throw new AiError('invalid_output', 'Model output was truncated');
        if (response.parsed_output == null) throw new AiError('invalid_output', 'Model output did not match the schema');

        return {
          data: response.parsed_output as z.infer<S>,
          usage: {
            provider: 'anthropic',
            model: response.model ?? model,
            inputTokens: response.usage?.input_tokens ?? null,
            outputTokens: response.usage?.output_tokens ?? null,
            cacheReadTokens: response.usage?.cache_read_input_tokens ?? null,
            latencyMs: Date.now() - started,
          },
        };
      } catch (error) {
        if (error instanceof AiError) throw error;
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          throw new AiError('not_configured', 'Anthropic credentials were rejected');
        }
        if (error instanceof Anthropic.RateLimitError) throw new AiError('rate_limited', 'AI provider rate limit reached');
        if (error instanceof Anthropic.BadRequestError) throw new AiError('invalid_output', `AI request rejected: ${error.message}`);
        if (error instanceof Anthropic.APIError) throw new AiError('upstream', `AI provider error (${error.status ?? 'network'})`);
        throw new AiError('upstream', error instanceof Error ? error.message : 'Unknown AI error');
      }
    },
  };
}
