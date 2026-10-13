/**
 * Round 7 finding 1 (count-bound): a bound count result loses undefinedness
 * (gate-ledger item 7), fixed in core.pl's core_count/3 (design/06 step 3).
 * Finding 3 (fresh instance per check) is not a test here.
 */

import { describe, expect, it } from "vitest";

import { Kernel, translateWitness } from "../../src/kernel/index.js";

const MINIMAL_REQUIRE = {
  module: `schema_version: 2
kind: verification-module
module: w
rounds: 9
imports: {core: doc-verify:core}
oracles:
  o1(D, S):
    ask: q
    evidence: core.own(D, S)
rules: {}
constraints:
  c3:
    forall: "core.section(D, S, _)"
    require: "count(C0, (core.section(D, C0, _), o1(D, C0)), N0), N0 >= 1, count(C1, (core.section(D, C1, _), o1(D, C1)), N0), N0 >= 1"
    severity: error
`,
  facts: ["section(d, b, root)", "heading(d, b, notes)", "depth(d, b, 1)"],
};

const HANDMADE_FORBID = {
  module: `schema_version: 2
kind: verification-module
module: w
rounds: 9
imports: {core: doc-verify:core}
oracles:
  o2(D, S):
    ask: q
    evidence: core.own(D, S)
constraints:
  c2:
    forall: "core.section(D, S, _)"
    forbid: "count(S2, (core.section(D, S2, _), o2(D, S2)), N), N >= 2, count(S2, (core.section(D, S2, _), o2(D, S2)), N), N >= 2"
    severity: error
`,
  facts: [
    "section(d, a, root)", "heading(d, a, h)", "depth(d, a, 1)",
    "section(d, b, root)", "heading(d, b, h)", "depth(d, b, 1)",
    "section(d, c, root)", "heading(d, c, h)", "depth(d, c, 1)",
  ],
};

const SAME_GOAL_COUNTS = {
  module: `schema_version: 2
kind: verification-module
module: w
rounds: 9
imports: {core: doc-verify:core}
oracles:
  o1(D, S):
    ask: q
    evidence: core.own(D, S)
rules:
  p1(D, S0): core.section(D, S0, _), count(C0, (core.section(D, C0, _), o1(D, C0)), N0), N0 >= 1, count(C1, (core.section(D, C1, _), o1(D, C1)), N0), N0 >= 1
constraints:
  c1:
    forall: "core.section(D, S, _)"
    require: "p1(D, S)"
    severity: error
`,
  facts: [
    "section(d, a, root)", "heading(d, a, notes)", "depth(d, a, 1)",
    "section(d, b, a)", "heading(d, b, notes)", "depth(d, b, 1)",
  ],
};

describe("round 7 count-bound (gate-ledger item 7)", () => {
  it("identical count goals sharing N0 with o1(d,b) holds are satisfied/PASS (lead count refine)", async () => {
    const tr = await translateWitness(SAME_GOAL_COUNTS);
    const kernel = await Kernel.create();
    await kernel.load(tr.text);
    kernel.setAnswers({ "w::o1(d,b)": "holds" });
    const result = kernel.evaluate(tr.program);
    const statuses = result.statuses.c1?.map((r) => r.status) ?? [];
    expect(statuses.every((s) => s === "satisfied"), `got ${JSON.stringify(result.statuses.c1)}`).toBe(true);
    expect(result.verdict).toBe("PASS");
  }, 60_000);

  it("minimal require (two counts sharing N0, ans {}) is undetermined not violated", async () => {
    const tr = await translateWitness(MINIMAL_REQUIRE);
    const kernel = await Kernel.create();
    await kernel.load(tr.text);
    kernel.setAnswers({});
    const result = kernel.evaluate(tr.program);
    const statuses = result.statuses.c3?.map((r) => r.status) ?? [];
    expect(statuses.every((s) => s === "undetermined"), `got ${JSON.stringify(result.statuses.c3)}`).toBe(true);
    expect(result.verdict).toBe("NEEDS-REVIEW");
  }, 60_000);

  it("hand-made forbid (repeated count under N) is undetermined not satisfied", async () => {
    const tr = await translateWitness(HANDMADE_FORBID);
    const kernel = await Kernel.create();
    await kernel.load(tr.text);
    kernel.setAnswers({ "w::o2(d,a)": "holds" });
    const result = kernel.evaluate(tr.program);
    const statuses = result.statuses.c2?.map((r) => r.status) ?? [];
    expect(statuses.every((s) => s === "undetermined"), `got ${JSON.stringify(result.statuses.c2)}`).toBe(true);
    expect(result.verdict).toBe("NEEDS-REVIEW");
  }, 60_000);
});
