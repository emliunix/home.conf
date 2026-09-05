import { describeTask, expect } from "vieval";

import { askAgent } from "../src/eval/agent.ts";
import { compareDecision, formatDivergences } from "../src/eval/decision.ts";
import { projectEnv, readApiConfig } from "../src/eval/env.ts";
import {
  FROZEN_EVALUATION_CONTEXT,
  assertFrozenPromptLock,
  createFrozenPrompt,
  readFrozenPromptLock,
} from "../src/eval/prompt.ts";
import { decisionCases } from "../src/eval/qa.ts";

const frozenPrompt = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
assertFrozenPromptLock(frozenPrompt, readFrozenPromptLock());
const apiConfig = readApiConfig(projectEnv());

describeTask("flow-skills-qa", ({ casesFromInputs }) => {
  casesFromInputs(
    "qa",
    decisionCases,
    async (context) => {
      const result = await askAgent(
        frozenPrompt,
        context.matrix.inputs.fixture,
        context.matrix.inputs.question,
        apiConfig,
      );

      context.metric("promptHash", result.promptHash);
      context.metric("prompt_tokens", result.usage.prompt_tokens);
      context.metric("completion_tokens", result.usage.completion_tokens);
      context.metric("cached_tokens", result.usage.cached_tokens);
      context.metric("latencyMs", result.latencyMs);
      context.metric("outcome", result.outcome.kind);

      expect(result.outcome.kind).toBe("ok");
      if (result.outcome.kind !== "ok") return;

      const divergences = compareDecision(context.matrix.inputs.expected, result.outcome.decision);
      context.metric("divergences", formatDivergences(divergences));
      expect(divergences).toEqual([]);
    },
    {
      concurrency: 4,
    },
  );
});
