/**
 * L1 structured-decision contract: the unit of assertion is a machine-checkable
 * Decision produced via the provider-enforced `submit_decision` tool call and
 * graded field-by-field in TS. See design/01-fact-based-eval.md.
 */

export type NextAction =
  | "implement"
  | "remediate"
  | "open_new_design"
  | "run_retro"
  | "set_status"
  | "halt_structural"
  | "reject_finding";

export type StatusToSet =
  | "draft-followup"
  | "reviewed"
  | "pending-retro"
  | "landed"
  | "unchanged";

export type WriteTarget = "design_body" | "worklog" | "new_design_file" | "followup_design_file" | "none";

export interface Decision {
  readonly next_action: NextAction;
  readonly status_to_set: StatusToSet;
  readonly write_target: WriteTarget;
  readonly opens_new_design: boolean;
}

export type CaseKind = "canonical" | "trap" | "paraphrase";

export interface DecisionCase {
  readonly id: string;
  readonly kind: CaseKind;
  /** Rendered repo-state snippet: design file with Status, finding, etc. */
  readonly fixture: string;
  /** The decision to make. */
  readonly question: string;
  /** Exact-match target, graded field-by-field. */
  readonly expected: Decision;
}

export const NEXT_ACTIONS: readonly NextAction[] = Object.freeze([
  "implement",
  "remediate",
  "open_new_design",
  "run_retro",
  "set_status",
  "halt_structural",
  "reject_finding",
]);

export const STATUSES_TO_SET: readonly StatusToSet[] = Object.freeze([
  "draft-followup",
  "reviewed",
  "pending-retro",
  "landed",
  "unchanged",
]);

export const WRITE_TARGETS: readonly WriteTarget[] = Object.freeze([
  "design_body",
  "worklog",
  "new_design_file",
  "followup_design_file",
  "none",
]);

const DECISION_FIELDS = ["next_action", "status_to_set", "write_target", "opens_new_design"] as const;

/** Parse and validate the raw `submit_decision` tool-call arguments. */
export function parseDecision(argumentsText: string): Decision {
  const parsed = JSON.parse(argumentsText) as Record<string, unknown>;

  if (!NEXT_ACTIONS.includes(parsed.next_action as NextAction)) {
    throw new Error(`submit_decision.next_action is not a valid action: ${JSON.stringify(parsed.next_action)}`);
  }
  if (!STATUSES_TO_SET.includes(parsed.status_to_set as StatusToSet)) {
    throw new Error(
      `submit_decision.status_to_set is not a valid status: ${JSON.stringify(parsed.status_to_set)}`,
    );
  }
  if (!WRITE_TARGETS.includes(parsed.write_target as WriteTarget)) {
    throw new Error(
      `submit_decision.write_target is not a valid target: ${JSON.stringify(parsed.write_target)}`,
    );
  }
  if (typeof parsed.opens_new_design !== "boolean") {
    throw new Error(
      `submit_decision.opens_new_design must be a boolean: ${JSON.stringify(parsed.opens_new_design)}`,
    );
  }

  return Object.freeze({
    next_action: parsed.next_action as NextAction,
    status_to_set: parsed.status_to_set as StatusToSet,
    write_target: parsed.write_target as WriteTarget,
    opens_new_design: parsed.opens_new_design,
  });
}

export interface DecisionComparison {
  readonly matched: boolean;
  /** Fields whose actual value diverged from the expected value. */
  readonly divergedFields: readonly (typeof DECISION_FIELDS)[number][];
  /** Fraction of fields matching, in the 0..1 range. */
  readonly score: number;
}

/** Field-by-field exact comparison; a miss reports which field diverged. */
export function compareDecision(expected: Decision, actual: Decision): DecisionComparison {
  const divergedFields = DECISION_FIELDS.filter((field) => expected[field] !== actual[field]);

  return Object.freeze({
    matched: divergedFields.length === 0,
    divergedFields: Object.freeze(divergedFields),
    score: (DECISION_FIELDS.length - divergedFields.length) / DECISION_FIELDS.length,
  });
}
