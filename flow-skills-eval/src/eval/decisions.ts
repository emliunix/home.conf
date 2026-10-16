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

export type WriteTarget =
  | "design_body"
  | "worklog"
  | "new_design_file"
  | "followup_design_file"
  | "module_docs"
  | "none";

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
  "module_docs",
  "none",
]);

const DECISION_FIELDS = ["next_action", "status_to_set", "write_target", "opens_new_design"] as const;

/**
 * Field and value definitions shown to the model (design/10-eval-corpus-triage.md).
 * Each defines a value as an act, never the situation that calls for it, and is
 * derived from the corpus's expected tuples so that defining it moves no tuple.
 */
export const FIELD_DEFINITIONS = Object.freeze({
  next_action: "The one act this decision takes next.",
  status_to_set:
    "The status word this decision writes into its `write_target` file; `unchanged` means it writes no status line.",
  write_target:
    "The one file this decision writes: the file holding the status line it sets, or else the document its content goes to; `none` for a change to code only, or no change.",
  opens_new_design: "Whether this decision starts a new design file whose status is `draft`.",
});

export const VALUE_DEFINITIONS: Readonly<{
  next_action: Readonly<Record<NextAction, string>>;
  status_to_set: Readonly<Record<StatusToSet, string>>;
  write_target: Readonly<Record<WriteTarget, string>>;
}> = Object.freeze({
  next_action: Object.freeze({
    implement: "write code toward the design's scope",
    remediate: "correct a defect in existing code or text",
    open_new_design: "start a new design file",
    run_retro: "perform the design's retrospective and write its worklog record",
    set_status: "write a new status word on a design file",
    halt_structural: "stop the work and record the structural cause for adjudication",
    reject_finding: "decline a finding and record the reason",
  }),
  status_to_set: Object.freeze({
    "draft-followup": "the status word `draft-followup`",
    reviewed: "the status word `reviewed`",
    "pending-retro": "the status word `pending-retro`",
    landed: "the status word `landed`",
    unchanged: "no status line is written",
  }),
  write_target: Object.freeze({
    design_body: "the design file under decision",
    worklog: "the design's worklog",
    new_design_file: "a new design file",
    followup_design_file: "a new followup design file",
    module_docs: "a package's module documents under `docs/modules/`",
    none: "no document",
  }),
});

function enumDescription(field: keyof typeof VALUE_DEFINITIONS): string {
  const values = Object.entries(VALUE_DEFINITIONS[field]).map(([value, text]) => `\`${value}\`: ${text}.`);
  return [FIELD_DEFINITIONS[field], ...values].join(" ");
}

/** Provider-enforced Decision schema; the only tool the agent may call. Hashed into the lock. */
export const SUBMIT_DECISION_TOOL = Object.freeze({
  type: "function",
  function: {
    name: "submit_decision",
    description: "Submit the single next flow decision for the Tier 2 case.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        next_action: { type: "string", enum: [...NEXT_ACTIONS], description: enumDescription("next_action") },
        status_to_set: {
          type: "string",
          enum: [...STATUSES_TO_SET],
          description: enumDescription("status_to_set"),
        },
        write_target: { type: "string", enum: [...WRITE_TARGETS], description: enumDescription("write_target") },
        opens_new_design: { type: "boolean", description: FIELD_DEFINITIONS.opens_new_design },
      },
      required: ["next_action", "status_to_set", "write_target", "opens_new_design"],
    },
  },
} as const);

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

/**
 * The grader's spelling rule (design 10): naming the design's current status word
 * writes no status line, so it is graded as `unchanged`. The skills never specify
 * that spelling; the tool description deliberately does not mention it.
 */
export function normalizeDecision(actual: Decision, currentStatus: string | undefined): Decision {
  if (currentStatus === undefined || actual.status_to_set !== currentStatus) return actual;
  return Object.freeze({ ...actual, status_to_set: "unchanged" });
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
