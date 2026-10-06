// Companion manifests after the v1 decommission: a companion names its document (`kind:
// document-contract`, `document:`) and may carry project fields. A v1 `verification:` block is
// ignored with a warning; the rule's `modules` alone verify the document.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkDocuments } from "../src/checker.js";
import { parseCompanion } from "../src/config.js";
import { sha256 } from "../src/hash.js";
import { repoPath } from "../src/types.js";
import { scriptedJudge } from "./engine-helpers.js";

const MODULE = `schema_version: 2
kind: verification-module
module: companion.design
constraints:
  has-problem:
    forall: core.meta(D, kind, design)
    require: core.section(D, S, _), core.heading(D, S, 'Problem')
    severity: error
    message: "{D} has no Problem section"
  not-draft:
    forall: core.meta(D, status, W)
    require: W in [reviewed, landed]
    severity: error
    profiles: [promotion]
    message: "{D} is a draft"
`;

const V1_BLOCK = `verification:
  kind: jev-prolog
  inherits: ../strategies/design.yaml#verification
`;

function contract(pathValue: string, extra = ""): string {
  return `schema_version: 1
kind: document-contract
document:
  path: ${pathValue}
  kind: design
  project_owner: docs-team
${extra}`;
}

const judge = scriptedJudge(() => ({ value: "holds" }));

function check(root: string, profile: "auto" | "draft" | "promotion" = "auto") {
  return checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile, backend: judge.backend });
}

describe("companion manifests", () => {
  it("parses a document contract, keeps project fields, and flags a v1 verification block", () => {
    const parsed = parseCompanion({
      path: repoPath("design/a.yaml"),
      content: contract("design/a.md", "commands: [npm test]\nfreshness: {owner: project}\n"),
      hash: sha256("project-fields"),
    });
    expect(parsed.document).toEqual({ path: "design/a.md", kind: "design" });
    expect(parsed.legacyVerification).toBe(false);
    const legacy = parseCompanion({ path: repoPath("design/a.yaml"), content: contract("design/a.md", V1_BLOCK), hash: sha256("legacy") });
    expect(legacy.legacyVerification).toBe(true);
    expect(() => parseCompanion({
      path: repoPath("design/a.yaml"),
      content: contract("design/b.md"),
      hash: sha256("mismatch"),
    })).toThrow("document.path must be design/a.md");
  });

  it("warns and uses repository defaults when the companion is absent", async () => {
    const root = await fixtureRepository();
    const report = await check(root, "draft");
    expect(report.verdict).toBe("PASS");
    expect(report.warningCount).toBe(1);
    expect(report.artifacts[0]?.warnings[0]?.ruleId).toBe("metadata.missing-companion");
  });

  it("ignores a companion's v1 verification block with a warning, and the verdict is the modules' own", async () => {
    const root = await fixtureRepository();
    await writeFile(path.join(root, "design/a.yaml"), contract("design/a.md", V1_BLOCK));
    const report = await check(root, "draft");
    expect(report.verdict).toBe("PASS");
    expect(report.artifacts[0]?.warnings.map((entry) => entry.ruleId)).toEqual(["metadata.legacy-verification"]);
    expect(report.artifacts[0]?.warnings[0]?.message).toContain("design/a.yaml carries a v1 verification: block, which is ignored");
    expect(report.artifacts[0]?.engine?.modules).toEqual(["modules/design.yaml"]);
  });

  it("reads the companion's document.status when the document has no Status section", async () => {
    const root = await fixtureRepository();
    await writeFile(path.join(root, "design/a.yaml"), contract("design/a.md").replace("  kind: design\n", "  kind: design\n  status: draft\n"));
    const report = await check(root);
    expect(report.artifacts[0]?.profile).toBe("draft");
    expect(report.verdict).toBe("PASS");
    const forced = await check(root, "promotion");
    expect(forced.verdict).toBe("NO-GO");
    expect(forced.artifacts[0]?.findings.map((entry) => entry.message).join("\n")).toContain("design/a.md is a draft");
  });

  it("refuses a companion whose document.kind is not the rule's artifact kind", async () => {
    const root = await fixtureRepository();
    await writeFile(path.join(root, "design/a.yaml"), contract("design/a.md").replace("  kind: design\n", "  kind: goal\n"));
    await expect(check(root)).rejects.toThrow("invalid design/a.yaml: document.kind must be design");
  });

  it("reports malformed companion YAML as a usage error", async () => {
    const root = await fixtureRepository();
    await writeFile(path.join(root, "design/a.yaml"), "verification: [\n");
    await expect(check(root, "draft")).rejects.toThrow("invalid design/a.yaml: malformed YAML");
  });
});

async function fixtureRepository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-companion-"));
  await mkdir(path.join(root, "design"), { recursive: true });
  await mkdir(path.join(root, "modules"), { recursive: true });
  await writeFile(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    artifact_kind: design
    modules: [modules/design.yaml]
    required_sections: [problem]
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
  await writeFile(path.join(root, "modules/design.yaml"), MODULE);
  await writeFile(path.join(root, "design/a.md"), "# A\n## Problem\nA concrete problem.\n");
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}
