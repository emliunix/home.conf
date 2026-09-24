import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createMockJevJudgeBackend } from "deepclause-sdk";
import { describe, expect, it } from "vitest";

import { checkDocuments } from "../src/checker.js";
import { parseCompanion } from "../src/config.js";
import { sha256 } from "../src/hash.js";
import { renderText } from "../src/report.js";
import { repoPath } from "../src/types.js";

const baseStrategy = `schema_version: 1
kind: verification-strategy
verification:
  kind: jev-prolog
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
  default_profile: draft
  profiles:
    draft:
      cache: reuse
    promotion:
      cache: refresh
`;

describe("companion manifests", () => {
  it("parses a strict document contract with a local rubric and profile strategies", () => {
    const content = `schema_version: 1
kind: document-contract
document:
  path: design/a.md
  kind: design
verification:
  kind: jev-prolog
  inherits: ../strategies/design.yaml#verification
  rubrics:
    kind: jev
    threshold: 1
    items: []
  profiles:
    draft:
      cache: reuse
    promotion:
      sections: [problem]
      cache: refresh
commands: [npm test]
evidence_level: E2
`;
    const companion = parseCompanion({ path: repoPath("design/a.yaml"), content, hash: sha256(content) });
    expect(companion.document.kind).toBe("design");
    expect(companion.verification.inherits).toBe("../strategies/design.yaml#verification");
    expect(companion.verification.rubrics?.kind).toBe("jev");
    expect(companion.verification.profiles?.promotion).toEqual({ sections: ["problem"], cache: "refresh" });
  });

  it("warns and uses repository defaults when the companion is absent", async () => {
    const root = await fixtureRepository();
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "draft" });
    expect(report.verdict).toBe("PASS");
    expect(report.warningCount).toBe(1);
    expect(report.artifacts[0]?.warnings[0]?.ruleId).toBe("metadata.missing-companion");
  });

  it("uses the companion as the local rubric root and applies its promotion profile", async () => {
    const root = await fixtureRepository();
    await writeFile(path.join(root, "design/a.yaml"), `schema_version: 1
kind: document-contract
document:
  path: design/a.md
  kind: design
verification:
  kind: jev-prolog
  inherits: ../strategies/design.yaml#verification
  rubrics:
    kind: jev
    items:
      - id: design.local
        artifact_kinds: [design]
        applies_to: {sections: [problem], scope: combined}
        evidence: {source: section_body, max_bytes: 1000}
        question:
          kind: choose
          instruction: Is the local condition explicit?
          options: [supported, refuted, unknown]
        critical: true
        weight: 1
        scores: {supported: 1, refuted: 0, unknown: 0}
  profiles:
    draft:
      cache: reuse
    promotion:
      sections: [problem]
      cache: refresh
`);
    const report = await checkDocuments({
      root,
      mode: { kind: "paths", paths: ["design/a.md"] },
      profile: "promotion",
      backend: createMockJevJudgeBackend({ choice: "first" }),
    });
    expect(report.verdict).toBe("PASS");
    expect(report.warningCount).toBe(0);
    expect(report.semanticCalls).toBe(1);
    expect(report.artifacts[0]?.strategyChain.map((entry) => entry.path)).toEqual([
      "strategies/design.yaml",
      "design/a.yaml",
    ]);
    expect(report.artifacts[0]?.rubricChain.map((entry) => entry.path)).toEqual([
      "strategies/design.yaml",
      "design/a.yaml",
    ]);
    expect(report.artifacts[0]?.trace[0]?.facts).toEqual(["supported", "supported"]);
    const verbose = renderText(report, { verbose: true });
    expect(verbose).toContain("design.problem sections=problem@2:4 result=supported");
    expect(verbose).toContain("design.local sections=problem@2:4 result=supported");
    expect(verbose).toContain("decision: PASS via all.required.facts facts=supported,supported");

    const repeated = await checkDocuments({
      root,
      mode: { kind: "paths", paths: ["design/a.md"] },
      profile: "promotion",
      backend: createMockJevJudgeBackend({ choice: "first" }),
    });
    expect(repeated.semanticCalls).toBe(1);
    expect(repeated.cacheHits).toBe(0);
  });

  it("resolves a profile rubric relative to its companion", async () => {
    const root = await fixtureRepository();
    await writeFile(path.join(root, "rubrics/profile.yaml"), `schema_version: 1
rubrics:
  kind: jev
  threshold: 1
  items:
    - id: design.rationale
      artifact_kinds: [design]
      applies_to: {sections: [rationale], scope: combined}
      evidence: {source: section_body, max_bytes: 1000}
      question:
        kind: choose
        instruction: Is the rationale explicit?
        options: [supported, refuted, unknown]
      critical: true
      weight: 1
      scores: {supported: 1, refuted: 0, unknown: 0}
`);
    await writeFile(path.join(root, "design/a.md"), "# A\n## Problem\nA concrete problem.\n## Rationale\nA concrete rationale.\n");
    await writeFile(path.join(root, "design/a.yaml"), `schema_version: 1
kind: document-contract
document:
  path: design/a.md
  kind: design
verification:
  kind: jev-prolog
  inherits: ../strategies/design.yaml#verification
  profiles:
    draft:
      cache: reuse
    promotion:
      rubric: rubrics/profile.yaml#rubrics
      sections: [rationale]
`);
    const report = await checkDocuments({
      root,
      mode: { kind: "paths", paths: ["design/a.md"] },
      profile: "promotion",
      backend: createMockJevJudgeBackend({ choice: "first" }),
      useCache: false,
    });
    expect(report.verdict).toBe("PASS");
    expect(report.artifacts[0]?.rubricChain.map((entry) => entry.path)).toEqual(["rubrics/profile.yaml"]);
    expect(report.artifacts[0]?.trace[0]?.facts).toEqual(["supported"]);
  });

  it("rejects a malformed companion instead of silently falling back", async () => {
    const root = await fixtureRepository();
    await writeFile(path.join(root, "design/a.yaml"), `schema_version: 1
kind: document-contract
document:
  path: design/a.md
  kind: design
verification:
  kind: jev-prolog
  inherits: ../strategies/design.yaml#verification
  profiles:
    draft:
      cache: sometimes
    promotion:
      cache: refresh
`);
    await expect(checkDocuments({
      root,
      mode: { kind: "paths", paths: ["design/a.md"] },
      profile: "draft",
    })).rejects.toThrow("invalid design/a.yaml");
  });

  it("reports malformed companion YAML as a usage error", async () => {
    const root = await fixtureRepository();
    await writeFile(path.join(root, "design/a.yaml"), "verification: [\n");
    await expect(checkDocuments({
      root,
      mode: { kind: "paths", paths: ["design/a.md"] },
      profile: "draft",
    })).rejects.toThrow("invalid design/a.yaml: malformed YAML");
  });

  it("accepts project fields but rejects unknown verification fields and mismatched identities", () => {
    const contract = (pathValue: string, verificationExtra = "", projectExtra = ""): string => `schema_version: 1
kind: document-contract
document:
  path: ${pathValue}
  kind: design
  project_owner: docs-team
verification:
  kind: jev-prolog
  inherits: ../strategies/design.yaml#verification
${verificationExtra}${projectExtra}`;
    expect(() => parseCompanion({
      path: repoPath("design/a.yaml"),
      content: contract("design/b.md"),
      hash: sha256("mismatch"),
    })).toThrow("document.path must be design/a.md");
    const parsed = parseCompanion({
      path: repoPath("design/a.yaml"),
      content: contract("design/a.md", "", "commands: [npm test]\nfreshness: {owner: project}\n"),
      hash: sha256("project-fields"),
    });
    expect(parsed.document).toEqual({ path: "design/a.md", kind: "design" });
    expect(() => parseCompanion({
      path: repoPath("design/a.yaml"),
      content: contract("design/a.md", "  unexpected: true\n"),
      hash: sha256("unknown-verification"),
    })).toThrow("invalid design/a.yaml");
  });
});

async function fixtureRepository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-companion-"));
  await mkdir(path.join(root, "design"), { recursive: true });
  await mkdir(path.join(root, "rubrics"), { recursive: true });
  await mkdir(path.join(root, "strategies"), { recursive: true });
  await writeFile(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    artifact_kind: design
    verification: strategies/design.yaml#verification
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
  await writeFile(path.join(root, "strategies/design.yaml"), baseStrategy);
  await writeFile(path.join(root, "design/a.md"), "# A\n## Problem\nA concrete problem.\n");
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}
