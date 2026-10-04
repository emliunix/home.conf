// Structural checks decide without a judge (owner priority 1, 2026-10-05): with no key, every
// constraint whose goal reads no oracle gets a definite verdict; only oracle-dependent
// constraints are BLOCKED, and a structural NO-GO stands (exit 1, not 3).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const MODULE = `schema_version: 2
kind: verification-module
module: keyless
oracles:
  falsifies(D, S):
    ask: The verification names a check that would fail if its claim were false.
    evidence: core.body(D, S)
    threshold: 0.5
rules:
  top(D, S): core.section(D, S, _), core.depth(D, S, 2)
  verification_section(D, S): top(D, S), core.heading(D, S, 'Verification')
constraints:
  has-goal:
    forall: core.meta(D, kind, design)
    require: top(D, S), core.heading(D, S, 'Goal')
    severity: error
    message: "{D} has no '## Goal' section"
    repair: "Add '## Goal'."
  verification-falsifies:
    forall: verification_section(D, S)
    require: falsifies(D, S)
    severity: error
    message: "{S} names no failing check"
`;

const GOOD = "# D\n\n## Goal\n\nShip it.\n\n## Verification\n\n`pytest -q` fails when the parser drops a field.\n";

function fixture(markdown: string, module = MODULE): string {
  const root = mkdtempSync(path.join(tmpdir(), "doc-verify-keyless-"));
  mkdirSync(path.join(root, "design"), { recursive: true });
  mkdirSync(path.join(root, "modules"), { recursive: true });
  writeFileSync(path.join(root, "modules/design.yaml"), module);
  writeFileSync(path.join(root, "design/a.md"), markdown);
  writeFileSync(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    artifact_kind: design
    modules: [modules/design.yaml]
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
`);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}

function keyless(root: string, ...args: string[]) {
  const env = { ...process.env };
  delete env.TYPESAFE_API_KEY;
  delete env.API_KEY;
  return spawnSync("node", [path.resolve("doc-verify/dist/cli.js"), "check", "--paths", "design/a.md", "--profile", "promotion", ...args],
    { cwd: root, encoding: "utf8", env });
}

describe("keyless structural checks", () => {
  it("refuses a seeded missing heading with no key: NO-GO, exit 1", () => {
    const root = fixture(GOOD.replace("## Goal\n\nShip it.\n\n", ""));
    const result = keyless(root);
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toMatch(/module\.has-goal NO-GO .*design\/a\.md has no '## Goal' section/);
    expect(result.stdout).toMatch(/^NO-GO: 1 artifact\(s\)/m);
  });

  it("decides the structural constraint and blocks only the oracle-dependent one", () => {
    const root = fixture(GOOD);
    const result = keyless(root, "--verbose");
    expect(result.status, result.stderr).toBe(3);
    expect(result.stdout).toMatch(/constraint has-goal \[error, require\][^]*?status satisfied/);
    expect(result.stdout).toMatch(/constraint verification-falsifies \[error, require\][^]*?status undetermined/);
    const text = keyless(root);
    expect(text.stdout).toContain("semantic.prerequisite BLOCKED TYPESAFE_API_KEY is unavailable");
  });

  it("passes a document whose module asks no oracle, with no key", () => {
    const structural = MODULE.slice(0, MODULE.indexOf("  verification-falsifies:"));
    const root = fixture(GOOD, structural);
    const result = keyless(root);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toMatch(/^PASS: 1 artifact\(s\)/m);
  });
});
