import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { decisionCases } from "../src/eval/cases.ts";
import {
  FIELD_DEFINITIONS,
  NEXT_ACTIONS,
  STATUSES_TO_SET,
  SUBMIT_DECISION_TOOL,
  VALUE_DEFINITIONS,
  WRITE_TARGETS,
} from "../src/eval/decisions.ts";

/**
 * Every distinct expected tuple in the corpus, one per row, with why it is
 * consistent with the field definitions (design/10-eval-corpus-triage.md). A new
 * tuple needs a row here before it can enter the corpus.
 */
const CONSISTENT_TUPLES: Readonly<Record<string, string>> = Object.freeze({
  "set_status,reviewed,design_body,false": "the status line is in the design",
  "set_status,pending-retro,design_body,false": "the status line is in the design",
  "set_status,landed,design_body,false": "the status line is in the design",
  "set_status,draft-followup,followup_design_file,false":
    "the status line is in the new followup file, whose status is not `draft`",
  "run_retro,unchanged,worklog,false": "the record goes to the worklog",
  "halt_structural,unchanged,worklog,false": "the structural cause is recorded in the worklog",
  "remediate,unchanged,none,false": "the correction is to code only",
  "implement,unchanged,none,false": "the change is to code only",
  "remediate,unchanged,design_body,false": "the correction is in the design text",
  "remediate,unchanged,worklog,false": "the correction is recorded in the worklog",
  "open_new_design,unchanged,new_design_file,true": "the content goes to a new `draft` design",
  "reject_finding,unchanged,worklog,false": "the reason is recorded in the worklog",
  "remediate,unchanged,module_docs,false": "the correction is in a package's module documents",
});

const CONDITIONALS = /\b(when|if|after|once|unless)\b/i;
const STAGE_WORDS = [
  "retro",
  "review",
  "sweep",
  "grill",
  "gate",
  "defen",
  "budget",
  "round",
  "followup",
  "follow-up",
  "p0",
  "breakout",
  "verdict",
] as const;

/** Stage words in `text` that are not part of the defined value's own name. */
function foreignStageWords(text: string, ownName: string): string[] {
  const lower = text.toLowerCase();
  const own = ownName.toLowerCase();
  return STAGE_WORDS.filter((word) => lower.includes(word) && !own.includes(word));
}

const VALUE_SETS = {
  next_action: NEXT_ACTIONS,
  status_to_set: STATUSES_TO_SET,
  write_target: WRITE_TARGETS,
} as const;

describe("submit_decision field definitions", () => {
  it("define every field and every enum value", () => {
    const properties = SUBMIT_DECISION_TOOL.function.parameters.properties;
    for (const [field, schema] of Object.entries(properties)) {
      expect(schema.description, field).toBeTruthy();
    }
    for (const [field, values] of Object.entries(VALUE_SETS)) {
      const defined = VALUE_DEFINITIONS[field as keyof typeof VALUE_SETS];
      expect(Object.keys(defined).sort(), field).toEqual([...values].sort());
      for (const value of values) {
        expect(properties[field as keyof typeof VALUE_SETS].description, `${field}.${value}`).toContain(
          `\`${value}\``,
        );
      }
    }
  });

  it("name no situation: no conditional, no stage word beyond the value's own name", () => {
    const texts: [string, string, string][] = Object.entries(FIELD_DEFINITIONS).map(([field, text]) => [
      field,
      text,
      field,
    ]);
    for (const [field, values] of Object.entries(VALUE_DEFINITIONS)) {
      for (const [value, text] of Object.entries(values)) texts.push([`${field}.${value}`, text, value]);
    }
    for (const [where, text, ownName] of texts) {
      expect(CONDITIONALS.test(text), `${where}: ${text}`).toBe(false);
      expect(foreignStageWords(text, ownName), `${where}: ${text}`).toEqual([]);
    }
  });

  it("flag a definition that names a situation", () => {
    expect(CONDITIONALS.test("write the status word when the review passes")).toBe(true);
    expect(foreignStageWords("the record a retro writes", "worklog")).toEqual(["retro"]);
    expect(foreignStageWords("perform the design's retrospective and write its worklog record", "run_retro")).toEqual([]);
  });

  it("move no tuple: every distinct expected tuple has a consistency row", () => {
    const tuples = new Set(
      decisionCases.map(({ expected: e }) =>
        [e.next_action, e.status_to_set, e.write_target, e.opens_new_design].join(","),
      ),
    );
    expect([...tuples].sort()).toEqual(Object.keys(CONSISTENT_TUPLES).sort());
  });
});

describe("eval design guide", () => {
  const guide = readFileSync(resolve(import.meta.dirname, "../design/ref-eval-design-guide.md"), "utf8");

  it("states the triage rule", () => {
    expect(guide).toContain("## Triaging a red case");
    for (const disposition of ["**Skill finding.**", "**Ambiguous instrument.**", "**Stale expectation.**"]) {
      expect(guide).toContain(disposition);
    }
    expect(guide).toContain("An expected tuple never changes because a model said");
  });
});
