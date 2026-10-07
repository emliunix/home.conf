// Manager-owned acceptance test for design 04 (worklog/04 C9). The implementer must make
// it pass without editing it. It drives the real path, from YAML module text and
// Markdown through segmentation, the Prolog evaluation, and rounds of keyed judge
// batches to the report. The mock judge answers only from the evidence and question it
// receives, never by position.

import { createMockJevJudgeBackend, type JudgeBackend, type JudgeBackendRequest } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { renderReport, runProgram } from "../../src/engine/index.js";

const MARKDOWN = [
  "# 04 - Example",
  "",
  "## Problem statement",
  "",
  "Authors cannot state section classes.",
  "",
  "## Scope - what we touch",
  "",
  "### Module loader",
  "",
  "A loader for module files.",
  "",
  "### Weather report",
  "",
  "It was sunny on Tuesday.",
  "",
  "## Rationale",
  "",
  "Datalog over the section tree.",
  "",
].join("\n");

const MODULE = `
schema_version: 2
kind: verification-module
module: golden
params:
  scope_categories: [inclusion, exclusion, non_goal]
rounds: 2
oracles:
  purpose(D, S, P):
    choose: [problem, scope, rationale, other]
    ask: What is this section for?
    evidence: core.own(D, S)
    threshold: 0.5
  describes_mechanism(D, S):
    ask: The section describes how the solution works.
    evidence: core.body(D, S)
    threshold: 0.5
  scope_category(D, S, Parent, K):
    choose: [inclusion, exclusion, non_goal, other]
    ask: Classify this item listed under the heading "{Parent}".
    evidence: core.body(D, S)
    threshold: 0.5
rules:
  scope_item(D, P, C): core.section(D, P, _), purpose(D, P, scope), core.child(D, P, C)
  scope_class(D, C, K): scope_item(D, P, C), core.heading(D, P, H), scope_category(D, C, H, K)
constraints:
  scope-children-classified:
    forall: scope_item(D, P, C)
    require: scope_class(D, C, K), K in $scope_categories
    severity: error
    message: "{C} under {P} is none of {scope_categories}"
    repair: "Rewrite {C} as one of {scope_categories}, or move it out of {P}."
  problem-states-no-mechanism:
    forall: core.section(D, S, _), purpose(D, S, problem)
    forbid: describes_mechanism(D, S)
    severity: warning
    weight: 1
`;

const DEPTH_ONE = `
schema_version: 2
kind: verification-module
module: golden-depth-one
rounds: 1
oracles:
  purpose(D, S, P):
    choose: [problem, scope, rationale, other]
    ask: What is this section for?
    evidence: core.own(D, S)
    threshold: 0.5
rules:
  known_purpose(D, S): core.section(D, S, _), purpose(D, S, P), P in [problem, scope, rationale]
constraints:
  every-section-has-a-purpose:
    forall: core.section(D, S, _)
    require: known_purpose(D, S)
    severity: error
`;

interface ProofNode {
  kind: string;
  atom?: string;
  children?: ProofNode[];
  oracle?: {
    key: string;
    sections: string[];
    bytes: number;
    label: string;
    distribution: number[];
    threshold: number;
    round: number;
  };
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Answers from each question's own evidence entry; records every request. */
function evidenceJudge(order: "forward" | "reversed" = "forward"): { backend: JudgeBackend; requests: JudgeBackendRequest[] } {
  const requests: JudgeBackendRequest[] = [];
  const backend = createMockJevJudgeBackend({
    answers: (request) => {
      requests.push(request);
      const state = (typeof request.state === "string" ? JSON.parse(request.state) : request.state) as
        { evidence?: Record<string, { text?: unknown }> };
      const answers = request.questions.map((question) => {
        const instruction = textOf(question.instruction);
        const key = /state\.evidence\.([A-Za-z0-9_-]+)/.exec(instruction)?.[1];
        const text = key === undefined ? "" : textOf(state.evidence?.[key]?.text);
        const ids = (question.options ?? []).map((option) => option.id);
        let value = "unknown";
        if (ids.includes("problem")) {
          value = text.includes("Problem statement") ? "problem"
            : text.includes("Scope - what we touch") ? "scope"
              : text.includes("Rationale") ? "rationale" : "other";
        } else if (ids.includes("inclusion")) {
          value = instruction.includes("Scope - what we touch") && text.includes("loader") ? "inclusion" : "other";
        }
        const distribution = ids.map((id) => (id === value ? 1 : 0));
        return { id: question.id, kind: "choose" as const, value, confidence: 1, distribution, basis: "mock" as const };
      });
      return order === "reversed" ? answers.reverse() : answers;
    },
  });
  return { backend, requests };
}

function run(moduleYaml: string, backend: JudgeBackend) {
  return runProgram({
    moduleYaml,
    documents: [{ path: "design/04-example.md", markdown: MARKDOWN }],
    backend,
    model: "jev-1.13.0",
    policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
  });
}

function oracleLeaves(node: ProofNode | undefined): NonNullable<ProofNode["oracle"]>[] {
  if (node === undefined) {
    return [];
  }
  const own = node.oracle === undefined ? [] : [node.oracle];
  return [...own, ...(node.children ?? []).flatMap((child) => oracleLeaves(child))];
}

describe("design 04 golden path", () => {
  it("classifies children through two bounded rounds and explains the one violation", async () => {
    const { backend, requests } = evidenceJudge();
    const report = await run(MODULE, backend);

    // Rounds: purpose for all 6 sections, then the 2 scope children and the problem section.
    // Round 1 (6), round 2 (3), then one follow-up over the non-passing atom's sentences.
    expect(requests.map((request) => request.questions.length)).toEqual([6, 3, 1]);
    // Round 1 (6), round 2 (3), plus one follow-up batch (round 0) over the non-passing atom.
    const mainRounds = report.requests.filter((request) => request.round !== 0);
    expect(mainRounds.map((request) => request.round)).toEqual([1, 2]);
    expect(mainRounds.map((request) => request.questions)).toEqual([6, 3]);
    expect(report.requests.filter((request) => request.round === 0).map((request) => request.questions)).toEqual([1]);
    for (const request of requests) {
      const state = (typeof request.state === "string" ? JSON.parse(request.state) : request.state) as
        { evidence: Record<string, unknown> };
      for (const question of request.questions) {
        const key = /state\.evidence\.([A-Za-z0-9_-]+)/.exec(textOf(question.instruction))?.[1];
        expect(key, textOf(question.instruction)).toBeDefined();
        expect(Object.keys(state.evidence)).toContain(key);
      }
    }
    // The parent heading reaches the judge only as the atom's argument.
    const categoryQuestions = requests[1]?.questions.filter((question) => textOf(question.instruction).includes("Classify")) ?? [];
    expect(categoryQuestions).toHaveLength(2);
    for (const question of categoryQuestions) {
      expect(textOf(question.instruction)).toContain('"Scope - what we touch"');
    }

    const classified = report.constraints.find((constraint) => constraint.id === "scope-children-classified");
    expect(classified?.status).toBe("violated");
    expect(classified?.population).toBe(2);
    const violated = classified?.bindings.filter((binding) => binding.status === "violated") ?? [];
    expect(violated).toHaveLength(1);
    expect(violated[0]?.values).toMatchObject({ C: "scope---what-we-touch/weather-report", P: "scope---what-we-touch" });
    expect(violated[0]?.message).toContain("scope---what-we-touch/weather-report");
    expect(violated[0]?.repair).toContain("scope---what-we-touch");
    const leaves = oracleLeaves(violated[0]?.proof as ProofNode | undefined);
    const categoryLeaf = leaves.find((leaf) => leaf.label === "other");
    expect(categoryLeaf).toMatchObject({ round: 2, threshold: 0.5, sections: ["scope---what-we-touch/weather-report"] });
    expect(categoryLeaf?.distribution).toEqual([0, 0, 0, 1, 0]);
    expect(categoryLeaf?.bytes).toBeGreaterThan(0);

    // A forbid over an unknown answer is undetermined, never satisfied.
    const mechanism = report.constraints.find((constraint) => constraint.id === "problem-states-no-mechanism");
    expect(mechanism?.population).toBe(1);
    expect(mechanism?.status).toBe("undetermined");

    expect(report.verdict).toBe("NO-GO");
    expect(report.decidedBy).toBe("scope-children-classified");

    // The population is printed, with its count, before the failing binding.
    const text = renderReport(report);
    const population = text.indexOf("population 2");
    const failure = text.indexOf("scope---what-we-touch/weather-report");
    expect(population).toBeGreaterThanOrEqual(0);
    expect(failure).toBeGreaterThan(population);
  });

  it("binds answers by key, so a judge that reorders its answers changes nothing", async () => {
    const forward = await run(MODULE, evidenceJudge("forward").backend);
    const reversed = await run(MODULE, evidenceJudge("reversed").backend);
    const shape = (report: typeof forward) => report.constraints.map((constraint) => [
      constraint.id, constraint.status,
      constraint.bindings.map((binding) => [binding.status, JSON.stringify(binding.values)]),
    ]);
    expect(shape(reversed)).toEqual(shape(forward));
    expect(reversed.verdict).toBe(forward.verdict);
  });

  it("makes exactly one request for a depth-1 program", async () => {
    const { backend, requests } = evidenceJudge();
    const report = await run(DEPTH_ONE, backend);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.questions).toHaveLength(6);
    const constraint = report.constraints.find((entry) => entry.id === "every-section-has-a-purpose");
    expect(constraint?.population).toBe(6);
    // The title and the two scope children are `other`.
    expect(constraint?.bindings.filter((binding) => binding.status === "violated")).toHaveLength(3);
    expect(report.verdict).toBe("NO-GO");
  });
});
