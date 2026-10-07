import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { affectedClosure, captureSnapshots } from "../../src/snapshot.js";
import { repoPath } from "../../src/types.js";

describe("snapshot and graph behavior", () => {
  it("reads staged bytes and ignores later unstaged edits", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "doc-verify-git-"));
    git(root, ["init"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "user.name", "Test"]);
    await writeFile(path.join(root, "a.md"), "# A\nbase\n");
    git(root, ["add", "a.md"]);
    git(root, ["commit", "-m", "base"]);
    await writeFile(path.join(root, "a.md"), "# A\nstaged\n");
    git(root, ["add", "a.md"]);
    await writeFile(path.join(root, "a.md"), "# A\nunstaged\n");
    const pair = await captureSnapshots({ root, mode: { kind: "staged" }, documentRules: [{ pattern: "*.md" }], invalidationPatterns: [] });
    const entry = pair.candidate.entries.get(repoPath("a.md"));
    expect(entry !== undefined && !("deleted" in entry) ? entry.content : "").toContain("staged");
    expect(entry !== undefined && !("deleted" in entry) ? entry.content : "").not.toContain("unstaged");
  });

  it("uses baseline and candidate reverse edges for deletion and retargeting", () => {
    const a = repoPath("a.md");
    const b = repoPath("b.md");
    const c = repoPath("c.md");
    expect(affectedClosure({
      changed: [b],
      baselineLinks: new Map([[a, [b]]]),
      candidateLinks: new Map([[a, [c]]]),
      allDocuments: [a, b, c],
      invalidatesAll: false,
    })).toEqual([a, b]);
  });

  it("follows module references (rule modules and extends) to only their document consumers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "doc-verify-module-graph-"));
    await mkdir(path.join(root, "docs"), { recursive: true });
    await mkdir(path.join(root, "modules"), { recursive: true });
    const module = (extra = ""): string => `schema_version: 2\nkind: verification-module\nmodule: m\n${extra}`;
    await writeFile(path.join(root, "docs/a.md"), "# A\n");
    await writeFile(path.join(root, "docs/b.md"), "# B\n");
    await writeFile(path.join(root, "modules/base.yaml"), module());
    await writeFile(path.join(root, "modules/a.yaml"), module("extends: [base.yaml]\n"));
    await writeFile(path.join(root, "modules/b.yaml"), module());
    git(root, ["init"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "base"]);
    await writeFile(path.join(root, "modules/base.yaml"), module("rounds: 1\n"));
    git(root, ["add", "modules/base.yaml"]);

    const pair = await captureSnapshots({
      root,
      mode: { kind: "staged" },
      documentRules: [
        { pattern: "docs/a.md", modules: ["modules/a.yaml", "doc-verify:artifact"] },
        { pattern: "docs/b.md", modules: ["modules/b.yaml"] },
      ],
      invalidationPatterns: [],
    });
    expect(pair.candidatePaths).toEqual([repoPath("docs/a.md")]);
    expect(pair.impactPaths.get(repoPath("docs/a.md"))).toEqual([
      repoPath("modules/base.yaml"),
      repoPath("modules/a.yaml"),
      repoPath("docs/a.md"),
    ]);
  });
});

function git(root: string, args: string[]): void {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
}
