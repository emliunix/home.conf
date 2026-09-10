import { describe, expect, it } from "vite-plus/test";

import { checkCacheObservability, extractUsageMetrics } from "../src/eval/metrics.ts";

describe("extractUsageMetrics", () => {
  it("returns undefined cache tokens when usage is absent", () => {
    const metrics = extractUsageMetrics(undefined);

    expect(metrics.promptTokens).toBeUndefined();
    expect(metrics.completionTokens).toBeUndefined();
    expect(metrics.cachedTokens).toBeUndefined();
  });

  it("extracts OpenAI prompt_tokens_details.cached_tokens", () => {
    const metrics = extractUsageMetrics({
      prompt_tokens: 1000,
      completion_tokens: 50,
      prompt_tokens_details: { cached_tokens: 800 },
    });

    expect(metrics.cachedTokens).toBe(800);
  });

  it("extracts Anthropic cache_read_input_tokens", () => {
    const metrics = extractUsageMetrics({
      prompt_tokens: 1000,
      completion_tokens: 50,
      cache_read_input_tokens: 900,
    });

    expect(metrics.cachedTokens).toBe(900);
  });

  it("prefers OpenAI details over Anthropic field", () => {
    const metrics = extractUsageMetrics({
      prompt_tokens: 1000,
      completion_tokens: 50,
      prompt_tokens_details: { cached_tokens: 700 },
      cache_read_input_tokens: 900,
    });

    expect(metrics.cachedTokens).toBe(700);
  });

  it("leaves cachedTokens undefined when the provider omits the field", () => {
    const metrics = extractUsageMetrics({
      prompt_tokens: 1000,
      completion_tokens: 50,
    });

    expect(metrics.cachedTokens).toBeUndefined();
  });

  it("rejects non-finite cache-read values", () => {
    const metrics = extractUsageMetrics({
      prompt_tokens: 1000,
      completion_tokens: 50,
      prompt_tokens_details: { cached_tokens: NaN },
    });

    expect(metrics.cachedTokens).toBeUndefined();
  });
});

describe("checkCacheObservability", () => {
  it("reports field not observed when every observation is undefined", () => {
    const result = checkCacheObservability([undefined, undefined, undefined]);

    expect(result.fieldObserved).toBe(false);
    expect(result.nonzeroObserved).toBe(false);
  });

  it("reports field observed but no nonzero cache when all reads are zero", () => {
    const result = checkCacheObservability([0, 0, 0]);

    expect(result.fieldObserved).toBe(true);
    expect(result.nonzeroObserved).toBe(false);
  });

  it("reports nonzero observed when at least one read is positive", () => {
    const result = checkCacheObservability([0, undefined, 128, 0]);

    expect(result.fieldObserved).toBe(true);
    expect(result.nonzeroObserved).toBe(true);
  });
});
