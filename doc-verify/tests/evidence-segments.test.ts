import { createMockJevJudgeBackend } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/hash.js";
import { expandRubric, type ExpandedQuestion, type ResolvedRubric, type RubricItem } from "../src/rubric.js";
import { segmentMarkdown } from "../src/segments.js";
import { buildEvidenceState, evaluateSemantic } from "../src/semantic.js";
import { BlockedError } from "../src/types.js";

const PATH = "design/103-fixture.md";

/** One parent section with three child H3s, each child body bounded and distinct. */
function fixture(): { markdown: string; sections: ReturnType<typeof segmentMarkdown> } {
  const parentBody = Array.from(
    { length: 120 },
    (_, index) => `rationale line ${String(index)} carrying enough words to accumulate bytes`,
  ).join("\n");
  const markdown = [
    "# Title",
    "intro",
    "## Rationale",
    parentBody,
    "### First",
    "first body about the first child",
    "### Second",
    "second body about the second child",
    "### Third",
    "third body about the third child",
    "",
  ].join("\n");
  return { markdown, sections: segmentMarkdown(markdown) };
}

function item(id: string, sections: string[], maxBytes = 40000, weight = 10): RubricItem {
  return {
    id,
    artifact_kinds: ["design"],
    applies_to: { sections, scope: "combined" },
    evidence: { source: "section_body", max_bytes: maxBytes },
    question: { kind: "choose", instruction: `Judge ${id}`, options: ["supported", "refuted", "unknown"] },
    critical: false,
    weight,
    scores: { supported: 1, refuted: 0, unknown: 0 },
  };
}

function questionsFor(rubric: ResolvedRubric, sections: ReturnType<typeof segmentMarkdown>): ExpandedQuestion[] {
  return expandRubric({ rubric, artifactKind: "design", artifactPath: PATH, sections });
}

/** Two items that both read the same parent body, plus one that reads a single child. */
function sharedParentRubric(): ResolvedRubric {
  const items = [item("parent.first", ["rationale"]), item("parent.second", ["rationale"]), item("child.one", ["rationale/first"])];
  return { threshold: 0.8, items, chain: [] };
}

describe("evidence segments", () => {
  it("(a) does not repeat a shared parent body once per question", () => {
    const { sections } = fixture();
    const questions = questionsFor(sharedParentRubric(), sections);
    expect(questions.map((question) => question.id)).toEqual(["parent.first", "parent.second", "child.one"]);

    const state = buildEvidenceState({ artifactKind: "design", questions });
    // Three questions, but the parent body is one stored segment referenced twice.
    expect(state.questions).toHaveLength(3);
    expect(state.segments.filter((segment) => segment.id === "rationale")).toHaveLength(1);
    expect(state.questions.filter((question) => question.segment_ids.includes("rationale"))).toHaveLength(2);

    // The parent's bounded body excludes every child body, so no child is sent twice.
    const parent = state.segments.find((segment) => segment.id === "rationale");
    expect(parent?.text).toContain("rationale line 0");
    expect(parent?.text).not.toContain("first body");
    expect(parent?.text).not.toContain("third body");

    // One copy of the body, not two: the state is bounded by distinct segments.
    const oneCopy = Buffer.byteLength(canonicalJson({
      ...state,
      questions: state.questions.slice(0, 1),
    }));
    const threeQuestions = Buffer.byteLength(canonicalJson(state));
    expect(threeQuestions - oneCopy).toBeLessThan(500);
  });

  it("(b) carries the parent heading path in ctx while the segment text stays bounded", () => {
    const { sections } = fixture();
    const questions = questionsFor(sharedParentRubric(), sections);
    const child = questions.find((question) => question.id === "child.one");
    expect(child?.segments).toHaveLength(1);

    const [segment] = child?.segments ?? [];
    // Context: the document's path identity plus the ancestor heading path.
    // The full ancestor heading path, outermost first, behind the path identity.
    expect(segment?.ctx).toBe(`${PATH} › Title › Rationale`);
    // Text: the child's own body only, never the ancestor body.
    expect(segment?.text).toContain("first body about the first child");
    expect(segment?.text).not.toContain("rationale line 0");
    // A top-level section carries the path identity with no heading path.
    const topLevel = questionsFor({ threshold: 0.8, items: [item("top", ["title"])], chain: [] }, sections);
    expect(topLevel[0]?.segments[0]?.ctx).toBe(PATH);
  });

  it("(c) keeps the serialized semantic state inside the configured budget", async () => {
    const { sections } = fixture();
    const questions = questionsFor(sharedParentRubric(), sections);
    const state = buildEvidenceState({ artifactKind: "design", questions });
    const bytes = Buffer.byteLength(canonicalJson(state));

    // A budget that the deduplicated state meets and three copies of the parent body would not.
    const budget = Math.ceil(bytes * 1.2);
    expect(bytes).toBeLessThan(budget);

    const result = await evaluateSemantic({
      root: process.cwd(),
      artifactKind: "design",
      questions,
      rubric: sharedParentRubric(),
      model: "jev-1.13.0",
      policyVersion: 1,
      maxEvidenceBytes: budget,
      forbiddenLiterals: [],
      maxAgeSeconds: 3600,
      backend: createMockJevJudgeBackend({
        answers: questions.map((question) => ({
          id: question.id, kind: "choose", value: "supported", confidence: 1,
          distribution: [1, 0, 0], basis: "calibrated",
        })),
      }),
      useCache: false,
    });
    expect(result.calls).toBe(1);

    // The same questions with the parent body copied per question exceed the same budget.
    const duplicated = Buffer.byteLength(canonicalJson({
      schema_version: 1,
      artifact_kind: "design",
      evidence: questions.map((question) => ({
        question_id: question.id,
        sections: question.sectionIds,
        text: question.segments.map((segment) => segment.text).join("\n"),
      })),
    }));
    expect(duplicated).toBeGreaterThan(budget);
  });

  it("(c, negative) refuses a state that does exceed the budget", async () => {
    const { sections } = fixture();
    const questions = questionsFor(sharedParentRubric(), sections);
    const state = buildEvidenceState({ artifactKind: "design", questions });
    const bytes = Buffer.byteLength(canonicalJson(state));
    await expect(evaluateSemantic({
      root: process.cwd(),
      artifactKind: "design",
      questions,
      rubric: sharedParentRubric(),
      model: "jev-1.13.0",
      policyVersion: 1,
      maxEvidenceBytes: Math.max(1, bytes - 1),
      forbiddenLiterals: [],
      maxAgeSeconds: 3600,
      backend: createMockJevJudgeBackend({ answers: [] }),
      useCache: false,
    })).rejects.toThrow(BlockedError);
  });
});
