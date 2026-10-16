import { buildTier2CasePrompt, type FrozenPrompt } from "./prompt.ts";
import { readApiConfig, type ApiConfig } from "./env.ts";
import {
  SUBMIT_DECISION_TOOL,
  parseDecision,
  type Decision,
  type DecisionCase,
} from "./decisions.ts";

export interface DecisionRunResult {
  readonly decision: Decision;
  /** Raw `submit_decision` arguments, kept for report debugging. */
  readonly rawArguments: string;
  readonly promptHash: string;
  readonly usage?: Record<string, unknown>;
  readonly latencyMs: number;
}

interface ChatPayload {
  readonly choices?: Array<{
    readonly message?: {
      readonly content?: unknown;
      readonly tool_calls?: readonly {
        readonly id: string;
        readonly type: "function";
        readonly function: { readonly name: string; readonly arguments: string };
      }[];
    };
  }>;
  readonly error?: { readonly message?: string };
  readonly usage?: Record<string, unknown>;
}

function chatCompletionsUrl(baseUrl: string): string {
  return baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
}

/** The request body; extra fields come first so the harness's own fields win. */
export function buildRequestBody(
  frozen: FrozenPrompt,
  decisionCase: Pick<DecisionCase, "fixture" | "question">,
  config: ApiConfig,
): Record<string, unknown> {
  return {
    ...config.extraBody,
    model: config.model,
    temperature: 0,
    messages: [
      { role: "system", content: frozen.text },
      { role: "user", content: buildTier2CasePrompt(decisionCase.fixture, decisionCase.question) },
    ],
    tools: [SUBMIT_DECISION_TOOL],
    tool_choice: { type: "function", function: { name: "submit_decision" } },
  };
}

/** What a run records about its configuration, so a score traces to it. No secrets. */
export function runProvenance(config: ApiConfig): { readonly model: string; readonly extra_body_keys: string } {
  return Object.freeze({ model: config.model, extra_body_keys: Object.keys(config.extraBody).sort().join(",") || "none" });
}

/**
 * Run one decision case: exactly one API call with the Decision schema
 * tool-forced. The full skill bodies already live in the Tier 1 system prompt,
 * so no read_skill round-trips exist.
 */
export async function runDecisionCase(
  frozen: FrozenPrompt,
  decisionCase: Pick<DecisionCase, "fixture" | "question">,
  config: ApiConfig = readApiConfig(),
): Promise<DecisionRunResult> {
  const startedAt = performance.now();
  const response = await fetch(chatCompletionsUrl(config.baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(buildRequestBody(frozen, decisionCase, config)),
    signal: AbortSignal.timeout(120_000),
  });
  const latencyMs = Math.round(performance.now() - startedAt);

  const payload = (await response.json()) as ChatPayload;
  if (!response.ok) {
    throw new Error(
      `Agent API request failed (${response.status}): ${payload.error?.message ?? "unknown error"}`,
    );
  }

  const toolCalls = payload.choices?.[0]?.message?.tool_calls ?? [];
  const submitCall = toolCalls.find(
    (call) => call.type === "function" && call.function.name === "submit_decision",
  );
  if (!submitCall) {
    throw new Error("Agent API response did not contain a submit_decision tool call");
  }

  return Object.freeze({
    decision: parseDecision(submitCall.function.arguments),
    rawArguments: submitCall.function.arguments,
    promptHash: frozen.hash,
    usage: payload.usage,
    latencyMs,
  });
}
