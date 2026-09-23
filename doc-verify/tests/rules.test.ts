import { createMockJevJudgeBackend, type JudgeAnswer } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { assertRestrictedDml, buildDml } from "../src/dml.js";
import { evaluateSemantic } from "../src/semantic.js";
import type { ExpandedQuestion, ResolvedRubric, RubricItem } from "../src/rubric.js";
import { sectionId } from "../src/types.js";

const criticalItem: RubricItem = {
  id: "design.problem",
  artifact_kinds: ["design"],
  applies_to: { sections: ["problem"], scope: "combined" },
  evidence: { source: "section_body", max_bytes: 1000 },
  question: { kind: "choose", instruction: "Supported?", options: ["supported", "refuted", "unknown"] },
  critical: true,
  weight: 1,
  scores: { supported: 1, refuted: 0, unknown: 0 },
};
const question: ExpandedQuestion = { id: criticalItem.id, item: criticalItem, sectionIds: [sectionId("problem")], evidence: "evidence" };
const rubric: ResolvedRubric = { threshold: 0.8, items: [criticalItem], chain: [] };

describe("DML rules", () => {
  it.each([
    ["supported", "PASS"],
    ["refuted", "NO-GO"],
    ["unknown", "NEEDS-REVIEW"],
  ] as const)("maps %s through ordered Prolog clauses", async (answer, verdict) => {
    const backend = createMockJevJudgeBackend({ answers: [choiceAnswer(answer)] });
    const result = await evaluateSemantic({
      root: process.cwd(), artifactKind: "design", questions: [question], rubric,
      model: "jev-1.13.0", policyVersion: 1, maxEvidenceBytes: 10000,
      forbiddenLiterals: [], maxAgeSeconds: 3600, backend, useCache: false,
    });
    expect(result.outcome.verdict).toBe(verdict);
    expect(result.calls).toBe(1);
  });

  it("rejects prohibited DML capabilities", () => {
    const source = buildDml({ state: { evidence: "ok" }, questions: [question], threshold: 0.8 }).source;
    expect(source).toContain("judge(");
    expect(() => assertRestrictedDml(`${source}\ntask("escape", X).`)).toThrow("prohibited");
  });
});

function choiceAnswer(value: "supported" | "refuted" | "unknown"): JudgeAnswer {
  return { id: "q1", kind: "choose", value, confidence: 1, distribution: [1, 0, 0], basis: "calibrated" };
}
