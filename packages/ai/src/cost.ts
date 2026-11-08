/**
 * Price list used only to estimate and report AI spend (USD per million
 * tokens, Claude API standard rates, November 2026; Claude Haiku 5.5 is the
 * ≤100K-token prompt rate). Check the live pricing page before budgeting.
 */
export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

/** Images are roughly (width × height) / 750 tokens. */
export function imageTokens(width: number, height: number): number {
  return Math.ceil((width * height) / 750);
}

/** Estimated cost of one call; null for an unknown model or missing usage. */
export function estimateCostUsd(model: string | null, inputTokens: number | null, outputTokens: number | null): number | null {
  const price = model ? MODEL_PRICES_USD_PER_MTOK[model] : undefined;
  if (!price || inputTokens == null || outputTokens == null) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
