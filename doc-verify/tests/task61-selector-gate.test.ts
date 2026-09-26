// #61 — INDEPENDENT gate for #60 (doc-verify ordered document selectors).
//
// AUTHORSHIP (AGENTS.md:92): authored by the independent gate seat from the owner
// requirement and the TRACKED setup guidance
// (`skills/verification/references/doc-verify-setup.md`), NOT from the change's
// own tests. The promise under test, verbatim from that guidance:
//
//   "`documents` is ordered and uses last-match-wins selection. ... Include then
//    exclude removes matching paths; exclude then include re-adds them and supplies
//    the selected rule metadata. Verbose output prints the matching `selector trace`,
//    and JSON exposes it as `selectorTrace`, so a test can assert the decision rather
//    than infer it from the final file list."
//
// plus the card's clause 2: "the same decision drives inventory, --paths refusal,
// affected closure, and artifact reporting, so a working-tree glob cannot bypass an
// exclusion."
//
// Every arm spawns the REAL built CLI (`doc-verify/dist/cli.js`) in its own git
// repository, so the subject is the served command path, not an internal function.
//
// Exact command:
//   npm run build && npx vitest run doc-verify/tests/task61-selector-gate.test.ts

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CLI = path.resolve("doc-verify/dist/cli.js");

/** The judge block + policy: required by the config schema, unused for the
 *  structural checks these arms drive. Values are the tool's own pinned defaults. */
const JUDGE = `judge:
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

/** A minimal contract world built independently of the shipped test fixture. */
function writeWorld(root: string): void {
  mkdirSync(path.join(root, "design"), { recursive: true });
  mkdirSync(path.join(root, "rubrics"), { recursive: true });
  mkdirSync(path.join(root, "strategies"), { recursive: true });
  writeFileSync(path.join(root, "rubrics", "default.yaml"), `schema_version: 1
rubrics:
  kind: jev
  threshold: 1
  items:
    - id: design.problem
      artifact_kinds: [design]
      applies_to: {sections: [problem], scope: combined}
      evidence: {source: section_body, max_bytes: 1000}
      question:
        kind: choose
        instruction: Is the problem explicit?
        options: [supported, refuted, unknown]
      critical: true
      weight: 1
      scores: {supported: 1, refuted: 0, unknown: 0}
`);
  writeFileSync(path.join(root, "strategies", "design.yaml"), `schema_version: 1
kind: verification-strategy
verification:
  kind: jev-prolog
  rubrics:
    kind: jev
    inherits: ../rubrics/default.yaml#rubrics
  default_profile: draft
  profiles:
    draft:
      sections: [problem]
      cache: reuse
    promotion:
      cache: refresh
`);
}

/** One design document plus its companion contract. `body` may carry a markdown
 *  link, so a dependency edge can be shaped on purpose. */
function writeDoc(root: string, name: string, body?: string): void {
  writeFileSync(
    path.join(root, "design", `${name}.md`),
    `# ${name.toUpperCase()}\n\n## Problem\n${body ?? `${name} has a problem.`}\n`,
  );
  writeFileSync(path.join(root, "design", `${name}.yaml`), `schema_version: 1
kind: document-contract
document:
  path: design/${name}.md
  kind: design
verification:
  kind: jev-prolog
  inherits: ../strategies/design.yaml#verification
`);
}

function writeConfig(root: string, documents: string): void {
  writeFileSync(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
${documents}invalidation_patterns: []
${JUDGE}`);
}

/** A fresh git repo with the world committed, so `git ls-files` has content. */
function repo(documents: string, opts: { commit?: string[]; untracked?: string[] } = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "task61-"));
  writeWorld(root);
  writeConfig(root, documents);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  for (const name of opts.commit ?? []) writeDoc(root, name);
  if ((opts.commit ?? []).length > 0) {
    execFileSync("git", ["add", "-A"], { cwd: root });
    execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=Task61",
      "commit", "-qm", "fixture"], { cwd: root });
  }
  for (const name of opts.untracked ?? []) writeDoc(root, name);
  return root;
}

function run(root: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  return spawnSync("node", [CLI, "check", ...args], { cwd: root, encoding: "utf8" });
}

interface Report {
  affectedArtifacts: string[];
  artifacts: Array<{
    path: string;
    selectorTrace: Array<{ pattern: string; action: string }>;
    requiredSections: string[];
  }>;
}

function artifactPaths(root: string): string[] {
  const result = run(root, ["--all", "--profile", "draft", "--format", "json"]);
  expect(result.status, result.stderr).toBe(0);
  return (JSON.parse(result.stdout) as Report).artifacts.map((artifact) => artifact.path);
}

const INCLUDE_ALL = `  - pattern: design/*.md
    artifact_kind: design
    verification: strategies/design.yaml#verification
    required_sections: [problem]
`;

const INCLUDE_B = `  - pattern: design/b.md
    artifact_kind: design
    verification: strategies/design.yaml#verification
    required_sections: [problem]
`;

// ── arm 1: exclude AFTER include removes the document ────────────────────────

describe("#61 arm 1 — ordered last-match-wins: a later exclude removes", () => {
  it("removes the matching document from the inventory and the affected set", () => {
    const root = repo(`${INCLUDE_ALL}  - pattern: design/b.md
    exclude: true
`, { commit: ["a", "b"] });
    const result = run(root, ["--all", "--profile", "draft", "--format", "json"]);
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as Report;
    expect(report.artifacts.map((artifact) => artifact.path)).toEqual(["design/a.md"]);
    expect(report.affectedArtifacts).toEqual(["design/a.md"]);
  });
});

// ── arm 2: include AFTER exclude re-adds the document, with the include's rule ─

describe("#61 arm 2 — ordered last-match-wins: a later include re-adds", () => {
  it("re-adds a path the leading exclude removed, and supplies the include's required sections", () => {
    // The leading selector excludes EVERYTHING, then a later include re-adds a.md,
    // plus c.md via its own include. Only last-match-wins yields {a, c}.
    const root = repo(`  - pattern: design/*.md
    exclude: true
${INCLUDE_B.replace("design/b.md", "design/a.md")}  - pattern: design/c.md
    artifact_kind: design
    verification: strategies/design.yaml#verification
    required_sections: [problem]
`, { commit: ["a", "b", "c"] });
    const result = run(root, ["--all", "--profile", "draft", "--format", "json"]);
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as Report;
    expect(report.artifacts.map((artifact) => artifact.path)).toEqual(["design/a.md", "design/c.md"]);
    // "supplies the selected rule metadata": the include arm's required_sections apply.
    expect(report.artifacts[0]?.requiredSections).toEqual(["problem"]);
  });
});

// ── arm 3: a working-tree glob cannot bypass an exclusion ────────────────────

describe("#61 arm 3 — the same decision governs the working tree", () => {
  it("an UNTRACKED file matching an include but excluded later is not selected in --all", () => {
    // `c` exists only in the working tree. In --all the tool unions working-tree
    // globs with the tracked inventory; if that union skips the selector decision,
    // the exclusion is bypassed by a file that was never committed.
    const root = repo(`${INCLUDE_ALL}  - pattern: design/c.md
    exclude: true
`, { commit: ["a", "b"], untracked: ["c"] });
    const paths = artifactPaths(root);
    expect(paths).toEqual(["design/a.md", "design/b.md"]);
    // The untracked, later-excluded file is absent — it cannot bypass the exclusion.
    expect(paths).not.toContain("design/c.md");
    const report = run(root, ["--all", "--profile", "draft", "--format", "json"]);
    expect((JSON.parse(report.stdout) as Report).affectedArtifacts).not.toContain("design/c.md");
  });
});

// ── arm 4: the --paths refusal is a separate consumer of the same decision ───

describe("#61 arm 4 — the --paths refusal consumer", () => {
  it("refuses a path the selectors excluded, naming it, and accepts a selected one", () => {
    const root = repo(`${INCLUDE_ALL}  - pattern: design/b.md
    exclude: true
`, { commit: ["a", "b"] });
    const refused = run(root, ["--paths", "design/b.md", "--profile", "draft", "--format", "json"]);
    expect(refused.status).toBe(64);
    expect(refused.stderr).toContain("design/b.md");
    // The positive control: a SELECTED path is accepted on the same repo+config.
    const accepted = run(root, ["--paths", "design/a.md", "--profile", "draft", "--format", "json"]);
    expect(accepted.status, accepted.stderr).toBe(0);
    expect((JSON.parse(accepted.stdout) as Report).artifacts.map((artifact) => artifact.path)).toEqual(["design/a.md"]);
  });

  it("refuses a path matched by NO selector (a third input to the same refusal)", () => {
    const root = repo(`  - pattern: design/only-*.md
    artifact_kind: design
    verification: strategies/design.yaml#verification
    required_sections: [problem]
`, { commit: ["a"] });
    const result = run(root, ["--paths", "design/a.md", "--profile", "draft", "--format", "json"]);
    expect(result.status).toBe(64);
    expect(result.stderr).toContain("design/a.md");
  });
});

// ── arm 5: the emitted selectorTrace is the decision, in order, with actions ──

describe("#61 arm 5 — the emitted selectorTrace is observable, not inferred", () => {
  it("names every matching selector in authored order with its action", () => {
    const root = repo(`  - pattern: design/*.md
    exclude: true
${INCLUDE_B}  - pattern: design/b*.md
    exclude: true
${INCLUDE_B}`, { commit: ["a", "b"] });
    const result = run(root, ["--paths", "design/b.md", "--profile", "draft", "--format", "json"]);
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as Report;
    // Four selectors match; the trace records all of them in authored order, and
    // the LAST match (an include) decides.
    expect(report.artifacts[0]?.selectorTrace).toEqual([
      { pattern: "design/*.md", action: "exclude" },
      { pattern: "design/b.md", action: "include" },
      { pattern: "design/b*.md", action: "exclude" },
      { pattern: "design/b.md", action: "include" },
    ]);
  });

  it("prints the same trace in verbose text output", () => {
    const root = repo(`  - pattern: design/*.md
    exclude: true
${INCLUDE_B}`, { commit: ["a", "b"] });
    const result = run(root, ["--paths", "design/b.md", "--profile", "draft", "--format", "text", "--verbose"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("selector trace: exclude:design/*.md -> include:design/b.md");
  });

});
