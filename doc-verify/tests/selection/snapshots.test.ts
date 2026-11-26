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

  it("follows prose citations and code-span paths, not only Markdown links, to the citing documents", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "doc-verify-prose-graph-"));
    await mkdir(path.join(root, "docs"), { recursive: true });
    await writeFile(path.join(root, "docs/a.md"), "# A\n\n## Intro\n\nText.\n");
    await writeFile(path.join(root, "docs/cites.md"), "# Cites\n\nSee docs/a.md §Intro for the setup.\n");
    await writeFile(path.join(root, "docs/names.md"), "# Names\n\nThe file `docs/a.md` holds it.\n");
    await writeFile(path.join(root, "docs/other.md"), "# Other\n\nNothing here.\n");
    git(root, ["init"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "base"]);
    await writeFile(path.join(root, "docs/a.md"), "# A\n\n## Introduction\n\nText.\n");
    git(root, ["add", "docs/a.md"]);

    const pair = await captureSnapshots({
      root,
      mode: { kind: "staged" },
      documentRules: [{ pattern: "docs/*.md", modules: [] }],
      invalidationPatterns: [],
    });
    expect(pair.candidatePaths).toEqual([repoPath("docs/a.md"), repoPath("docs/cites.md"), repoPath("docs/names.md")]);
    expect(pair.impactPaths.get(repoPath("docs/cites.md"))).toEqual([repoPath("docs/a.md"), repoPath("docs/cites.md")]);
  });

  it("splits a rename into its deleted and added paths, so a document linking the old name is re-checked", async () => {
    const root = await repository({
      "docs/a.md": "# A\n\nSee [b](b.md).\n",
      "docs/b.md": "# B\n\nBody.\n",
      "docs/other.md": "# Other\n\nNothing here.\n",
    });
    git(root, ["mv", "docs/b.md", "docs/c.md"]);
    const pair = await stagedPair(root);
    expect(pair.changedRoots).toEqual([repoPath("docs/b.md"), repoPath("docs/c.md")]);
    expect(pair.candidatePaths).toEqual([repoPath("docs/a.md"), repoPath("docs/c.md")]);
    expect(pair.impactPaths.get(repoPath("docs/a.md"))).toEqual([repoPath("docs/b.md"), repoPath("docs/a.md")]);
  });

  it("re-checks a document whose bare file name gains a second owner, not one whose file only changed bytes", async () => {
    const root = await repository({
      "docs/names.md": "# Names\n\nThe IR lives in `ir.py`.\n",
      "docs/other.md": "# Other\n\nNothing here.\n",
      "pkg/ir.py": "x = 1\n",
    });
    await writeFile(path.join(root, "pkg/ir.py"), "x = 2\n");
    git(root, ["add", "pkg/ir.py"]);
    expect((await stagedPair(root)).candidatePaths).toEqual([]);

    await mkdir(path.join(root, "lib"), { recursive: true });
    await writeFile(path.join(root, "lib/ir.py"), "y = 1\n");
    git(root, ["add", "lib/ir.py"]);
    const pair = await stagedPair(root);
    expect(pair.candidatePaths).toEqual([repoPath("docs/names.md")]);
    expect(pair.impactPaths.get(repoPath("docs/names.md"))).toEqual([repoPath("lib/ir.py"), repoPath("docs/names.md")]);
  });

  it("re-checks a `design/NN §` citation when a second design/NN file makes its binding ambiguous", async () => {
    const root = await repository({
      "design/04-rules.md": "# Rules\n\n## Rule\n\nText.\n",
      "docs/cites.md": "# Cites\n\nAs design/04 §Rule says.\n",
      "docs/other.md": "# Other\n\nNothing here.\n",
    });
    await writeFile(path.join(root, "design/04-rules-followup.md"), "# Followup\n");
    git(root, ["add", "design/04-rules-followup.md"]);
    const pair = await stagedPair(root, "{docs,design}/*.md");
    expect(pair.candidatePaths).toEqual([repoPath("design/04-rules-followup.md"), repoPath("docs/cites.md")]);
  });
});

async function repository(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-closure-"));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.join(root, path.dirname(file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  git(root, ["init"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "base"]);
  return root;
}

function stagedPair(root: string, pattern = "docs/*.md"): ReturnType<typeof captureSnapshots> {
  return captureSnapshots({ root, mode: { kind: "staged" }, documentRules: [{ pattern, modules: [] }], invalidationPatterns: [] });
}

function git(root: string, args: string[]): void {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
}
