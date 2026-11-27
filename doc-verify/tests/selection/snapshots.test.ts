import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkDocuments } from "../../src/checker.js";
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
    // The old path is a configured document deleted from the candidate: selected (and reported
    // deleted), as a range over the same rename selects it.
    expect(pair.candidatePaths).toEqual([repoPath("docs/a.md"), repoPath("docs/b.md"), repoPath("docs/c.md")]);
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

  // Design 02: hook, agent and CI agree. The baseline of `--staged` and `--paths` is HEAD's tree,
  // not the index, or a document deleted in the index is on neither side and is never reported.
  it("selects a document deleted in the index as deleted, as a range over the same commit does", async () => {
    const root = await repository({
      "docs/a.md": "# A\n\nBody.\n",
      "docs/b.md": "# B\n\nBody.\n",
    });
    git(root, ["rm", "-q", "docs/b.md"]);
    const staged = await stagedPair(root);
    expect(staged.candidatePaths).toEqual([repoPath("docs/b.md")]);
    expect(staged.baseline.entries.has(repoPath("docs/b.md"))).toBe(true);
    expect(staged.candidate.entries.get(repoPath("docs/b.md"))).toBeUndefined();

    git(root, ["commit", "-q", "-m", "delete b"]);
    const range = await captureSnapshots({ root, mode: { kind: "range", range: "HEAD~1...HEAD" }, documentRules: [{ pattern: "docs/*.md", modules: [] }], invalidationPatterns: [] });
    expect(range.candidatePaths).toEqual(staged.candidatePaths);
  });

  it("selects a named file deleted in the index under --paths, from HEAD's tree", async () => {
    const root = await repository({
      "docs/a.md": "# A\n\nBody.\n",
      "docs/b.md": "# B\n\nBody.\n",
    });
    git(root, ["rm", "-q", "docs/b.md"]);
    const pair = await captureSnapshots({ root, mode: { kind: "paths", paths: ["docs/b.md"] }, documentRules: [{ pattern: "docs/*.md", modules: [] }], invalidationPatterns: [] });
    expect(pair.candidatePaths).toEqual([repoPath("docs/b.md")]);
  });

  it("warns structure.deleted and passes for a staged deletion, as a range over the commit does", async () => {
    const root = await repository({
      ".doc-verify.yaml": CONFIG,
      "docs/a.md": "# A\n\nBody.\n",
      "docs/b.md": "# B\n\nBody.\n",
    });
    git(root, ["rm", "-q", "docs/b.md"]);
    const deleted = (report: Awaited<ReturnType<typeof checkDocuments>>): unknown[] => report.artifacts.map((artifact) => [
      artifact.path,
      artifact.verdict,
      artifact.findings.map((finding) => finding.ruleId),
      artifact.warnings.map((warning) => warning.ruleId),
    ]);
    const staged = await checkDocuments({ root, mode: { kind: "staged" }, profile: "draft", cache: "off" });
    expect(deleted(staged)).toEqual([["docs/b.md", "PASS", [], ["structure.deleted"]]]);
    expect(staged.verdict).toBe("PASS");

    git(root, ["commit", "-q", "-m", "delete b"]);
    const range = await checkDocuments({ root, mode: { kind: "range", range: "HEAD~1...HEAD" }, profile: "draft", cache: "off" });
    expect(deleted(range)).toEqual(deleted(staged));
  });
});

const CONFIG = `schema_version: 1
kind: document-verification
documents:
  - pattern: docs/*.md
    artifact_kind: design
    modules: [doc-verify:references]
invalidation_patterns: [.doc-verify.yaml]
judge:
  kind: jev
  model: jev-1.13.0
  client_sha256: ce983f8de97d5b30d527a7116f0c49ad3d17e098d2c3f17c9600041260c65dcb
  attestation_max_age_seconds: 3600
policy:
  kind: semantic-boundary
  version: 1
  max_evidence_bytes: 12000
  forbidden_literals: []
`;

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
