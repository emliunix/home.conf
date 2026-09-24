import { createMockJevJudgeBackend, type JudgeAnswer } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { evaluateSemantic } from "../src/semantic.js";
import type { ExpandedQuestion, ResolvedRubric, RubricItem } from "../src/rubric.js";
import { sectionId } from "../src/types.js";

function item(id: string, critical: boolean, weight = 1): RubricItem {
  return {
    id, artifact_kinds: ["design"],
    applies_to: { sections: [id], scope: "combined" },
    evidence: { source: "section_body", max_bytes: 1000 },
    question: { kind: "choose", instruction: id, options: ["supported", "refuted", "unknown"] },
    critical, weight, scores: { supported: 1, refuted: 0, unknown: 0 },
  };
}

describe("semantic mutations", () => {
  it("turns a passing noncritical score into review below threshold", async () => {
    const first = item("first", false, 1);
    const second = item("second", false, 3);
    const questions: ExpandedQuestion[] = [first, second].map((entry) => ({
      id: entry.id, item: entry, sectionIds: [sectionId(entry.id)], evidence: entry.id,
    }));
    const rubric: ResolvedRubric = { threshold: 0.8, items: [first, second], chain: [] };
    const answers: JudgeAnswer[] = [
      { id: "q1", kind: "choose", value: "supported", confidence: 1, distribution: [1, 0, 0], basis: "calibrated" },
      { id: "q2", kind: "choose", value: "refuted", confidence: 1, distribution: [0, 1, 0], basis: "calibrated" },
    ];
    const result = await evaluateSemantic({
      root: process.cwd(), artifactKind: "design", questions, rubric,
      model: "jev-1.13.0", policyVersion: 1, maxEvidenceBytes: 1000,
      forbiddenLiterals: [], maxAgeSeconds: 3600,
      backend: createMockJevJudgeBackend({ answers }), useCache: false,
    });
    expect(result.outcome.verdict).toBe("NEEDS-REVIEW");
    expect(result.outcome.ruleId).toBe("weighted.threshold");
  });

  it("counts supported critical weight in the overall threshold", async () => {
    const critical = item("critical", true, 95);
    const hygiene = item("hygiene", false, 5);
    const questions: ExpandedQuestion[] = [critical, hygiene].map((entry) => ({
      id: entry.id, item: entry, sectionIds: [sectionId(entry.id)], evidence: entry.id,
    }));
    const rubric: ResolvedRubric = { threshold: 0.85, items: [critical, hygiene], chain: [] };
    const answers: JudgeAnswer[] = [
      { id: "q1", kind: "choose", value: "supported", confidence: 1, distribution: [1, 0, 0], basis: "calibrated" },
      { id: "q2", kind: "choose", value: "refuted", confidence: 1, distribution: [0, 1, 0], basis: "calibrated" },
    ];
    const result = await evaluateSemantic({
      root: process.cwd(), artifactKind: "design", questions, rubric,
      model: "jev-1.13.0", policyVersion: 1, maxEvidenceBytes: 1000,
      forbiddenLiterals: [], maxAgeSeconds: 3600,
      backend: createMockJevJudgeBackend({ answers }), useCache: false,
    });
    expect(result.outcome.verdict).toBe("PASS");
    expect(result.outcome.ruleId).toBe("all.required.facts");
  });
});
