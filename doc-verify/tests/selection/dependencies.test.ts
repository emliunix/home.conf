import { describe, expect, it } from "vitest";

import { inventoryExists, observeDocument, type Dependency } from "../../src/dependencies.js";
import { documentFacts } from "../../src/engine/facts.js";

const files = [
  "docs/a.md",
  "docs/b.md",
  "design/04-rules.md",
  "pkg/ir.py",
  "Makefile",
];

const texts: Record<string, string> = {
  "docs/b.md": "# B\n\n## Intro\n\nText.\n",
  "design/04-rules.md": "# Rules\n\n## Rule\n\nText.\n",
};

// Every reference kind the check resolves against the repository: a link with a fragment, a
// `§` citation on a path and on `design/NN`, a code-span path, a bare file name, a line locator on
// a bare stem and on a shorthand, a revision-qualified path, and a name that resolves nowhere.
const markdown = [
  "# A",
  "",
  "## Refs",
  "",
  "See [b](b.md#intro) and docs/b.md §Intro, as design/04 §Rule says.",
  "The IR is `pkg/ir.py`, also `ir.py`, at `ir.py:3`, `Makefile:12` and `design/04:7`.",
  "At `HEAD:docs/b.md`; `missing.txt` is nowhere.",
  "",
].join("\n");

function key(dependency: Dependency): string {
  return JSON.stringify(dependency);
}

describe("closure observation", () => {
  it("records every repository question the check asks of a document", () => {
    const exists = inventoryExists("/nonexistent", files, false);
    const asked = new Set<string>();
    const recordingExists = (repoPath: string): boolean => {
      asked.add(key({ kind: "path", path: repoPath }));
      return exists(repoPath);
    };
    // The check's own wiring (`checker.ts`): `readTarget` reads only what `exists` admits.
    documentFacts({
      path: "docs/a.md",
      markdown,
      exists: recordingExists,
      files,
      gitRefs: [],
      resolveSpec: () => "ok",
      readTarget: (repoPath) => recordingExists(repoPath) ? texts[repoPath] : undefined,
      onInventoryQuery: (query) => asked.add(key(query)),
    });
    expect(asked.size).toBeGreaterThan(0);
    expect([...asked].some((entry) => entry.includes("basename"))).toBe(true);
    expect([...asked].some((entry) => entry.includes("prefix"))).toBe(true);

    const observed = new Set(observeDocument({ path: "docs/a.md", markdown, exists, files, gitRefs: [] }).map(key));
    expect([...asked].filter((entry) => !observed.has(entry))).toEqual([]);
  });
});
