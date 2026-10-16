import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { decisionCases } from "../src/eval/cases.ts";

const SKILLS_ROOT = resolve(import.meta.dirname, "../../skills");
const CASES_SOURCE = readFileSync(resolve(import.meta.dirname, "../src/eval/cases.ts"), "utf8");

interface Citation {
  readonly files: readonly string[];
  readonly fragments: readonly string[];
}

/** Whitespace collapsed, Markdown emphasis and backticks stripped. */
export function normalizeText(text: string): string {
  return text
    .replace(/\*\*|\*|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse one `// Cite:` comment: skill files named, and quoted fragments split on `…`. */
export function parseCitation(comment: string): Citation {
  const files = [...comment.matchAll(/([a-z0-9-]+\/SKILL\.md)/g)].map((m) => m[1]);
  const fragments = [...comment.matchAll(/"([^"]+)"/g)]
    .flatMap((m) => m[1].split("…"))
    .map((f) => normalizeText(f).replace(/^[.;,:]+|[.;,:]+$/g, "").trim())
    .filter((f) => f.length > 0);
  return { files: [...new Set(files)], fragments };
}

/** Problems with one citation, checked against the skills as merged. */
export function citationProblems(citation: Citation, root = SKILLS_ROOT): string[] {
  const problems: string[] = [];
  if (citation.files.length === 0) problems.push("names no skill file");
  if (citation.fragments.length === 0) problems.push("quotes no fragment");
  const texts: string[] = [];
  for (const file of citation.files) {
    const path = resolve(root, file);
    if (!existsSync(path)) problems.push(`missing file ${file}`);
    else texts.push(normalizeText(readFileSync(path, "utf8")));
  }
  for (const fragment of citation.fragments) {
    if (!texts.some((text) => text.includes(fragment))) problems.push(`fragment not found: "${fragment}"`);
  }
  return problems;
}

/** The `// Cite:` comment written directly above each case's `id:` line. */
function citationsById(): Map<string, string> {
  const byId = new Map<string, string>();
  let pending: string | undefined;
  for (const line of CASES_SOURCE.split("\n")) {
    const cite = /^\s*\/\/ Cite: (.*)$/.exec(line);
    if (cite) pending = cite[1];
    const id = /^\s*id: "([^"]+)",$/.exec(line);
    if (id) {
      if (pending !== undefined) byId.set(id[1], pending);
      pending = undefined;
    }
  }
  return byId;
}

describe("case citations", () => {
  const byId = citationsById();

  it("every case carries a citation that resolves in the merged skills", () => {
    const problems = decisionCases.flatMap((c) => {
      const comment = byId.get(c.id);
      if (comment === undefined) return [`${c.id}: no // Cite: comment`];
      return citationProblems(parseCitation(comment)).map((p) => `${c.id}: ${p}`);
    });
    expect(problems).toEqual([]);
  });

  it("flags a stale or vacuous citation", () => {
    expect(citationProblems(parseCitation("flow-retro/SKILL.md:1 — same route, no flow vocabulary."))).toContain(
      "quotes no fragment",
    );
    expect(
      citationProblems(parseCitation('flow-retro/SKILL.md:1 — "this sentence was never in the skill"')),
    ).toContain('fragment not found: "this sentence was never in the skill"');
    expect(citationProblems(parseCitation('no-such-skill/SKILL.md:1 — "x"'))).toContain(
      "missing file no-such-skill/SKILL.md",
    );
  });

  it("normalizes emphasis and whitespace", () => {
    expect(normalizeText("a **wrong machine**,\n  `flow-common`")).toBe("a wrong machine, flow-common");
  });
});
