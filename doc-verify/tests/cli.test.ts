import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    ], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^PASS: 1 artifact\(s\)/);
  });

  it("prints project impact, rubric, and section scope in verbose mode", () => {
    const root = cliFixture();
    const cli = path.resolve("doc-verify/dist/cli.js");
    const result = spawnSync("node", [
      cli, "check", "--paths", "design/a.md",
      "--profile", "draft", "--format", "text", "--verbose",
    ], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("verification invocation=paths:design/a.md requested-profile=draft");
    expect(result.stdout).toContain("artifact design/a.md [design] PASS profile=draft");
    expect(result.stdout).toContain("impact: design/a.md");
    expect(result.stdout).toContain("required sections (1): problem");
    expect(result.stdout).toContain("strategies/design.yaml#verification");
    expect(result.stdout).toContain("design/a.yaml#/verification");
    expect(result.stdout).toContain("rubrics/default.yaml#rubrics");
    expect(result.stdout).toContain("design.problem sections=problem@2:4 result=planned");
    expect(result.stdout).toContain("decision: none");
  });

  it("lets CLI section and rubric arguments override the companion profile", () => {
    const root = cliFixture();
    const cli = path.resolve("doc-verify/dist/cli.js");
    const result = spawnSync("node", [
      cli, "check", "--paths", "design/a.md", "--profile", "draft",
      "--section", "rationale", "--rubric", "rubrics/override.yaml#rubrics",
      "--format", "json",
    ], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as { artifacts: Array<{ rubricChain: Array<{ path: string }> }> };
    expect(report.artifacts[0]?.rubricChain.map((entry) => entry.path)).toEqual(["rubrics/override.yaml"]);
  });

  it("reports a missing config with its expected path and a distinct exit", () => {
    const root = mkdtempSync(path.join(tmpdir(), "doc-verify-cli-no-config-"));
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    const result = spawnSync("node", [
      path.resolve("doc-verify/dist/cli.js"), "check", "--all", "--profile", "draft",
    ], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(66);
    expect(result.stderr).toContain("config .doc-verify.yaml not found");
    expect(result.stderr).toContain(path.join(root, ".doc-verify.yaml"));
  });

  it("reports a config that is absent from the Git index with a distinct exit", () => {
    const root = cliFixture();
    execFileSync("git", ["add", "design/a.md", "design/a.yaml", "rubrics", "strategies"], { cwd: root });
    execFileSync("git", ["-c", "user.email=test@example.invalid", "-c", "user.name=Doc Verify Test",
      "commit", "-qm", "fixture"], { cwd: root });
    const result = spawnSync("node", [
      path.resolve("doc-verify/dist/cli.js"), "check", "--staged", "--profile", "draft",
    ], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(65);
    expect(result.stderr).toContain("config .doc-verify.yaml is not in the Git index");
  });

  it("reports the underlying cause for an unexpected filesystem error", () => {
    const root = cliFixture();
    rmSync(path.join(root, ".doc-verify.yaml"));
    mkdirSync(path.join(root, ".doc-verify.yaml"));
    const result = spawnSync("node", [
      path.resolve("doc-verify/dist/cli.js"), "check", "--all", "--profile", "draft",
    ], { cwd: root, encoding: "utf8" });
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
    ], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(64);
    expect(result.stderr).toContain("design/999-missing.md");
    expect(result.stderr).toContain("selected no configured document or dependency");
    expect(result.stderr).not.toContain("design/a.md");
  });
});

function cliFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), "doc-verify-cli-"));
  mkdirSync(path.join(root, "design"), { recursive: true });
  mkdirSync(path.join(root, "rubrics"), { recursive: true });
  mkdirSync(path.join(root, "strategies"), { recursive: true });
  writeFileSync(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    artifact_kind: design
    verification: strategies/design.yaml#verification
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
  const rubric = (section: string): string => `schema_version: 1
rubrics:
  kind: jev
  threshold: 1
  items:
    - id: design.${section}
      artifact_kinds: [design]
      applies_to: {sections: [${section}], scope: combined}
      evidence: {source: section_body, max_bytes: 1000}
      question:
        kind: choose
        instruction: Is the ${section} explicit?
        options: [supported, refuted, unknown]
      critical: true
      weight: 1
      scores: {supported: 1, refuted: 0, unknown: 0}
`;
  writeFileSync(path.join(root, "rubrics/default.yaml"), rubric("problem"));
  writeFileSync(path.join(root, "rubrics/override.yaml"), rubric("rationale"));
  writeFileSync(path.join(root, "strategies/design.yaml"), `schema_version: 1
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
  writeFileSync(path.join(root, "design/a.md"), "# A\n## Problem\nA problem.\n## Rationale\nA rationale.\n");
  writeFileSync(path.join(root, "design/a.yaml"), `schema_version: 1
kind: document-contract
document:
  path: design/a.md
  kind: design
verification:
  kind: jev-prolog
  inherits: ../strategies/design.yaml#verification
  profiles:
    draft:
      sections: [problem]
      rubric: rubrics/default.yaml#rubrics
      cache: reuse
    promotion:
      cache: refresh
`);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}
