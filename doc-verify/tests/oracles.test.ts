// Design 04 §Oracles and thresholds: binding by construction, threshold only demotes,
// a missing distribution is unknown with a finding, answers are cached per atom.

import { describe, expect, it } from "vitest";

import { applyThreshold, memoryOracleCache, runProgram } from "../src/engine/index.js";
import { byHeading, moduleText, PURPOSE_ORACLE, PURPOSES, run, scriptedJudge } from "./engine-helpers.js";

const KNOWN = moduleText(`oracles:
${PURPOSE_ORACLE.replace("threshold: 0.5", "threshold: 0.8")}constraints:
  every-section-known:
    forall: core.section(D, S, _)
    require: purpose(D, S, P), P in [problem, scope, rationale]
    severity: error
`);

function leaf(report: Awaited<ReturnType<typeof run>>, section: string) {
  return report.oracles.find((entry) => entry.atom.endsWith(`, ${section})`));
}

function binding(report: Awaited<ReturnType<typeof run>>, id: string, section: string) {
  return report.constraints.find((constraint) => constraint.id === id)?.bindings.find((entry) => entry.values.S === section);
}

describe("oracle thresholds", () => {
  it("demotes an answer below its threshold to unknown, never to another label", async () => {
    const { backend } = scriptedJudge((question) => question.text.startsWith("## Scope")
      ? { value: "scope", distribution: [0, 0.7, 0, 0.3, 0] }
      : byHeading(PURPOSES)(question));
    const report = await run(KNOWN, backend);
    expect(leaf(report, "scope")).toMatchObject({ answered: "scope", label: "unknown", threshold: 0.8, distribution: [0, 0.7, 0, 0.3, 0] });
    expect(binding(report, "every-section-known", "scope")?.status).toBe("undetermined");
    expect(binding(report, "every-section-known", "problem-statement")?.status).toBe("satisfied");
  });

  it("keeps an answer whose argmax value meets the threshold exactly", async () => {
    const { backend } = scriptedJudge((question) => question.text.startsWith("## Scope")
      ? { value: "scope", distribution: [0, 0.8, 0, 0.2, 0] }
      : byHeading(PURPOSES)(question));
    const report = await run(KNOWN, backend);
    expect(leaf(report, "scope")?.label).toBe("scope");
    expect(binding(report, "every-section-known", "scope")?.status).toBe("satisfied");
  });

  it("reads a missing distribution as unknown and adds a finding", async () => {
    const { backend } = scriptedJudge((question) => question.text.startsWith("## Rationale")
      ? { value: "rationale", distribution: "missing" }
      : byHeading(PURPOSES)(question));
    const report = await run(KNOWN, backend);
    expect(leaf(report, "rationale")).toMatchObject({ label: "unknown", distribution: [] });
    expect(report.findings.some((finding) => finding.includes("rationale") && finding.includes("no distribution"))).toBe(true);
    expect(binding(report, "every-section-known", "rationale")?.status).toBe("undetermined");
    expect(report.verdict).toBe("NO-GO");
  });

  it("follows the distribution's argmax, and a tie or an argmax of unknown is unknown", () => {
    const options = ["a", "b", "unknown"];
    expect(applyThreshold(options, { answered: "a", distribution: [0.6, 0.4, 0] }, 0.5)).toEqual({ label: "a", finding: undefined });
    expect(applyThreshold(options, { answered: "a", distribution: [0.2, 0.7, 0.1] }, 0.5).label).toBe("b");
    expect(applyThreshold(options, { answered: "a", distribution: [0.2, 0.7, 0.1] }, 0.5).finding).toMatch(/argmax is b/);
    expect(applyThreshold(options, { answered: "a", distribution: [0.5, 0.5, 0] }, 0).finding).toMatch(/ties/);
    expect(applyThreshold(options, { answered: "unknown", distribution: [0.1, 0.1, 0.8] }, 0).label).toBe("unknown");
    expect(applyThreshold(options, { answered: "a", distribution: [1, 0] }, 0)).toMatchObject({ label: "unknown" });
  });
});

describe("binding by construction", () => {
  it("names each atom's own evidence key in its instruction and binds answers by id", async () => {
    const forward = scriptedJudge(byHeading(PURPOSES));
    const reversedJudge = scriptedJudge(byHeading(PURPOSES));
    const reversing = {
      ...reversedJudge.backend,
      complete: async (request: Parameters<typeof reversedJudge.backend.complete>[0]) => {
        const response = await reversedJudge.backend.complete(request);
        return { ...response, answers: [...response.answers].reverse() };
      },
    };
    const first = await run(KNOWN, forward.backend);
    const second = await run(KNOWN, reversing);
    const request = forward.requests[0];
    const keys = Object.keys((request?.state as { evidence: Record<string, unknown> }).evidence);
    expect(new Set(keys).size).toBe(6);
    for (const question of request?.questions ?? []) {
      expect(question.instruction).toBe(`Judge ONLY state.evidence.${question.id}. What is this section for?`);
    }
    expect(second.oracles.map((entry) => [entry.atom, entry.label])).toEqual(first.oracles.map((entry) => [entry.atom, entry.label]));
    expect(leaf(first, "problem-statement")?.label).toBe("problem");
    expect(leaf(first, "rationale")?.label).toBe("rationale");
  });

  it("serves a repeated run from the per-atom cache without a request", async () => {
    const cache = memoryOracleCache();
    const cold = scriptedJudge(byHeading(PURPOSES));
    const warm = scriptedJudge(byHeading(PURPOSES));
    const first = await run(KNOWN, cold.backend, { cache });
    const second = await run(KNOWN, warm.backend, { cache });
    expect(cold.requests).toHaveLength(1);
    expect(warm.requests).toHaveLength(0);
    expect(second.oracles.every((entry) => entry.cacheHit)).toBe(true);
    expect(second.verdict).toBe(first.verdict);
  });
});

describe("outbound checks", () => {
  it("blocks an over-budget round and never splits it", async () => {
    const { backend, requests } = scriptedJudge(byHeading(PURPOSES));
    const report = await run(KNOWN, backend, { policy: { maxEvidenceBytes: 200, forbiddenLiterals: [] } });
    expect(requests).toHaveLength(0);
    expect(report.verdict).toBe("BLOCKED");
    expect(report.failure?.message).toMatch(/never split/);
  });

  it("gives NO-GO when the evidence carries a forbidden literal", async () => {
    const { backend, requests } = scriptedJudge(byHeading(PURPOSES));
    const report = await run(KNOWN, backend, { policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: ["soup on fridays"] } });
    expect(requests).toHaveLength(0);
    expect(report.verdict).toBe("NO-GO");
    expect(report.decidedBy).toBe("engine");
  });

  it("does not send an atom whose evidence names a section its document lacks", async () => {
    // S comes from the other document, so the atom's evidence cannot resolve.
    const program = moduleText(`oracles:
  mentions(D, S):
    ask: The section names an owner.
    evidence: core.body(D, S)
constraints:
  cross:
    forall: core.section(D, _, root), core.section(E, S, _), core.depth(E, S, 3)
    require: mentions(D, S)
    severity: error
`);
    const { backend, requests } = scriptedJudge(() => ({ value: "holds" }));
    const report = await runProgram({
      moduleYaml: program,
      documents: [
        { path: "a.md", markdown: "# A\n\ntext\n" },
        { path: "b.md", markdown: "# B\n\n## Part\n\n### Leaf\n\nleaf text\n" },
      ],
      backend, model: "jev-test", policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
    });
    const unsent = report.oracles.find((entry) => entry.atom.startsWith("t.mentions(a.md"));
    expect(unsent).toMatchObject({ key: "-", label: "unknown", sections: [] });
    expect(requests.flatMap((request) => request.questions)).toHaveLength(1);
    expect(report.findings.some((finding) => finding.includes("does not have"))).toBe(true);
  });
});
