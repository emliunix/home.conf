// Design 04 §Evaluation: Kleene three-valued soundness over two bounds, stratified
// negation, recursion, count intervals, and rounds bounded by the declared depth.

import { describe, expect, it } from "vitest";

import { byHeading, moduleText, PURPOSE_ORACLE, PURPOSES, run, scriptedJudge, type SeenQuestion } from "./engine-helpers.js";

type Report = Awaited<ReturnType<typeof run>>;

function statuses(report: Report, id: string): Record<string, string> {
  const constraint = report.constraints.find((entry) => entry.id === id);
  return Object.fromEntries((constraint?.bindings ?? []).map((binding) => [binding.values.S ?? "", binding.status]));
}

/** `mentions` answers per section heading: holds, fails or unknown. */
const MENTIONS = moduleText(`oracles:
  mentions(D, S):
    ask: The section names an owner.
    evidence: core.body(D, S)
rules:
  silent(D, S): core.section(D, S, _), core.depth(D, S, 2), not mentions(D, S)
  named(D, S): core.section(D, S, _), mentions(D, S)
  quiet(D, S): core.section(D, S, _), core.depth(D, S, 2), not named(D, S)
constraints:
  must-mention:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: mentions(D, S)
    severity: error
  must-not-mention:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    forbid: mentions(D, S)
    severity: error
  must-be-silent:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: silent(D, S)
    severity: error
  must-be-quiet:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: quiet(D, S)
    severity: error
`);

const mentionsJudge = (question: SeenQuestion) => ({
  value: question.text.startsWith("## Problem") ? "holds" : question.text.startsWith("## Rationale") ? "fails" : "unknown",
});

describe("three-valued soundness", () => {
  it("never satisfies require, forbid or not over an unknown atom", async () => {
    const { backend } = scriptedJudge(mentionsJudge);
    const report = await run(MENTIONS, backend);
    expect(statuses(report, "must-mention")).toEqual({ "problem-statement": "satisfied", scope: "undetermined", rationale: "violated" });
    expect(statuses(report, "must-not-mention")).toEqual({ "problem-statement": "violated", scope: "undetermined", rationale: "satisfied" });
    expect(statuses(report, "must-be-silent")).toEqual({ "problem-statement": "violated", scope: "undetermined", rationale: "satisfied" });
    // `not` over a derived predicate reads its opposite bound, so unknown stays unknown.
    expect(statuses(report, "must-be-quiet")).toEqual({ "problem-statement": "violated", scope: "undetermined", rationale: "satisfied" });
  });

  it("gives a possible but uncertain binding undetermined, never violated", async () => {
    const program = moduleText(`oracles:
${PURPOSE_ORACLE}constraints:
  scope-has-children:
    forall: core.section(D, S, _), purpose(D, S, scope)
    require: core.child(D, S, _)
    severity: error
`);
    // Every purpose is unknown, so every section is a possible scope section.
    const { backend } = scriptedJudge(() => ({ value: "unknown" }));
    const report = await run(program, backend);
    const constraint = report.constraints[0];
    expect(constraint?.population).toBe(6);
    expect(constraint?.certainPopulation).toBe(0);
    expect(new Set(constraint?.bindings.map((binding) => binding.status))).toEqual(new Set(["satisfied", "undetermined"]));
    expect(report.verdict).toBe("NEEDS-REVIEW");
  });
});

describe("stratified negation, recursion and count", () => {
  it("evaluates negation over a lower stratum with no judge call", async () => {
    const program = moduleText(`rules:
  has_child(D, S): core.child(D, S, _)
  leaf(D, S): core.section(D, S, _), not has_child(D, S)
  bare(D, S): core.section(D, S, _), not core.child(D, S, _)
constraints:
  top-level-is-leaf:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: leaf(D, S), bare(D, S)
    severity: error
`);
    const { backend, requests } = scriptedJudge(() => ({ value: "unknown" }));
    const report = await run(program, backend);
    expect(requests).toHaveLength(0);
    expect(statuses(report, "top-level-is-leaf")).toEqual({ "problem-statement": "satisfied", scope: "violated", rationale: "satisfied" });
  });

  it("computes a recursive closure and counts it", async () => {
    const program = moduleText(`rules:
  under(D, A, C): core.child(D, A, C)
  under(D, A, C2): core.child(D, A, B), under(D, B, C2)
constraints:
  five-below-title:
    forall: core.section(D, S, root)
    require: count(C, under(D, S, C), N), N >= 5
    severity: error
  six-below-title:
    forall: core.section(D, S, root)
    require: count(C, under(D, S, C), N), N >= 6
    severity: error
`);
    const report = await run(program, scriptedJudge(() => ({ value: "unknown" })).backend);
    expect(statuses(report, "five-below-title")).toEqual({ "07---fixture": "satisfied" });
    expect(statuses(report, "six-below-title")).toEqual({ "07---fixture": "violated" });
  });

  it("reads a count over unknown atoms as an interval, so the comparison is undetermined", async () => {
    const program = moduleText(`oracles:
  mentions(D, S):
    ask: The section names an owner.
    evidence: core.body(D, S)
constraints:
  two-mention:
    forall: core.section(D, T, root)
    require: "count(S, (core.section(D, S, _), mentions(D, S)), N), N >= 2"
    severity: error
`);
    const unknown = await run(program, scriptedJudge(() => ({ value: "unknown" })).backend);
    expect(unknown.constraints[0]?.status).toBe("undetermined");
    const holds = await run(program, scriptedJudge(() => ({ value: "holds" })).backend);
    expect(holds.constraints[0]?.status).toBe("satisfied");
    const fails = await run(program, scriptedJudge(() => ({ value: "fails" })).backend);
    expect(fails.constraints[0]?.status).toBe("violated");
  });
});

const DEPTH_TWO = moduleText(`oracles:
${PURPOSE_ORACLE}  kind(D, S, K):
    choose: [inclusion, other]
    ask: Classify this item.
    evidence: core.body(D, S)
rules:
  item(D, P, C): core.section(D, P, _), purpose(D, P, scope), core.child(D, P, C)
constraints:
  items-included:
    forall: item(D, P, C)
    require: kind(D, C, inclusion)
    severity: error
`, 2);

describe("rounds", () => {
  it("makes exactly two requests for a depth-2 program and asks only possible instances", async () => {
    const { backend, requests } = scriptedJudge((question) => question.options.includes("inclusion")
      ? { value: question.text.includes("Owner") ? "inclusion" : "other" }
      : byHeading(PURPOSES)(question));
    const report = await run(DEPTH_TWO, backend);
    expect(requests.map((request) => request.questions.length)).toEqual([6, 2]);
    expect(report.requests.map((request) => request.round)).toEqual([1, 2]);
    const kinds = report.oracles.filter((entry) => entry.atom.startsWith("t.kind"));
    expect(kinds.map((entry) => entry.sections[0])).toEqual(["scope/lunch-menu", "scope/owner-index"]);
    expect(report.constraints[0]?.status).toBe("violated");
  });

  it("makes no second request when round 1 rules every instance out", async () => {
    const { backend, requests } = scriptedJudge(() => ({ value: "other" }));
    const report = await run(DEPTH_TWO, backend);
    expect(requests).toHaveLength(1);
    expect(report.constraints[0]).toMatchObject({ population: 0, status: "satisfied" });
    expect(report.findings).toEqual([]);
  });

  it("makes one request for a depth-1 program", async () => {
    const program = moduleText(`oracles:
${PURPOSE_ORACLE}constraints:
  has-problem:
    forall: core.section(D, S, root)
    require: core.child(D, S, C), purpose(D, C, problem)
    severity: error
`);
    const { backend, requests } = scriptedJudge(byHeading(PURPOSES));
    const report = await run(program, backend);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.questions).toHaveLength(3);
    expect(report.verdict).toBe("PASS");
  });

  it("reads literals left to right, so an earlier answer prunes what is asked", async () => {
    const program = moduleText(`oracles:
${PURPOSE_ORACLE}  mentions(D, S):
    ask: The section names an owner.
    evidence: core.body(D, S)
constraints:
  problem-mentions:
    forall: core.section(D, S, _), purpose(D, S, problem)
    require: mentions(D, S)
    severity: error
`, 2);
    const { backend, requests } = scriptedJudge((question) => question.options.includes("holds") ? { value: "holds" } : byHeading(PURPOSES)(question));
    const report = await run(program, backend);
    expect(requests.map((request) => request.questions.length)).toEqual([6, 1]);
    expect(report.verdict).toBe("PASS");
  });
});
