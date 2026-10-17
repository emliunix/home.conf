/**
 * Prose probe (design 11 unit 6): the case's frozen prompt, fixture and question,
 * unchanged, with no tool, so the model answers in prose. A diagnostic beside the
 * tuple run, not a substitute: a probe that disagrees with the tool run leaves the
 * case at "1, unconfirmed (probe disagrees)". Usage:
 *   node scripts/prose-probe.ts <case-id> [<case-id> ...]
 */
import { buildRequestBody } from "../src/eval/agent.ts";
import { decisionCases } from "../src/eval/cases.ts";
import { readApiConfig } from "../src/eval/env.ts";
import { FROZEN_EVALUATION_CONTEXT, createFrozenPrompt } from "../src/eval/prompt.ts";

const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
const config = readApiConfig(process.env as Record<string, string>);
for (const id of process.argv.slice(2)) {
  const decisionCase = decisionCases.find((c) => c.id === id);
  if (decisionCase === undefined) throw new Error(`unknown case ${id}`);
  const body = { ...(buildRequestBody(frozen, decisionCase, config) as Record<string, unknown>) };
  delete body.tools;
  delete body.tool_choice;
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  console.log(`### ${id} (${config.model})\n${payload.choices?.[0]?.message?.content ?? "(no content)"}\n`);
}
