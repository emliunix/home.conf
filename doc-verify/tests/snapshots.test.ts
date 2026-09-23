import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { affectedClosure, captureSnapshots } from "../src/snapshot.js";
import { repoPath } from "../src/types.js";

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
    const pair = await captureSnapshots({ root, mode: { kind: "staged" }, documentPatterns: ["*.md"], invalidationPatterns: [] });
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
});

function git(root: string, args: string[]): void {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
}
