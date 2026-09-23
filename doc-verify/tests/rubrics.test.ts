import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { sha256 } from "../src/hash.js";
import { MissingCriticalSectionError, expandRubric, resolveRubric } from "../src/rubric.js";
import { repoPath } from "../src/types.js";
import { segmentMarkdown } from "../src/segments.js";

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-rubric-"));
  for (const [name, content] of Object.entries(files)) {
    const absolute = path.join(root, name);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }
  return {
    root,
    readBlob: async (name: ReturnType<typeof repoPath>) => {
      const content = await readFile(path.join(root, name), "utf8");
      return { path: name, content, hash: sha256(content) };
    },
  };
}

const item = `
    - id: design.problem
      artifact_kinds: [design]
      applies_to: {sections: [problem], scope: combined}
      evidence: {source: section_body, max_bytes: 1000}
      question:
        kind: choose
        instruction: Is it resolved?
        options: [supported, refuted, unknown]
      critical: true
      weight: 1
      scores: {supported: 1, refuted: 0, unknown: 0}
`;

describe("rubric resolution", () => {
  it("resolves parent first and raises but never lowers a threshold", async () => {
    const files = await fixture({
      "base.yaml": `schema_version: 1\nrubrics:\n  threshold: 0.7\n  items:${item}`,
      "nested/child.yaml": `schema_version: 1\nrubrics:\n  inherits: ../base.yaml#rubrics\n  threshold: 0.9\n  items: []\n`,
    });
    const rubric = await resolveRubric({ root: files.root, reference: "nested/child.yaml#/rubrics", readBlob: files.readBlob });
    expect(rubric.threshold).toBe(0.9);
    expect(rubric.items.map((entry) => entry.id)).toEqual(["design.problem"]);
    expect(rubric.chain.map((entry) => entry.path)).toEqual(["base.yaml", "nested/child.yaml"]);
  });

  it("rejects cycles, duplicate ids, escapes, and lower thresholds", async () => {
    const files = await fixture({
      "a.yaml": `schema_version: 1\nrubrics:\n  inherits: b.yaml#rubrics\n  threshold: 0.8\n  items:${item}`,
      "b.yaml": "schema_version: 1\nrubrics:\n  inherits: a.yaml#rubrics\n  items: []\n",
      "low.yaml": "schema_version: 1\nrubrics:\n  inherits: a.yaml#rubrics\n  threshold: 0.1\n  items: []\n",
    });
    await expect(resolveRubric({ root: files.root, reference: "a.yaml#rubrics", readBlob: files.readBlob })).rejects.toThrow("cycle");
    await expect(resolveRubric({ root: files.root, reference: "../a.yaml#rubrics", readBlob: files.readBlob })).rejects.toThrow("escapes");
    await expect(resolveRubric({ root: files.root, reference: "low.yaml#rubrics", readBlob: files.readBlob })).rejects.toThrow();
  });

  it("intersects explicit sections and refuses an empty evaluation", async () => {
    const files = await fixture({ "base.yaml": `schema_version: 1\nrubrics:\n  threshold: 0.8\n  items:${item}` });
    const rubric = await resolveRubric({ root: files.root, reference: "base.yaml#rubrics", readBlob: files.readBlob });
    const sections = segmentMarkdown("# T\n## Problem\ntext\n## Other\nother\n");
    const problem = sections[1];
    const other = sections[2];
    expect(problem).toBeDefined();
    expect(other).toBeDefined();
    if (problem === undefined || other === undefined) {
      throw new Error("fixture sections are missing");
    }
    expect(expandRubric({ rubric, artifactKind: "design", sections, selectedIds: [problem.id] })).toHaveLength(1);
    expect(() => expandRubric({ rubric, artifactKind: "design", sections, selectedIds: [other.id] })).toThrow("no applicable");
    expect(() => expandRubric({ rubric, artifactKind: "design", sections: segmentMarkdown("# T\n## Other\nx\n") })).toThrow(MissingCriticalSectionError);
  });
});
