import { createMockJevJudgeBackend } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { evaluateSemantic, PolicyViolationError } from "../src/semantic.js";
import type { ExpandedQuestion, ResolvedRubric, RubricItem } from "../src/rubric.js";
import { sectionId } from "../src/types.js";

const item: RubricItem = {
  id: "private.boundary", artifact_kinds: ["design"],
  applies_to: { sections: ["x"], scope: "combined" },
  evidence: { source: "section_body", max_bytes: 1000 },
  question: { kind: "choose", instruction: "Safe?", options: ["supported", "refuted", "unknown"] },
  critical: true, weight: 1, scores: { supported: 1, refuted: 0, unknown: 0 },
};
const rubric: ResolvedRubric = { threshold: 1, items: [item], chain: [] };

describe("confidentiality policy", () => {
  it("keeps a local-only canary outside the adapter", async () => {
    let captured = "";
    const backend = createMockJevJudgeBackend({
      answers: (request) => {
        captured = JSON.stringify(request);
        return [];
      },
    });
    const question: ExpandedQuestion = {
      id: item.id,
      item,
      sectionIds: [sectionId("x")],
      evidence: "LOCAL-ONLY-CANARY",
    };
    await expect(evaluateSemantic({
      root: process.cwd(), artifactKind: "design", questions: [question], rubric,
      model: "jev-1.13.0", policyVersion: 1, maxEvidenceBytes: 1000,
      forbiddenLiterals: ["local-only-canary"], maxAgeSeconds: 3600, backend, useCache: false,
    })).rejects.toThrow(PolicyViolationError);
    expect(captured).toBe("");
  });
});
