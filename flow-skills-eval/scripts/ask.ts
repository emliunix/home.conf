import { FROZEN_EVALUATION_CONTEXT, createFrozenPrompt } from "../src/eval/prompt.ts";
import { runDecisionCase } from "../src/eval/agent.ts";
import { readApiConfig } from "../src/eval/env.ts";

const question = process.argv.slice(2).join(" ");
if (!question) {
  console.error('usage: node --experimental-strip-types scripts/ask.ts "<question>"');
  process.exit(2);
}

const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
const config = readApiConfig();
const result = await runDecisionCase(frozen, { fixture: "", question }, config);

console.log(
  JSON.stringify(
    {
      model: config.model,
      question,
      decision: result.decision,
      rawArguments: result.rawArguments,
      usage: result.usage,
      latencyMs: result.latencyMs,
    },
    null,
    2,
  ),
);
