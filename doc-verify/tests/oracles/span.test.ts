// The deciding span: option B (one follow-up over the evidence's sentences for a
// non-passing atom) and option C (the section span, labelled not judged, as fallback).

import { describe, expect, it } from "vitest";

import { memoryOracleCache } from "../../src/engine/index.js";
import { sentenceSpans } from "../../src/engine/oracles.js";
import { moduleText, run, scriptedJudge } from "../engine-helpers.js";

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

  it("a cached fails keeps its judged span, replayed from the follow-up cache", async () => {
    const cache = memoryOracleCache();
    const first = failing("s1");
    const one = await run(MODULE, first.backend, { cache });
    expect(one.oracles.find((oracle) => oracle.atom.includes("falsifies"))?.span).toMatchObject({ kind: "sentence", judged: true });
    // A second judge that would answer the follow-up `unknown`: if it were asked, the span would
    // fall back to the section. It is not asked, so the judged span is replayed from the cache.
    const second = failing("unknown");
    const two = await run(MODULE, second.backend, { cache });
    expect(second.requests).toHaveLength(0);
    expect(two.oracles.find((oracle) => oracle.atom.includes("falsifies"))?.span).toMatchObject({ kind: "sentence", judged: true });
  });

  it("a sentence that starts on the next line does not include the previous line", () => {
    const text = "Alpha beta.\nGamma delta\nepsilon.\n";
    const spans = sentenceSpans({ sections: ["s"], text, pieces: [{ id: "s", startLine: 10, offset: 0, text }] });
    expect(spans.map((span) => span.quote)).toEqual(["Alpha beta.", "Gamma delta epsilon."]);
    expect(spans[1]).toMatchObject({ startLine: 11, endLine: 12 });
  });

  it("a cached fails asks its follow-up when the follow-up cache is cold", async () => {
    const stored = new Map<string, { answered: string; distribution: number[] }>();
    const full = {
      get: (key: string) => stored.get(key),
      set: (key: string, value: { answered: string; distribution: number[] }) => { stored.set(key, value); },
    };
    await run(MODULE, failing("s1").backend, { cache: full });
    // Keep only the main-atom entries (their labels are the oracle's own); drop the follow-ups.
    const mainOnly = new Map([...stored].filter(([, value]) => ["holds", "fails", "unknown"].includes(value.answered)));
    const sparse = { get: (key: string) => mainOnly.get(key), set: () => undefined };
    const second = failing("s1");
    const report = await run(MODULE, second.backend, { cache: sparse });
    // The main came from the cache, so the only fresh call is the follow-up.
    expect(second.requests).toHaveLength(1);
    expect(report.oracles.find((oracle) => oracle.atom.includes("falsifies"))?.span).toMatchObject({ kind: "sentence", judged: true });
  });
});
