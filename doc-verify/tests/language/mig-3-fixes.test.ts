/**
 * Brief 3 review fixes: budget/resource BLOCKED, negation proofs, verdict parity, count refine.
 */

import { describe, expect, it, vi } from "vitest";

import { compileModule } from "../../src/engine/index.js";
import { Kernel } from "../../src/kernel/kernel.js";
import { translateWitness } from "../../src/kernel/index.js";
import { byHeading, moduleText, PURPOSE_ORACLE, PURPOSES, run, scriptedJudge } from "../engine-helpers.js";

function nodes(node: { kind: string; atom?: string; children?: unknown[] } | undefined): Array<{ kind: string; atom?: string }> {
  if (node === undefined) return [];
  return [node, ...(node.children ?? []).flatMap((c) => nodes(c as typeof node))];
}

describe("mig-3: budget and resource", () => {
  it("a tiny inference budget yields BLOCKED (decidedBy budget), never PASS", async () => {
    const program = moduleText(`oracles:
${PURPOSE_ORACLE}constraints:
  known:
    forall: core.section(D, S, _)
    require: purpose(D, S, P), P in [problem, scope, rationale]
    severity: error
`);
    const report = await run(program, scriptedJudge(byHeading(PURPOSES)).backend, { inferenceBudget: 50 });
    expect(report.verdict).toBe("BLOCKED");
    expect(report.decidedBy).toBe("budget");
    expect(report.failure?.verdict).toBe("BLOCKED");
    expect(report.constraints.every((c) => c.status === "undetermined")).toBe(true);
    expect(report.constraints.some((c) => c.status === "satisfied")).toBe(false);
  });

  it("a kernel resource error yields BLOCKED (decidedBy resource)", async () => {
    const spy = vi.spyOn(Kernel.prototype, "evaluate").mockReturnValueOnce({
      statuses: {},
      certain: {},
      populations: {},
      proofs: {},
      demand: { full: [], prefix: [] },
      missing: {},
      unfounded: {},
      resource: "stack",
    });
    try {
      const program = moduleText(`constraints:
  has-title:
    forall: core.section(D, S, root)
    require: core.depth(D, S, 1)
    severity: error
`);
      const report = await run(program, scriptedJudge(() => ({ value: "unknown" })).backend);
      expect(report.verdict).toBe("BLOCKED");
      expect(report.decidedBy).toBe("resource");
      expect(report.failure?.message).toMatch(/resource/);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("mig-3: negation proof trees", () => {
  const LEAF = moduleText(`rules:
  has_child(D, S): core.child(D, S, _)
  leaf(D, S): core.section(D, S, _), not has_child(D, S)
constraints:
  top-level-is-leaf:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: leaf(D, S)
    severity: error
`);

  it("a satisfied binding through not has_child keeps a not node in the proof", async () => {
    const report = await run(LEAF, scriptedJudge(() => ({ value: "unknown" })).backend);
    const binding = report.constraints[0]?.bindings.find((b) => b.values.S === "problem-statement");
    expect(binding?.status).toBe("satisfied");
    const all = nodes(binding?.proof);
    expect(all.some((n) => n.kind === "not")).toBe(true);
    expect(all.some((n) => n.kind === "builtin" && n.atom === "proof could not be built")).toBe(false);
  });

  it("a violated binding's missing prefix can include the negated rule", async () => {
    const report = await run(LEAF, scriptedJudge(() => ({ value: "unknown" })).backend);
    const binding = report.constraints[0]?.bindings.find((b) => b.values.S === "scope");
    expect(binding?.status).toBe("violated");
    expect(binding?.missing.length).toBeGreaterThan(0);
    const all = nodes(binding?.proof);
    expect(all.some((n) => n.kind === "missing" || (binding?.missing.length ?? 0) > 0)).toBe(true);
    // Prefix under missing / goal should mention leaf or not has_child, not vanish.
    expect(all.length).toBeGreaterThan(1);
  });
});

describe("mig-3: verdict parity (core_verdict kept)", () => {
  async function kernelVerdict(moduleYaml: string, answers: Record<string, string> = {}) {
    const tr = await translateWitness({ module: moduleYaml, facts: [
      "section(d, a, root)", "heading(d, a, 'A')", "depth(d, a, 2)",
      "section(d, b, root)", "heading(d, b, 'B')", "depth(d, b, 2)",
      "child(d, a, b)",
    ] });
    const kernel = await Kernel.create();
    await kernel.load(tr.text);
    kernel.setAnswers(answers);
    return kernel.evaluate(tr.program).verdict;
  }

  it("PASS: core_verdict and decideVerdict agree", async () => {
    const mod = moduleText(`constraints:
  depth-2-ok:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: core.heading(D, S, _)
    severity: error
`);
    const report = await run(mod, scriptedJudge(() => ({ value: "unknown" })).backend);
    expect(report.verdict).toBe("PASS");
    const kv = await kernelVerdict(mod);
    expect(kv).toBe("PASS");
  });

  it("NO-GO: core_verdict and decideVerdict agree", async () => {
    const mod = moduleText(`constraints:
  has-goal:
    forall: core.section(D, S, root)
    require: core.heading(D, S, 'Goal')
    severity: error
`);
    const report = await run(mod, scriptedJudge(() => ({ value: "unknown" })).backend);
    expect(report.verdict).toBe("NO-GO");
    const kv = await kernelVerdict(mod);
    expect(kv).toBe("NO-GO");
  });

  it("NEEDS-REVIEW via warning ratio: decideVerdict matches the host path", async () => {
    const mod = moduleText(`oracles:
  mentions(D, S):
    ask: names an owner
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
warning_threshold: 0.8
`);
    // problem holds, rationale fails → ratio 3/4 = 0.75 < 0.8
    const report = await run(mod, scriptedJudge((q) => ({
      value: q.text.startsWith("## Problem") ? "holds" : "fails",
    })).backend);
    expect(report.verdict).toBe("NEEDS-REVIEW");
    expect(report.decidedBy).toBe("warning-ratio");
  });

  it("nonempty population violation is NO-GO on both sides", async () => {
    const mod = moduleText(`constraints:
  appendix-exists:
    forall: core.section(D, appendix, _)
    require: core.depth(D, appendix, 2)
    severity: error
    population: nonempty
`);
    const report = await run(mod, scriptedJudge(() => ({ value: "unknown" })).backend);
    expect(report.verdict).toBe("NO-GO");
    const kv = await kernelVerdict(mod);
    expect(kv).toBe("NO-GO");
  });
});

describe("mig-3: checker refuses unsafe shared negation", () => {
  it("compileModule rejects a variable shared across not and a later literal", async () => {
    const mod = moduleText(`rules:
  bad(D, S, Y): core.section(D, S, _), not core.child(D, S, Y), core.heading(D, Y, _)
constraints:
  c1:
    forall: core.section(D, S, _)
    require: bad(D, S, Y)
    severity: error
`);
    await expect(compileModule(mod)).rejects.toThrow(/shared with other literals/);
  });
});
