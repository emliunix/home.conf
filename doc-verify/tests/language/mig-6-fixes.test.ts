/**
 * Brief 6: count must capture variables bound by sibling body literals (not only head/forall).
 */

import { describe, expect, it } from "vitest";

import { translateWitness } from "../../src/kernel/index.js";
import { moduleText, run, scriptedJudge } from "../engine-helpers.js";

/** # T / ## A / ### B / ## C — two depth-2 sections (A, C) and one depth-3 (B). */
const TREE = `# T

## A

### B

## C
`;

const FACTS = [
  "section(d, t, root)", "heading(d, t, t)", "depth(d, t, 1)",
  "section(d, a, t)", "heading(d, a, a)", "depth(d, a, 2)", "child(d, t, a)",
  "section(d, b, a)", "heading(d, b, b)", "depth(d, b, 3)", "child(d, a, b)",
  "section(d, c, t)", "heading(d, c, c)", "depth(d, c, 2)", "child(d, t, c)",
];

describe("mig-6: count captures sibling-bound variables", () => {
  it("constraint goal: depth(D,S,K) then count(... depth(D,V,K) ...) — satisfied", async () => {
    const mod = moduleText(`constraints:
  same-depth-pair:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: core.depth(D, S, K), count(V, (core.section(D, V, _), core.depth(D, V, K)), N), N =:= 2
    severity: error
`);
    const tr = await translateWitness({ module: mod, facts: FACTS });
    // K must be a parameter of the aux, not free inside it.
    expect(tr.text).toMatch(/core_aux_\d+\([^)]*_V_K/);
    expect(tr.text).not.toMatch(/core_aux_\d+\(_V_D,_V_V\)\s*:-\s*core_section/);
    const report = await run(mod, scriptedJudge(() => ({ value: "unknown" })).backend, { markdown: TREE });
    expect(report.verdict).toBe("PASS");
    expect(report.constraints[0]?.bindings.every((b) => b.status === "satisfied")).toBe(true);
  });

  it("rule body: sibling-bound K captured by count — satisfied", async () => {
    const mod = moduleText(`rules:
  two_at_depth(D, S): core.section(D, S, _), core.depth(D, S, K), count(V, (core.section(D, V, _), core.depth(D, V, K)), N), N =:= 2
constraints:
  c1:
    forall: core.section(D, S, _), core.depth(D, S, 2)
    require: two_at_depth(D, S)
    severity: error
`);
    const tr = await translateWitness({ module: mod, facts: FACTS });
    expect(tr.text).toMatch(/core_aux_\d+\([^)]*_V_K/);
    const report = await run(mod, scriptedJudge(() => ({ value: "unknown" })).backend, { markdown: TREE });
    expect(report.verdict).toBe("PASS");
  });

  it("forall binds K used in a count in the goal — satisfied", async () => {
    const mod = moduleText(`constraints:
  c1:
    forall: core.section(D, S, _), core.depth(D, S, K), K =:= 2
    require: count(V, (core.section(D, V, _), core.depth(D, V, K)), N), N =:= 2
    severity: error
`);
    // Forall-bound K is in outer via bodyText(headTerms from forall names); also a sibling of the
    // goal's count through constraint translation (goal outer = forall vars).
    const tr = await translateWitness({ module: mod, facts: FACTS });
    expect(tr.text).toMatch(/core_aux_\d+\([^)]*_V_K/);
    const report = await run(mod, scriptedJudge(() => ({ value: "unknown" })).backend, { markdown: TREE });
    expect(report.verdict).toBe("PASS");
  });
});
