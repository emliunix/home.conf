/**
 * Per-case efficiency metrics extracted from the chat-completions response
 * `usage` block. Efficiency is measured, not asserted: these land as Vieval
 * metrics so the prefix-caching claim is visible in the run output.
 */

export interface UsageMetrics {
  readonly promptTokens: number | undefined;
  readonly completionTokens: number | undefined;
  /** Provider cache-read tokens: OpenAI `prompt_tokens_details.cached_tokens` or Anthropic `cache_read_input_tokens`. */
  readonly cachedTokens: number | undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function extractUsageMetrics(usage: Record<string, unknown> | undefined): UsageMetrics {
  if (!usage) {
    return Object.freeze({
      promptTokens: undefined,
      completionTokens: undefined,
      cachedTokens: undefined,
    });
  }

  const promptDetails = usage.prompt_tokens_details as Record<string, unknown> | undefined;
  const cachedTokens =
    asNumber(promptDetails?.cached_tokens) ??
    asNumber(usage.cache_read_input_tokens) ??
    asNumber(usage.cached_tokens);

  return Object.freeze({
    promptTokens: asNumber(usage.prompt_tokens),
    completionTokens: asNumber(usage.completion_tokens),
    cachedTokens,
  });
}

export interface CacheObservability {
  /** True if at least one observation exposed the provider's cache-read field. */
  readonly fieldObserved: boolean;
  /** True if at least one observed cache-read field was nonzero. */
  readonly nonzeroObserved: boolean;
}

/**
 * Run-level cache capability gate. A missing cache-read field across all
 * observations means the provider does not expose prompt-cache telemetry; the
 * run warns and skips enforcement. When the field is exposed, at least one
 * nonzero value must be observed for the prefix-caching claim to hold.
 */
export function checkCacheObservability(
  cacheReads: readonly (number | undefined)[],
): CacheObservability {
  return Object.freeze({
    fieldObserved: cacheReads.some((value) => value !== undefined),
    nonzeroObserved: cacheReads.some((value) => (value ?? 0) > 0),
  });
}
