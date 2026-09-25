import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkDocuments } from "../src/checker.js";
import { loadDocVerifyEnv } from "../src/local-env.js";
import { BlockedError } from "../src/types.js";

describe("local credential file", () => {
  it("reads API_KEY from a symlinked .env.doc-verify and ignores every other name", () => {
    const root = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    const target = path.join(root, "env-jev");
    writeFileSync(target, "API_KEY='quoted-key'\nOTHER_SECRET=nope\n# API_KEY=commented\nexport UNRELATED=1\n");
    symlinkSync(target, path.join(root, ".env.doc-verify"));
    const previous = process.env.TYPESAFE_API_KEY;
    const previousOther = process.env.OTHER_SECRET;
    const previousApi = process.env.API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.OTHER_SECRET;
    process.env.API_KEY = "process-wide-key";
    try {
      loadDocVerifyEnv(root);
      expect(process.env.TYPESAFE_API_KEY).toBe("quoted-key");
      expect(process.env.OTHER_SECRET).toBeUndefined();
      expect(process.env.API_KEY).toBe("process-wide-key");
    } finally {
      restore("TYPESAFE_API_KEY", previous);
      restore("OTHER_SECRET", previousOther);
      restore("API_KEY", previousApi);
    }
  });

  it("keeps an explicit TYPESAFE_API_KEY and treats a missing file as no credential", () => {
    const present = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    const absent = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    const previous = process.env.TYPESAFE_API_KEY;
    process.env.TYPESAFE_API_KEY = "already-set";
    try {
      writeFileSync(path.join(present, ".env.doc-verify"), "API_KEY=from-file\n");
      loadDocVerifyEnv(present);
      expect(process.env.TYPESAFE_API_KEY).toBe("already-set");
      delete process.env.TYPESAFE_API_KEY;
      loadDocVerifyEnv(absent);
      expect(process.env.TYPESAFE_API_KEY).toBeUndefined();
    } finally {
      restore("TYPESAFE_API_KEY", previous);
    }
  });

  it("reports an unreadable file without including its surrounding names", () => {
    const root = mkdtempSync(path.join(tmpdir(), "doc-verify-env-"));
    mkdirSync(path.join(root, ".env.doc-verify"));
    const previous = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      expect(() => loadDocVerifyEnv(root)).toThrow(BlockedError);
      try {
        loadDocVerifyEnv(root);
      } catch (error) {
        expect(error).toBeInstanceOf(BlockedError);
        expect((error as Error).message).toBe("cannot read .env.doc-verify (EISDIR)");
        expect((error as Error).message).not.toContain(root);
      }
    } finally {
      restore("TYPESAFE_API_KEY", previous);
    }
  });

  it("applies the file during a check and keeps the key out of the report", async () => {
    const root = await fixtureRepository();
    const canary = "local-env-canary-key";
    await writeFile(path.join(root, ".env.doc-verify"), `API_KEY=${canary}\n`);
    const previous = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      const report = await checkDocuments({
        root,
        mode: { kind: "paths", paths: ["design/a.md"] },
        profile: "draft",
      });
      expect(process.env.TYPESAFE_API_KEY).toBe(canary);
      expect(JSON.stringify(report)).not.toContain(canary);
    } finally {
      restore("TYPESAFE_API_KEY", previous);
    }
  });
});

function restore(name: "TYPESAFE_API_KEY" | "OTHER_SECRET" | "API_KEY", value: string | undefined): void {
  if (value !== undefined) {
    process.env[name] = value;
    return;
  }
  if (name === "TYPESAFE_API_KEY") {
    delete process.env.TYPESAFE_API_KEY;
  } else if (name === "OTHER_SECRET") {
    delete process.env.OTHER_SECRET;
  } else {
    delete process.env.API_KEY;
  }
}

async function fixtureRepository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-env-check-"));
  await mkdir(path.join(root, "design"), { recursive: true });
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
  await writeFile(path.join(root, "strategies/design.yaml"), `schema_version: 1
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
`);
  await writeFile(path.join(root, "design/a.md"), "# A\n## Problem\nA concrete problem.\n");
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}
