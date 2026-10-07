// Design 04 §Diagnostics: populations before judgment, bindings with rendered
// messages and repair hints, missing literals, proof trees down to facts and oracle
// leaves, and the strict verdict precedence NO-GO > BLOCKED > NEEDS-REVIEW > PASS.

import { describe, expect, it } from "vitest";

import { renderReport, type ProofNode } from "../../src/engine/index.js";
import { byHeading, moduleText, PURPOSE_ORACLE, PURPOSES, run, scriptedJudge } from "../engine-helpers.js";

function nodes(node: ProofNode | undefined): ProofNode[] {
  return node === undefined ? [] : [node, ...(node.children ?? []).flatMap(nodes)];
}

const SCOPE = moduleText(`params:
  categories: [inclusion, exclusion]
oracles:
${PURPOSE_ORACLE}  kind(D, S, Parent, K):
    choose: [inclusion, exclusion, other]
    ask: Classify this item under "{Parent}".
    evidence: core.body(D, S)
    threshold: 0.5
rules:
  item(D, P, C): core.section(D, P, _), purpose(D, P, scope), core.child(D, P, C)
  classed(D, C, K): item(D, P, C), core.heading(D, P, H), kind(D, C, H, K)
constraints:
  items-classified:
    forall: item(D, P, C)
    require: classed(D, C, K), K in $categories
    severity: error
    message: "{C} under {P} is none of {categories}"
    repair: "Rewrite {C} as one of {categories}."
`, 2);

const judge = () => scriptedJudge((question) => question.options.includes("inclusion")
  ? { value: question.text.includes("Owner") ? "inclusion" : "other", distribution: question.text.includes("Owner") ? [0.9, 0.05, 0.05, 0] : [0.1, 0.1, 0.7, 0.1] }
  : byHeading(PURPOSES)(question));

describe("violation report", () => {
  it("gives each failing binding its values, message, repair, missing literals and a proof to the leaves", async () => {
    const report = await run(SCOPE, judge().backend);
    const constraint = report.constraints[0];
    expect(constraint).toMatchObject({ id: "items-classified", status: "violated", population: 2, certainPopulation: 2 });
    const violated = constraint?.bindings.filter((binding) => binding.status === "violated") ?? [];
    expect(violated).toHaveLength(1);
    const binding = violated[0];
    expect(binding?.values).toEqual({ D: "design/07-fixture.md", P: "scope", C: "scope/lunch-menu" });
    expect(binding?.message).toBe("scope/lunch-menu under scope is none of [inclusion, exclusion]");
    expect(binding?.repair).toBe("Rewrite scope/lunch-menu as one of [inclusion, exclusion].");
    expect(binding?.missing).toEqual(["other in [inclusion, exclusion]"]);

    const all = nodes(binding?.proof);
    expect(all.map((node) => node.kind)).toEqual(expect.arrayContaining(["binding", "forall", "missing", "rule", "fact", "oracle"]));
    expect(all.some((node) => node.kind === "fact" && node.atom === "core.child(design/07-fixture.md, scope, scope/lunch-menu)")).toBe(true);
    const leaves = all.flatMap((node) => (node.oracle === undefined ? [] : [node.oracle]));
    expect(leaves.find((leaf) => leaf.round === 1)).toMatchObject({ label: "scope", sections: ["scope"], threshold: 0.5 });
    const kind = leaves.find((leaf) => leaf.round === 2);
    expect(kind).toMatchObject({
      label: "other", answered: "other", sections: ["scope/lunch-menu"], threshold: 0.5,
      options: ["inclusion", "exclusion", "other", "unknown"], distribution: [0.1, 0.1, 0.7, 0.1], cacheHit: false,
    });
    expect(kind?.key).toMatch(/^kind-[0-9a-f]{12}$/);
    expect(kind?.bytes).toBe(Buffer.byteLength("### Lunch menu\n\nSoup on Fridays.\n\n"));
    expect(kind?.question).toBe('Classify this item under "Scope".');
  });

  it("prints the population with its count before any judgment, then the failing binding", async () => {
    const text = renderReport(await run(SCOPE, judge().backend));
    const population = text.indexOf("population 2 (2 certain)");
    const status = text.indexOf("status violated");
    const failure = text.indexOf("violated: scope/lunch-menu under scope");
    expect(population).toBeGreaterThanOrEqual(0);
    expect(status).toBeGreaterThan(population);
    expect(failure).toBeGreaterThan(status);
    expect(text).toContain("repair: Rewrite scope/lunch-menu");
    expect(text).toContain("missing: other in [inclusion, exclusion] is not possible");
    expect(text).toContain("distribution [0.1, 0.1, 0.7, 0.1]");
    expect(text).toContain("oracle questions 8");
  });

  it("shows an unanswered oracle leaf and a default message for an undetermined binding", async () => {
    const { backend } = scriptedJudge((question) => question.options.includes("inclusion")
      ? { value: "unknown" }
      : byHeading(PURPOSES)(question));
    const report = await run(SCOPE, backend);
    const binding = report.constraints[0]?.bindings[0];
    expect(binding?.status).toBe("undetermined");
    const leaf = nodes(binding?.proof).flatMap((node) => (node.oracle === undefined ? [] : [node.oracle])).find((entry) => entry.round === 2);
    expect(leaf?.label).toBe("unknown");
    expect(report.verdict).toBe("NEEDS-REVIEW");
    expect(report.decidedBy).toBe("items-classified");
  });
});

describe("verdict", () => {
  const warnings = (threshold: number) => moduleText(`warning_threshold: ${String(threshold)}
oracles:
  mentions(D, S):
    ask: The section names an owner.
    evidence: core.body(D, S)
constraints:
  problem-mentions:
    forall: core.section(D, 'problem-statement', _)
    require: mentions(D, 'problem-statement')
    severity: warning
    weight: 3
  rationale-mentions:
    forall: core.section(D, rationale, _)
    require: mentions(D, rationale)
    severity: warning
    weight: 1
`);
  const mentions = () => scriptedJudge((question) => ({ value: question.text.startsWith("## Problem") ? "holds" : "fails" }));

  it("uses the weighted ratio of satisfied warnings against the threshold", async () => {
    const pass = await run(warnings(0.75), mentions().backend);
    expect(pass).toMatchObject({ verdict: "PASS", decidedBy: "all-constraints" });
    const review = await run(warnings(0.8), mentions().backend);
    expect(review).toMatchObject({ verdict: "NEEDS-REVIEW", decidedBy: "warning-ratio" });
  });

  it("ranks a violated error above an engine failure, and an engine failure above review", async () => {
    const program = moduleText(`constraints:
  has-title:
    forall: core.section(D, S, root)
    require: core.child(D, S, missing)
    severity: error
`);
    const blockedJudge = scriptedJudge(() => ({ value: "unknown" }));
    const violated = await run(program, blockedJudge.backend);
    expect(violated).toMatchObject({ verdict: "NO-GO", decidedBy: "has-title" });

    const oracleProgram = moduleText(`oracles:
${PURPOSE_ORACLE}constraints:
  known:
    forall: core.section(D, S, _)
    require: purpose(D, S, P), P in [problem, scope]
    severity: error
`);
    const blocked = await run(oracleProgram, scriptedJudge(byHeading(PURPOSES)).backend, { policy: { maxEvidenceBytes: 10, forbiddenLiterals: [] } });
    expect(blocked).toMatchObject({ verdict: "BLOCKED", decidedBy: "engine" });
    expect(blocked.constraints[0]?.status).toBe("undetermined");
  });

  it("treats an empty population as vacuously satisfied and silent, counting zero in the full report", async () => {
    const program = moduleText(`constraints:
  appendix-exists:
    forall: core.section(D, appendix, _)
    require: core.depth(D, appendix, 2)
    severity: error
`);
    const report = await run(program, scriptedJudge(() => ({ value: "unknown" })).backend);
    expect(report.constraints[0]).toMatchObject({ population: 0, status: "satisfied", bindings: [] });
    expect(renderReport(report)).toContain("population 0 (0 certain)");
    expect(report.findings).toEqual([]);
    expect(report.verdict).toBe("PASS");
  });

  it("violates a `population: nonempty` constraint that binds nothing", async () => {
    const program = moduleText(`constraints:
  appendix-exists:
    forall: core.section(D, appendix, _)
    require: core.depth(D, appendix, 2)
    severity: error
    population: nonempty
    repair: Add an Appendix.
`);
    const report = await run(program, scriptedJudge(() => ({ value: "unknown" })).backend);
    expect(report.constraints[0]).toMatchObject({ population: 0, status: "violated" });
    expect(report.constraints[0]?.bindings[0]).toMatchObject({
      status: "violated", message: "appendix-exists: the population is empty (population: nonempty)", repair: "Add an Appendix.",
    });
    expect(report.verdict).toBe("NO-GO");
    const present = await run(program, scriptedJudge(() => ({ value: "unknown" })).backend, { markdown: "# D\n\n## Appendix\n\nA.\n" });
    expect(present.verdict).toBe("PASS");
  });

  it("refuses an unknown population value", async () => {
    const program = moduleText(`constraints:
  appendix-exists:
    forall: core.section(D, appendix, _)
    require: core.depth(D, appendix, 2)
    severity: error
    population: some
`);
    await expect(run(program, scriptedJudge(() => ({ value: "unknown" })).backend)).rejects.toThrow(/population/);
  });

  it("runs only the constraints of the selected profile", async () => {
    const program = moduleText(`constraints:
  always:
    forall: core.section(D, S, root)
    require: core.depth(D, S, 1)
    severity: error
  promotion-only:
    forall: core.section(D, S, root)
    require: core.depth(D, S, 9)
    severity: error
    profiles: [promotion]
`);
    const draft = await run(program, scriptedJudge(() => ({ value: "unknown" })).backend, { profile: "draft" });
    expect(draft).toMatchObject({ verdict: "PASS", skipped: ["promotion-only"] });
    const promotion = await run(program, scriptedJudge(() => ({ value: "unknown" })).backend, { profile: "promotion" });
    expect(promotion).toMatchObject({ verdict: "NO-GO", decidedBy: "promotion-only" });
  });
});
