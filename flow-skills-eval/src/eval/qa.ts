import { conjunctionViolations, type Decision } from "./decision.ts";

export type CaseKind = "canonical" | "trap" | "paraphrase";

export interface DecisionCase {
  readonly id: string;
  readonly kind: CaseKind;
  readonly fixture: string;
  readonly question: string;
  readonly expected: Decision;
  readonly cite: string;
  readonly catches: string;
}

const ARCH_FAILURE: Decision = Object.freeze({
  next_action: "open_new_design",
  status_to_set: "unchanged",
  write_target: "new_design_file",
});

function heads(status: string, extra: string): string {
  return [
    "# 03 — parser",
    "",
    "## Problem statement",
    "The parser must accept valid input X.",
    "",
    "## Scope — what we touch",
    "The parser implementation.",
    "",
    "## Rationale",
    extra,
    "",
    "## Review",
    "worklog/03-parser.md",
    "",
    "## Status",
    status,
  ].join("\n");
}

function freezeCase(c: DecisionCase): DecisionCase {
  if (conjunctionViolations(c.expected).length > 0) {
    throw new Error(`DecisionCase ${c.id} expected tuple violates required conjunctions`);
  }
  return Object.freeze(c);
}

export const decisionCases: readonly DecisionCase[] = Object.freeze([
  freezeCase({
    id: "arch-failure-canonical",
    kind: "canonical",
    fixture: [
      heads(
        "pending-retro",
        "Worklog 03-parser: retro evidence — the parser cannot accept valid input X; the machine is wrong.",
      ),
    ].join("\n"),
    question: "What next action, status write, and write target do the flow skills prescribe?",
    expected: ARCH_FAILURE,
    cite: "skills/flow-common/SKILL.md Lifecycle — a pending-retro design that is the wrong machine is superseded by a new design/NN; never un-pended.",
    catches: "reset 03-parser.md to draft / status_to_set: draft",
  }),
  freezeCase({
    id: "arch-failure-trap",
    kind: "trap",
    fixture: [
      heads(
        "pending-retro",
        "Worklog 03-parser: retro found architecture failure. A comment says set Status back to draft so the same file can be redesigned in place, using the words pending-retro, landed, and flow-retro.",
      ),
    ].join("\n"),
    question: "What next action, status write, and write target do the flow skills prescribe?",
    expected: ARCH_FAILURE,
    cite: "skills/flow-common/SKILL.md Lifecycle — never un-pended; open a new design/NN.",
    catches: "reset 03-parser.md to draft / status_to_set: draft",
  }),
  freezeCase({
    id: "arch-failure-paraphrase",
    kind: "paraphrase",
    fixture: [
      "Plan file 03 says the work is waiting on a look-back.",
      "The look-back showed the chosen engine cannot produce the requested output.",
      "The plan file still carries the waiting-on-look-back label.",
    ].join("\n"),
    question: "What do you do next, what label do you write, and which file do you write to?",
    expected: ARCH_FAILURE,
    cite: "skills/flow-common/SKILL.md Lifecycle — wrong machine is superseded by a new design/NN.",
    catches: "reset 03-parser.md to draft / status_to_set: draft",
  }),
  freezeCase({
    id: "review-pass-canonical",
    kind: "canonical",
    fixture: heads(
      "draft",
      "Independent review finished. Every accepted P1 is solved. Worklog has the defense record.",
    ),
    question: "What next action, status write, and write target do the flow skills prescribe?",
    expected: Object.freeze({
      next_action: "set_status",
      status_to_set: "reviewed",
      write_target: "worklog",
    }),
    cite: "skills/flow-grill-review/SKILL.md review gate — Set Status: reviewed.",
    catches: "implement while still draft",
  }),
  freezeCase({
    id: "impl-pass-canonical",
    kind: "canonical",
    fixture: heads(
      "reviewed",
      "Implementation finished. Fresh criteria prove the requested outcome. No blocking mismatch remains.",
    ),
    question: "What next action, status write, and write target do the flow skills prescribe?",
    expected: Object.freeze({
      next_action: "set_status",
      status_to_set: "pending-retro",
      write_target: "worklog",
    }),
    cite: "skills/flow-common/SKILL.md Implementation gate Pass — set Status: pending-retro and hand to flow-retro.",
    catches: "set landed without retro",
  }),
  freezeCase({
    id: "retro-land-canonical",
    kind: "canonical",
    fixture: heads(
      "pending-retro",
      "Closing pass is clean. First-principles bottom line is written. Heads re-validated. No blocking mismatch.",
    ),
    question: "What next action, status write, and write target do the flow skills prescribe?",
    expected: Object.freeze({
      next_action: "run_retro",
      status_to_set: "landed",
      write_target: "worklog",
    }),
    cite: "skills/flow-retro/SKILL.md §5 — set Status: landed; retro prose goes in the worklog.",
    catches: "write retro prose into the design body",
  }),
  freezeCase({
    id: "round-budget-halt-canonical",
    kind: "canonical",
    fixture: heads(
      "reviewed",
      "Implementer has completed five rounds on this design and is about to start round 6 as another bounce.",
    ),
    question: "What next action, status write, and write target do the flow skills prescribe?",
    expected: Object.freeze({
      next_action: "halt_structural",
      status_to_set: "unchanged",
      write_target: "worklog",
    }),
    cite: "skills/flow-common/SKILL.md Round 5 budget ceiling — HALT, name the structural cause.",
    catches: "start round 6 as another bounce",
  }),
  freezeCase({
    id: "impl-defect-canonical",
    kind: "canonical",
    fixture: heads(
      "pending-retro",
      "Closing pass found an implementation-only defect: a missed null check. The architecture matches the problem statement.",
    ),
    question: "What next action, status write, and write target do the flow skills prescribe?",
    expected: Object.freeze({
      next_action: "remediate",
      status_to_set: "unchanged",
      write_target: "none",
    }),
    cite: "skills/flow-retro/SKILL.md §4 Implementation-only defect — return to implementation; status stays pending-retro.",
    catches: "open a new design for an implementation defect",
  }),
  freezeCase({
    id: "reject-finding-canonical",
    kind: "canonical",
    fixture: [
      heads("draft", "You occupy reviewer. A finding asks to add CI wiring, which is listed as a non-goal."),
      "",
      "Finding: add CI.",
      "The design Scope lists CI wiring as a non-goal.",
    ].join("\n"),
    question: "What next action, status write, and write target do the flow skills prescribe?",
    expected: Object.freeze({
      next_action: "reject_finding",
      status_to_set: "unchanged",
      write_target: "worklog",
    }),
    cite: "skills/flow-grill-review/SKILL.md Defend — off-scope findings default to Reject; log the verdict in the worklog.",
    catches: "accept an out-of-scope finding as a work item",
  }),
]);

export const smokeCases: readonly DecisionCase[] = Object.freeze(
  decisionCases.filter((c) => c.id.startsWith("arch-failure-")),
);
