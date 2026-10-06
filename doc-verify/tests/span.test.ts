// The deciding span: option B (one follow-up over the evidence's sentences for a
// non-passing atom) and option C (the section span, labelled not judged, as fallback).

import { describe, expect, it } from "vitest";

import { moduleText, run, scriptedJudge } from "./engine-helpers.js";

const MODULE = moduleText(`oracles:
  falsifies(D, S):
    ask: This verification text names a check that would fail if its claim were false.
    evidence: core.body(D, S)
    threshold: 0.5
constraints:
  verification-falsifies:
    forall: core.section(D, S, P), core.depth(D, S, 2)
    require: falsifies(D, S)
    severity: error
`);

const failing = (spanAnswer: string) =>
  scriptedJudge((question) =>
    question.options.includes("s0")
      ? { value: spanAnswer }
      : { value: "fails", distribution: [0, 1, 0] });

describe("the deciding span", () => {
  it("asks one follow-up over the sentences and records the judge's chosen span (B)", async () => {
    const { backend, requests } = failing("s1");
    const report = await run(MODULE, backend);
    const leaf = report.oracles.find((oracle) => oracle.atom.includes("falsifies"));
    expect(leaf?.label).toBe("fails");
    expect(leaf?.span).toMatchObject({ kind: "sentence", judged: true });
    expect(leaf?.span?.quote.length ?? 0).toBeGreaterThan(0);
    // One main batch, then one follow-up batch whose options are the sentence ids.
    expect(requests).toHaveLength(2);
    const followUp = requests[1]?.questions ?? [];
    expect(followUp.length).toBeGreaterThan(0);
    expect(followUp.every((question) => (question.options ?? []).every((option) => /^s\d+$/.test(option.id)))).toBe(true);
  });

  it("falls back to the section span, labelled not judged, when the judge cannot answer (C)", async () => {
    const { backend } = failing("unknown");
    const report = await run(MODULE, backend);
    const leaf = report.oracles.find((oracle) => oracle.atom.includes("falsifies"));
    expect(leaf?.span).toMatchObject({ kind: "section", judged: false });
  });
});
