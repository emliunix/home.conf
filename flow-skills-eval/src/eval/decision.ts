/**
 * L1 Decision: the single outcome the flow skills prescribe for a fixture.
 * Actual values come only from submit_decision. Expected values are corpus data.
 */

export const NEXT_ACTIONS = [
  "implement",
  "remediate",
  "open_new_design",
  "run_retro",
  "set_status",
  "halt_structural",
  "reject_finding",
] as const;

export const STATUS_WORDS = ["draft", "reviewed", "pending-retro", "landed", "unchanged"] as const;

export const WRITE_TARGETS = ["design_body", "worklog", "new_design_file", "none"] as const;

export type NextAction = (typeof NEXT_ACTIONS)[number];
export type StatusToSet = (typeof STATUS_WORDS)[number];
export type WriteTarget = (typeof WRITE_TARGETS)[number];

export interface Decision {
  readonly next_action: NextAction;
  readonly status_to_set: StatusToSet;
  readonly write_target: WriteTarget;
}

export type CaseOutcome =
  | { readonly kind: "ok"; readonly decision: Decision }
  | { readonly kind: "missing_submit" }
  | { readonly kind: "invalid_arguments" }
  | { readonly kind: "extra_tool" }
  | { readonly kind: "api_error"; readonly class: string };

export const SUBMIT_DECISION_TOOL = {
  type: "function",
  function: {
    name: "submit_decision",
    description: "Submit the single structured decision the flow skills prescribe for the Tier 2 fixture.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        next_action: { type: "string", enum: [...NEXT_ACTIONS] },
        status_to_set: { type: "string", enum: [...STATUS_WORDS] },
        write_target: { type: "string", enum: [...WRITE_TARGETS] },
      },
      required: ["next_action", "status_to_set", "write_target"],
    },
  },
} as const;

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function conjunctionViolations(decision: Decision): readonly string[] {
  const violations: string[] = [];

  switch (decision.next_action) {
    case "open_new_design":
      if (decision.write_target !== "new_design_file" || decision.status_to_set !== "unchanged") {
        violations.push("open_new_design");
      }
      break;
    case "halt_structural":
      if (decision.status_to_set !== "unchanged" || decision.write_target !== "worklog") {
        violations.push("halt_structural");
      }
      break;
    case "implement":
    case "remediate":
      if (decision.status_to_set !== "unchanged" || decision.write_target !== "none") {
        violations.push(decision.next_action);
      }
      break;
    case "set_status":
      if (decision.status_to_set === "unchanged" || decision.write_target !== "worklog") {
        violations.push("set_status");
      }
      break;
    case "run_retro":
      if (decision.status_to_set !== "landed" || decision.write_target !== "worklog") {
        violations.push("run_retro");
      }
      break;
    case "reject_finding":
      if (decision.status_to_set !== "unchanged" || decision.write_target !== "worklog") {
        violations.push("reject_finding");
      }
      break;
  }

  if (decision.write_target === "new_design_file" && decision.next_action !== "open_new_design") {
    violations.push("new_design_file");
  }

  return Object.freeze(violations);
}

export type ParseDecisionResult =
  | { readonly kind: "ok"; readonly decision: Decision }
  | { readonly kind: "invalid_arguments" };

export function parseDecision(argumentsText: string): ParseDecisionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsText);
  } catch {
    return { kind: "invalid_arguments" };
  }

  if (parsed === null || typeof parsed !== "object") {
    return { kind: "invalid_arguments" };
  }

  const candidate = parsed as Partial<Record<keyof Decision, unknown>>;
  if (!isOneOf(candidate.next_action, NEXT_ACTIONS)) return { kind: "invalid_arguments" };
  if (!isOneOf(candidate.status_to_set, STATUS_WORDS)) return { kind: "invalid_arguments" };
  if (!isOneOf(candidate.write_target, WRITE_TARGETS)) return { kind: "invalid_arguments" };

  const decision = Object.freeze({
    next_action: candidate.next_action,
    status_to_set: candidate.status_to_set,
    write_target: candidate.write_target,
  });

  if (conjunctionViolations(decision).length > 0) return { kind: "invalid_arguments" };
  return { kind: "ok", decision };
}

export interface DecisionDivergence {
  readonly field: keyof Decision;
  readonly expected: string;
  readonly actual: string;
}

export function compareDecision(expected: Decision, actual: Decision): readonly DecisionDivergence[] {
  const fields: readonly (keyof Decision)[] = ["next_action", "status_to_set", "write_target"];

  return Object.freeze(
    fields
      .filter((field) => expected[field] !== actual[field])
      .map((field) => Object.freeze({ field, expected: expected[field], actual: actual[field] })),
  );
}

export function formatDivergences(divergences: readonly DecisionDivergence[]): string {
  return divergences
    .map((d) => `${d.field}: expected ${JSON.stringify(d.expected)}, got ${JSON.stringify(d.actual)}`)
    .join("; ");
}
