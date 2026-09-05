import { buildTier2CasePrompt, type FrozenPrompt } from "./prompt.ts";
import { readApiConfig, type ApiConfig } from "./env.ts";
import {
  SUBMIT_DECISION_TOOL,
  parseDecision,
  type CaseOutcome,
} from "./decision.ts";

export interface UsageMetrics {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly cached_tokens: number;
}

export interface AgentResult {
  readonly outcome: CaseOutcome;
  readonly promptHash: string;
  readonly usage: UsageMetrics;
  readonly latencyMs: number;
}

interface ToolCall {
  readonly id: string;
  readonly type: "function";
  readonly function: { readonly name: string; readonly arguments: string };
}

interface ChatPayload {
  readonly choices?: Array<{
    readonly message?: {
      readonly content?: unknown;
      readonly tool_calls?: readonly ToolCall[];
    };
  }>;
  readonly error?: { readonly message?: string };
  readonly usage?: unknown;
}

function chatCompletionsUrl(baseUrl: string): string {
  return baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function usageMetrics(usage: unknown): UsageMetrics {
  const record = usage !== null && typeof usage === "object" ? (usage as Record<string, unknown>) : {};
  const details =
    record.prompt_tokens_details !== null && typeof record.prompt_tokens_details === "object"
      ? (record.prompt_tokens_details as Record<string, unknown>)
      : {};

  return Object.freeze({
    prompt_tokens: numberOrZero(record.prompt_tokens),
    completion_tokens: numberOrZero(record.completion_tokens),
    cached_tokens: numberOrZero(details.cached_tokens),
  });
}

function outcomeFromToolCalls(toolCalls: readonly ToolCall[]): CaseOutcome {
  if (toolCalls.length === 0) return { kind: "missing_submit" };
  if (toolCalls.length !== 1 || toolCalls[0]?.function.name !== "submit_decision") {
    return { kind: "extra_tool" };
  }

  const parsed = parseDecision(toolCalls[0].function.arguments);
  if (parsed.kind === "invalid_arguments") return { kind: "invalid_arguments" };
  return { kind: "ok", decision: parsed.decision };
}

export async function askAgent(
  frozen: FrozenPrompt,
  fixture: string,
  question: string,
  config: ApiConfig = readApiConfig(),
): Promise<AgentResult> {
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(chatCompletionsUrl(config.baseUrl), {
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
          { role: "user", content: buildTier2CasePrompt(fixture, question) },
        ],
        tools: [SUBMIT_DECISION_TOOL],
        tool_choice: { type: "function", function: { name: "submit_decision" } },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    const className = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network";
    const outcome: CaseOutcome = { kind: "api_error", class: className };
    return Object.freeze({
      outcome,
      promptHash: frozen.hash,
      usage: usageMetrics(undefined),
      latencyMs: Date.now() - started,
    });
  }

  const payload = (await response.json()) as ChatPayload;
  const usage = usageMetrics(payload.usage);
  const latencyMs = Date.now() - started;

  if (!response.ok) {
    const outcome: CaseOutcome = { kind: "api_error", class: "http" };
    return Object.freeze({
      outcome,
      promptHash: frozen.hash,
      usage,
      latencyMs,
    });
  }

  const toolCalls = payload.choices?.[0]?.message?.tool_calls ?? [];
  return Object.freeze({
    outcome: outcomeFromToolCalls(toolCalls),
    promptHash: frozen.hash,
    usage,
    latencyMs,
  });
}
