/**
 * Design 06 A: violated bindings carry a non-empty proof; violated requires name `missing`.
 * B.2: decideVerdict agrees with core_verdict on the host ConstraintReport shape.
 */

import { describe, expect, it } from "vitest";

import { decideVerdict, type ConstraintReport } from "../../src/engine/diagnostics.js";
import { Kernel, translateWitness } from "../../src/kernel/index.js";

const VIOLATED = {
  module: `schema_version: 2
kind: verification-module
module: w
rounds: 1
imports: {core: doc-verify:core}
constraints:
  has-goal:
    forall: core.section(D, S, root)
    require: core.heading(D, S, 'Goal')
    severity: error
`,
  facts: [
    "section(d, intro, root)",
    "heading(d, intro, 'Introduction')",
    "depth(d, intro, 2)",
  ],
};

describe("kernel proof trees (design 06)", () => {
  it("a violated binding has a non-empty proof and a missing literal", async () => {
    const tr = await translateWitness(VIOLATED);
    const kernel = await Kernel.create();
    await kernel.load(tr.text);
    kernel.setAnswers({});
    const result = kernel.evaluate(tr.program);
    expect(result.statuses["has-goal"]?.[0]?.status).toBe("violated");
    const miss = result.missing["has-goal"] ?? [];
    expect(miss.length).toBeGreaterThan(0);
    expect(miss[0]?.literal).toMatch(/heading/);
    const proof = result.proofs["has-goal"]?.[0]?.tree ?? "";
    expect(proof.length).toBeGreaterThan(0);
    expect(proof).toContain("missing");
    expect(result.verdict).toBe("NO-GO");

    const hostShape: ConstraintReport[] = [{
      id: "has-goal",
      status: "violated",
      severity: "error",
      weight: 1,
      mode: "require",
      population: 1,
      certainPopulation: 1,
      bindings: [{
        status: "violated",
        certain: true,
        values: { D: "d", S: "intro" },
        message: "x",
        repair: undefined,
        missing: [miss[0]!.literal],
        proof: { kind: "binding", atom: "has-goal: violated", children: [{ kind: "missing", atom: "x", mode: "possible" }] },
      }],
    }];
    expect(decideVerdict(hostShape, undefined, 1).verdict).toBe(result.verdict);
  }, 60_000);
});
