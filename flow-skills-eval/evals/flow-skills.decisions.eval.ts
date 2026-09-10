import { describeTask, expect } from "vieval";

import { runDecisionCase } from "../src/eval/agent.ts";
import { projectEnv, readApiConfig, readProfile } from "../src/eval/env.ts";
import { WARMUP_CASE, casesForProfile } from "../src/eval/cases.ts";
import { compareDecision } from "../src/eval/decisions.ts";
import { checkCacheObservability, extractUsageMetrics } from "../src/eval/metrics.ts";
import {
  FROZEN_EVALUATION_CONTEXT,
  assertFrozenPromptLock,
  createFrozenPrompt,
  readFrozenPromptLock,
} from "../src/eval/prompt.ts";

const frozenPrompt = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
assertFrozenPromptLock(frozenPrompt, readFrozenPromptLock());
const apiConfig = readApiConfig(projectEnv());
const profile = readProfile(projectEnv());
const cases = casesForProfile(profile);

// Run-level cache observability accumulator. Each scored case appends its
// normalized cache-read token count (undefined when the provider omits the
// field). A final cache-observability case reads this state because vieval's
// describeTask DSL exposes no dedicated afterAll/afterRun hook.
const scoredCaseCacheReads: (number | undefined)[] = [];

let resolveWarmupDone: (() => void) | undefined;
const warmupDone = new Promise<void>((resolve) => {
  resolveWarmupDone = resolve;
});

let pendingScoredCases = cases.length;
let resolveScoredCasesDone: (() => void) | undefined;
const scoredCasesDone = new Promise<void>((resolve) => {
  resolveScoredCasesDone = resolve;
});

function markScoredCaseDone(): void {
  pendingScoredCases -= 1;
  if (pendingScoredCases === 0) resolveScoredCasesDone?.();
}

// L2 (sandboxed end-to-end against a temp-dir fixture repo) is release-level
// and intentionally not built yet — see design/01-fact-based-eval.md.

describeTask("flow-skill-decisions", ({ caseOf, casesFromInputs }) => {
  // One unscored warm-up call primes the provider prefix cache before any scored
  // case runs. Its usage and latency are emitted as diagnostic metrics.
  caseOf("warmup", async (context) => {
    try {
      const result = await runDecisionCase(frozenPrompt, WARMUP_CASE, apiConfig);
      const usage = extractUsageMetrics(result.usage);

      context.metric("warmup_prompt_tokens", usage.promptTokens ?? -1);
      context.metric("warmup_completion_tokens", usage.completionTokens ?? -1);
      context.metric("warmup_cached_tokens", usage.cachedTokens ?? -1);
      context.metric("warmup_latency_ms", result.latencyMs);
      context.score(1, "exact");
    } finally {
      // Always unblock scored cases, even if the warm-up probe itself fails, so
      // the run fails fast instead of hanging.
      resolveWarmupDone?.();
    }
  });

  casesFromInputs(
    "decision",
    cases,
    async (context) => {
      // Wait for the warm-up probe to finish before launching scored work. The
      // warm-up is registered as the first case and has no concurrency limit, so
      // this await normally resolves immediately; it guards against the
      // scheduler overlapping case starts.
      await warmupDone;

      try {
        const decisionCase = context.matrix.inputs;
        const result = await runDecisionCase(frozenPrompt, decisionCase, apiConfig);
        const comparison = compareDecision(decisionCase.expected, result.decision);
        const usage = extractUsageMetrics(result.usage);

        context.metric("promptHash", result.promptHash);
        context.metric("prompt_tokens", usage.promptTokens ?? -1);
        context.metric("completion_tokens", usage.completionTokens ?? -1);
        context.metric("cached_tokens", usage.cachedTokens ?? -1);
        context.metric("latency_ms", result.latencyMs);
        context.metric("diverged_fields", comparison.divergedFields.join(",") || "none");
        context.score(comparison.score, "exact");

        scoredCaseCacheReads.push(usage.cachedTokens);

        expect(comparison.divergedFields).toEqual([]);
      } finally {
        markScoredCaseDone();
      }
    },
    {
      concurrency: 8,
    },
  );

  // Run-level cache observability check. Per-case ordering is meaningless under
  // concurrency-8 scheduling, so the assertion is run-level: if the provider
  // exposed the cache-read field, at least one scored case must have observed a
  // nonzero cache read. If the provider omitted the field, warn and skip
  // enforcement — a missing field is never coerced to a failing zero.
  caseOf("cache-observability", async (context) => {
    await scoredCasesDone;

    const { fieldObserved, nonzeroObserved } = checkCacheObservability(scoredCaseCacheReads);

    context.metric("cache_field_observed", fieldObserved ? 1 : 0);
    context.metric("nonzero_cache_observed", nonzeroObserved ? 1 : 0);
    context.metric("scored_cases_observed", scoredCaseCacheReads.length);

    if (!fieldObserved) {
      console.warn(
        "[flow-skill-decisions] Provider did not expose cache-read tokens; skipping cache enforcement.",
      );
      context.score(1, "exact");
      return;
    }

    expect(nonzeroObserved).toBe(true);
    context.score(1, "exact");
  });
});
