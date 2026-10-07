import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("CLI", () => {
  it("prints stable section diagnostics", () => {
    const output = execFileSync("node", [
      "doc-verify/dist/cli.js", "segments",
      "design/02-programmatic-document-contract-verification.md", "--format", "text",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(output).toContain("problem-statement\t");
    expect(output).toContain("verification-design\t");
  });

  it("checks a configured document in concise draft mode", () => {
    const root = cliFixture();
    const cli = path.resolve("doc-verify/dist/cli.js");
    const result = spawnSync("node", [
      cli, "check", "--paths", "design/a.md",
      "--profile", "draft", "--format", "text",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^PASS: 1 artifact\(s\)/);
  });

  it("prints project impact, modules, and section scope in verbose mode", () => {
    const root = cliFixture();
    const cli = path.resolve("doc-verify/dist/cli.js");
    const result = spawnSync("node", [
      cli, "check", "--paths", "design/a.md",
      "--profile", "draft", "--format", "text", "--verbose",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("verification invocation=paths:design/a.md requested-profile=draft");
    expect(result.stdout).toContain("artifact design/a.md [design] PASS profile=draft");
    expect(result.stdout).toContain("impact: design/a.md");
    expect(result.stdout).toContain("required sections (1): problem");
    expect(result.stdout).toContain("modules: modules/design.yaml");
    expect(result.stdout).toContain("semantic: calls=0 cache-hits=0");
  });

  it("applies ordered include and exclude selectors in the served CLI", () => {
    const root = cliFixture();
    const cli = path.resolve("doc-verify/dist/cli.js");
    writeFileSync(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    artifact_kind: design
    modules: [modules/design.yaml]
    required_sections: [problem]
  - pattern: design/b.md
    exclude: true
invalidation_patterns: []
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
    writeFileSync(path.join(root, "design/b.md"), "# B\n## Problem\nB.\n");
    writeFileSync(path.join(root, "design/b.yaml"), `schema_version: 1
kind: document-contract
document:
  path: design/b.md
  kind: design
`);
    const excluded = spawnSync("node", [
      cli, "check", "--paths", "design/b.md",
      "--profile", "draft", "--format", "text",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(excluded.status).toBe(64);
    expect(excluded.stderr).toContain("selected no configured document or dependency");

    writeFileSync(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    exclude: true
  - pattern: design/a.md
    artifact_kind: design
    modules: [modules/design.yaml]
    required_sections: [problem]
invalidation_patterns: []
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
    const reIncluded = spawnSync("node", [
      cli, "check", "--paths", "design/a.md",
      "--profile", "draft", "--format", "text", "--verbose",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(reIncluded.status).toBe(0);
    expect(reIncluded.stdout).toContain("selector trace: exclude:design/*.md -> include:design/a.md");
    expect(reIncluded.stdout).toContain("artifact design/a.md [design] PASS");
  });

  it("keeps an exclusion out of the affected closure", () => {
    const root = cliFixture();
    const cli = path.resolve("doc-verify/dist/cli.js");
    writeFileSync(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    artifact_kind: design
    modules: [modules/design.yaml]
    required_sections: [problem]
  - pattern: design/b.md
    exclude: true
invalidation_patterns: []
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
    writeFileSync(path.join(root, "design/b.md"), "# B\n## Problem\nB.\n");
    writeFileSync(path.join(root, "design/b.yaml"), `schema_version: 1
kind: document-contract
document:
  path: design/b.md
  kind: design
`);
    const result = spawnSync("node", [
      cli, "check", "--paths", "design/a.md",
      "--profile", "draft", "--format", "json",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      affectedArtifacts: string[];
      artifacts: Array<{ path: string; selectorTrace: Array<{ pattern: string; action: string }> }>;
    };
    expect(report.affectedArtifacts).toEqual(["design/a.md"]);
    expect(report.artifacts.map((artifact) => artifact.path)).toEqual(["design/a.md"]);
    expect(report.artifacts[0]?.selectorTrace).toEqual([{ pattern: "design/*.md", action: "include" }]);
  });

  it("passes --section into the selected(D, S) fact", () => {
    const root = cliFixture();
    const cli = path.resolve("doc-verify/dist/cli.js");
    writeFileSync(path.join(root, "modules/design.yaml"), `${DESIGN_MODULE}  selected-is-problem:
    forall: core.selected(D, S)
    require: core.heading(D, S, 'Problem')
    severity: error
    message: "{S} is selected but is not the Problem section"
`);
    const narrowed = spawnSync("node", [
      cli, "check", "--paths", "design/a.md", "--profile", "draft", "--section", "problem", "--format", "text",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(narrowed.status, narrowed.stdout + narrowed.stderr).toBe(0);
    const whole = spawnSync("node", [
      cli, "check", "--paths", "design/a.md", "--profile", "draft", "--format", "text",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(whole.status).toBe(1);
    expect(whole.stdout).toContain("rationale is selected but is not the Problem section");
  });

  it("accepts --no-cache and writes no cache entry", () => {
    const root = cliFixture();
    const result = spawnSync("node", [
      path.resolve("doc-verify/dist/cli.js"), "check", "--paths", "design/a.md", "--profile", "draft", "--no-cache",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(path.join(root, ".doc-verify-cache"))).toBe(false);
  });

  it("refuses the removed --rubric option with the migration hint", () => {
    const root = cliFixture();
    const result = spawnSync("node", [
      path.resolve("doc-verify/dist/cli.js"), "check", "--paths", "design/a.md",
      "--rubric", "rubrics/default.yaml#rubrics",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(result.status).toBe(64);
    expect(result.stderr).toContain("--rubric was removed with the v1 rubric reader");
    expect(result.stderr).toContain("Migrating from v1 rubrics");
  });

  it("reports a missing config with its expected path and a distinct exit", () => {
    const root = mkdtempSync(path.join(tmpdir(), "doc-verify-cli-no-config-"));
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    const result = spawnSync("node", [
      path.resolve("doc-verify/dist/cli.js"), "check", "--all", "--profile", "draft",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(result.status).toBe(66);
    expect(result.stderr).toContain("config .doc-verify.yaml not found");
    expect(result.stderr).toContain(path.join(root, ".doc-verify.yaml"));
  });

  it("reports a config that is absent from the Git index with a distinct exit", () => {
    const root = cliFixture();
    execFileSync("git", ["add", "design/a.md", "design/a.yaml", "modules"], { cwd: root });
    execFileSync("git", ["-c", "user.email=test@example.invalid", "-c", "user.name=Doc Verify Test",
      "commit", "-qm", "fixture"], { cwd: root });
    const result = spawnSync("node", [
      path.resolve("doc-verify/dist/cli.js"), "check", "--staged", "--profile", "draft",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(result.status).toBe(65);
    expect(result.stderr).toContain("config .doc-verify.yaml is not in the Git index");
  });

  it("reports the underlying cause for an unexpected filesystem error", () => {
    const root = cliFixture();
    rmSync(path.join(root, ".doc-verify.yaml"));
    mkdirSync(path.join(root, ".doc-verify.yaml"));
    const result = spawnSync("node", [
      path.resolve("doc-verify/dist/cli.js"), "check", "--all", "--profile", "draft",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(result.status).toBe(70);
    expect(result.stderr).toContain("doc-verify: internal error");
    expect(result.stderr).toMatch(/EISDIR|illegal operation on a directory/);
  });

  it("rejects --paths that select no configured document or dependency", () => {
    const root = cliFixture();
    const result = spawnSync("node", [
      path.resolve("doc-verify/dist/cli.js"), "check",
      "--paths", "design/a.md", "design/999-missing.md",
      "--profile", "draft",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(result.status).toBe(64);
    expect(result.stderr).toContain("design/999-missing.md");
    expect(result.stderr).toContain("selected no configured document or dependency");
    expect(result.stderr).not.toContain("design/a.md");
  });

  it("expands a --paths glob over the governed surface", () => {
    const root = cliFixture();
    mkdirSync(path.join(root, "receipts", "one"), { recursive: true });
    mkdirSync(path.join(root, "receipts", "two"), { recursive: true });
    writeFileSync(path.join(root, "receipts", "one", "a.md"), "# Receipt A\n## Review handoff — a\nEvidence.\n");
    writeFileSync(path.join(root, "receipts", "two", "b.md"), "# Receipt B\n## Review handoff — b\nEvidence.\n");
    writeFileSync(path.join(root, "receipts", "README.md"), "# Receipt guidance\n");
    writeFileSync(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: receipts/**/*.md
    artifact_kind: receipt
    modules: [modules/receipt.yaml]
  - pattern: receipts/README.md
    exclude: true
invalidation_patterns: []
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
    writeFileSync(path.join(root, "modules", "receipt.yaml"), `schema_version: 2
kind: verification-module
module: fixture.receipt
rules:
  top(D, S): core.section(D, S, _), core.depth(D, S, 2)
constraints:
  has-handoff:
    forall: core.meta(D, kind, receipt)
    require: top(D, S), core.heading(D, S, 'Review handoff — a')
    severity: error
    message: "{D} has no review handoff"
`);
    const result = spawnSync("node", [
      path.resolve("doc-verify/dist/cli.js"), "check",
      "--paths", "receipts/**/*.md",
      "--profile", "draft", "--format", "json",
    ], { cwd: root, encoding: "utf8", env: cliEnv() });
    expect(result.status, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as { affectedArtifacts: string[] };
    expect(report.affectedArtifacts).toEqual(["receipts/one/a.md", "receipts/two/b.md"]);
  });
});

/** The structural module the fixture's design rule names: no oracle, so no judge request is ever made. */
const DESIGN_MODULE = `schema_version: 2
kind: verification-module
module: fixture.design
rules:
  top(D, S): core.section(D, S, _), core.depth(D, S, 2)
constraints:
  has-problem:
    forall: core.meta(D, kind, design)
    require: top(D, S), core.heading(D, S, 'Problem')
    severity: error
    message: "{D} has no Problem section"
`;

/**
 * No judge key: structural constraints are decided without one (the fixture's module asks
 * nothing), so these runs never need a judge.
 */
function cliEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.TYPESAFE_API_KEY;
  delete env.API_KEY;
  return env;
}

function cliFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), "doc-verify-cli-"));
  mkdirSync(path.join(root, "design"), { recursive: true });
  mkdirSync(path.join(root, "modules"), { recursive: true });
  writeFileSync(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    artifact_kind: design
    modules: [modules/design.yaml]
    required_sections: [problem]
invalidation_patterns: []
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
  writeFileSync(path.join(root, "modules/design.yaml"), DESIGN_MODULE);
  writeFileSync(path.join(root, "design/a.md"), "# A\n## Problem\nA problem.\n## Rationale\nA rationale.\n");
  writeFileSync(path.join(root, "design/a.yaml"), `schema_version: 1
kind: document-contract
document:
  path: design/a.md
  kind: design
`);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}
