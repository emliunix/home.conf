/**
 * Runs a pure DML program in the DeepClause runtime and returns its `answer/1` text.
 *
 * The engine never lets the runtime reach a judge or an LLM: rounds of judge requests
 * are made by `oracles.ts` against the caller's backend, and the answers enter the
 * Prolog program as data. Every program here is therefore pure Prolog, and the SDK is
 * configured so that any judge or LLM call fails.
 */

import { createDeepClause, type JudgeBackend } from "deepclause-sdk";

import { BlockedError } from "../types.js";

const REJECTING_LLM = {
  complete: (): Promise<never> => Promise.reject(new Error("LLM fallback is disabled")),
};

const REJECTING_JUDGE: JudgeBackend = {
  id: "disabled",
  capabilities: {
    calibrated: false, probability: false, confidence: false, independentQuestions: false, batch: false,
    structuredCriteria: false, maxQuestions: 0, maxOptions: 0, maxLevels: 0, stateTokenBudget: 0,
  },
  complete: () => Promise.reject(new Error("the evaluation program may not call the judge")),
};

/** Refuses a program that names any capability beyond pure Prolog (strings are ignored). */
export function assertRestrictedDml(source: string): void {
  const executable = source.replace(/"(?:\\.|[^"\\])*"/g, '""');
  const prohibited = ["task(", "prompt(", "exec(", "consult(", "use_module(", "read_file(", "write_file(", "http_get(", "http_post("];
  const found = prohibited.find((token) => executable.includes(token));
  if (found !== undefined) {
    throw new Error(`generated DML contains prohibited capability: ${found}`);
  }
}

export async function runPureDml(source: string): Promise<string> {
  assertRestrictedDml(source);
  const sdk = await createDeepClause({
    model: "disabled",
    llmBackend: REJECTING_LLM,
    judgeBackend: REJECTING_JUDGE,
    judgeBackends: { disabled: REJECTING_JUDGE },
    defaultJudge: "disabled",
  });
  sdk.setToolPolicy({ mode: "whitelist", tools: [] });
  let answer: string | undefined;
  let failure: string | undefined;
  try {
    for await (const event of sdk.runDML(source, { gasLimit: -1 })) {
      if (event.type === "answer") {
        answer = event.content ?? "";
      } else if (event.type === "tool_call") {
        failure = "the evaluation program attempted tool execution";
      } else if (event.type === "error") {
        failure = `Prolog evaluation failed: ${event.content ?? "unknown error"}`;
      }
    }
  } finally {
    await sdk.dispose();
  }
  if (failure !== undefined) {
    throw new BlockedError(failure);
  }
  if (answer === undefined) {
    throw new BlockedError("Prolog evaluation returned no answer");
  }
  return answer;
}
