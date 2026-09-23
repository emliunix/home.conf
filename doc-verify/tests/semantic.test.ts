import { createMockJevJudgeBackend, type JudgeBackend } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { evaluateSemantic, PolicyViolationError } from "../src/semantic.js";
import type { ExpandedQuestion, ResolvedRubric, RubricItem } from "../src/rubric.js";
import { BlockedError, sectionId } from "../src/types.js";

const item: RubricItem = {
  id: "q", artifact_kinds: ["design"],
  applies_to: { sections: ["x"], scope: "combined" },
  evidence: { source: "section_body", max_bytes: 1000 },
  question: { kind: "choose", instruction: "Choose", options: ["supported", "refuted", "unknown"] },
  critical: true, weight: 1, scores: { supported: 1, refuted: 0, unknown: 0 },
};
const rubric: ResolvedRubric = { threshold: 1, items: [item], chain: [] };

function evaluate(evidence: string, backend: JudgeBackend) {
  const question: ExpandedQuestion = { id: "q", item, sectionIds: [sectionId("x")], evidence };
  return evaluateSemantic({
    root: process.cwd(), artifactKind: "design", questions: [question], rubric,
    model: "jev-1.13.0", policyVersion: 1, maxEvidenceBytes: 1000,
    forbiddenLiterals: ["private-canary"], maxAgeSeconds: 3600, backend, useCache: false,
  });
}

describe("semantic boundary", () => {
  it("blocks an unavailable required judge", async () => {
    const backend = createMockJevJudgeBackend({ answers: () => Promise.reject(new Error("secret response body")) });
    await expect(evaluate("safe", backend)).rejects.toThrow(BlockedError);
  });

  it("rejects prohibited outbound evidence before calling the backend", async () => {
    let calls = 0;
    const backend = createMockJevJudgeBackend({ answers: () => { calls += 1; return []; } });
    await expect(evaluate("PRIVATE-CANARY", backend)).rejects.toThrow(PolicyViolationError);
    expect(calls).toBe(0);
  });

  it("changes the request identity when evidence changes", async () => {
    const backend = createMockJevJudgeBackend({ choice: "first" });
    const first = await evaluate("one", backend);
    const second = await evaluate("two", backend);
    expect(first.requestId).not.toBe(second.requestId);
  });
});
