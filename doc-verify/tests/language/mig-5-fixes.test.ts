/**
 * Brief 5 re-review: count-goal negation lifting, oracle-negation refusal, shared unsafe not.
 */

import { describe, expect, it } from "vitest";

import { compileModule, ModuleError } from "../../src/engine/index.js";
import { translateWitness } from "../../src/kernel/index.js";
import { moduleText, PURPOSE_ORACLE, run, scriptedJudge } from "../engine-helpers.js";

const TREE = `# T

## A

### B
`;

const COUNT_DIFF_DEPTH = `constraints:
  deeper-exists:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: count(V, (core.section(D, V, _), core.depth(D, V, K), not core.depth(D, S, K)), N), N >= 1
    severity: error
`;

describe("mig-5: negation lifting uses body-local bound set", () => {
  it("count goal: earlier positive binds K used in not — satisfied over # T / ## A / ### B", async () => {
    const report = await run(moduleText(COUNT_DIFF_DEPTH), scriptedJudge(() => ({ value: "unknown" })).backend, {
      markdown: TREE,
    });
    expect(report.verdict).toBe("PASS");
    expect(report.constraints[0]?.bindings.every((b) => b.status === "satisfied")).toBe(true);
    // Translation must not lift K into an existential (would yield count 0 / NO-GO).
    const tr = await translateWitness({
      module: moduleText(COUNT_DIFF_DEPTH),
      facts: [
        "section(d, t, root)", "heading(d, t, t)", "depth(d, t, 1)",
        "section(d, a, t)", "heading(d, a, a)", "depth(d, a, 2)", "child(d, t, a)",
        "section(d, b, a)", "heading(d, b, b)", "depth(d, b, 3)", "child(d, a, b)",
      ],
    });
    expect(tr.text).not.toMatch(/core_neg_\d+\([^)]*\)\s*:-\s*core_depth/);
    expect(tr.text).toMatch(/core_naf\(core_depth\(/);
  });

  it("rule body: earlier positive binds K used in not — satisfied", async () => {
    const mod = moduleText(`rules:
  has_other_depth(D, S): core.section(D, S, _), core.section(D, V, _), core.depth(D, V, K), not core.depth(D, S, K)
constraints:
  c1:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: has_other_depth(D, S)
    severity: error
`);
    const report = await run(mod, scriptedJudge(() => ({ value: "unknown" })).backend, { markdown: TREE });
    expect(report.verdict).toBe("PASS");
  });

  it("forall/goal: earlier positive in goal binds K used in not — satisfied", async () => {
    const mod = moduleText(`constraints:
  c1:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: core.section(D, V, _), core.depth(D, V, K), not core.depth(D, S, K)
    severity: error
`);
    const report = await run(mod, scriptedJudge(() => ({ value: "unknown" })).backend, { markdown: TREE });
    expect(report.verdict).toBe("PASS");
  });
});

describe("mig-5: oracle negation refused when args unbound", () => {
  it("named local output not purpose(D,S,Q) is refused in the checker", async () => {
    const mod = moduleText(`oracles:
${PURPOSE_ORACLE}constraints:
  c1:
    forall: core.section(D, S, _)
    require: not purpose(D, S, Q)
    severity: error
`);
    await expect(compileModule(mod)).rejects.toThrow(/oracle negation is not lifted|needs every argument bound/);
  });

  it("named local input not purpose(D,Z,other) is refused in the checker", async () => {
    const mod = moduleText(`oracles:
${PURPOSE_ORACLE}constraints:
  c1:
    forall: core.section(D, S, _)
    require: not purpose(D, Z, other)
    severity: error
`);
    await expect(compileModule(mod)).rejects.toBeInstanceOf(ModuleError);
    await expect(compileModule(mod)).rejects.toThrow(/oracle negation is not lifted|needs every argument bound/);
  });
});
