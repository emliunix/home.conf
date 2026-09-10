import { buildTier2CasePrompt, type FrozenPrompt } from "./prompt.ts";
import { readApiConfig, type ApiConfig } from "./env.ts";
import {
  NEXT_ACTIONS,
  STATUSES_TO_SET,
  WRITE_TARGETS,
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

/** Provider-enforced Decision schema; the only tool the agent may call. */
const SUBMIT_DECISION_TOOL = {
  type: "function",
  function: {
    name: "submit_decision",
    description: "Submit the single next flow decision for the Tier 2 case.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        next_action: { type: "string", enum: [...NEXT_ACTIONS] },
        status_to_set: { type: "string", enum: [...STATUSES_TO_SET] },
        write_target: { type: "string", enum: [...WRITE_TARGETS] },
        opens_new_design: { type: "boolean" },
      },
      required: ["next_action", "status_to_set", "write_target", "opens_new_design"],
    },
  },
} as const;

function chatCompletionsUrl(baseUrl: string): string {
  return baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
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
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      messages: [
        { role: "system", content: frozen.text },
        { role: "user", content: buildTier2CasePrompt(decisionCase.fixture, decisionCase.question) },
      ],
      tools: [SUBMIT_DECISION_TOOL],
      tool_choice: { type: "function", function: { name: "submit_decision" } },
    }),
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
