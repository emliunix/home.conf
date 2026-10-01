import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

function evaluate(evidence: string, backend: JudgeBackend, root = process.cwd(), useCache = false) {
  const question: ExpandedQuestion = { id: "q", item, sectionIds: [sectionId("x")], segments: [{ id: "x", ctx: "design/x.md", text: evidence }] };
  return evaluateSemantic({
    root, artifactKind: "design", questions: [question], rubric,
    model: "jev-1.13.0", policyVersion: 1, maxEvidenceBytes: 1000,
    forbiddenLiterals: ["private-canary"], maxAgeSeconds: 3600, backend, useCache,
  });
}

describe("semantic boundary", () => {
  it("blocks an unavailable required judge", async () => {
    const backend = createMockJevJudgeBackend({ answers: () => Promise.reject(new Error("secret response body")) });
    await expect(evaluate("safe", backend)).rejects.toThrow(BlockedError);
  });

  it("names the measured bytes and the limit when the evidence is over budget", async () => {
    let calls = 0;
    const backend = createMockJevJudgeBackend({ answers: () => { calls += 1; return []; } });
    // 1000 is this file's limit; the canonical state wraps the evidence, so this exceeds it
    const error = await evaluate("x".repeat(1200), backend).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BlockedError);
    const message = (error as Error).message;
    const measured = /the round's evidence is (\d+) bytes/.exec(message)?.[1];
    expect(measured, `the refusal must carry the measured byte count: ${message}`).toBeDefined();
    expect(Number(measured)).toBeGreaterThan(1000);
    expect(message).toContain("above the outbound budget of 1000");
    expect(message).toContain("a batch is never split");
    expect(calls).toBe(0);
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

  it("returns the judge's confidence and distribution, and keeps them through the cache", async () => {
    const backend = createMockJevJudgeBackend({
      answers: (request) => request.questions.map((question) => ({
        id: question.id, kind: "choose", value: "refuted",
        confidence: 0.62, distribution: [0.3, 0.62, 0.08], basis: "mock",
      })),
    });
    const root = await mkdtemp(path.join(os.tmpdir(), "doc-verify-semantic-"));
    try {
      const fresh = await evaluate("text", backend, root, true);
      expect(fresh.outcome.answers).toEqual(["refuted"]);
      expect(fresh.details).toEqual([{ confidence: 0.62, distribution: [0.3, 0.62, 0.08] }]);
      const cached = await evaluate("text", backend, root, true);
      expect(cached.cacheHits).toBe(1);
      expect(cached.details).toEqual(fresh.details);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
