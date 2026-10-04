// The persistent oracle cache (owner priority 5, 2026-10-05): one file per atom at
// .doc-verify-cache/atoms/<key>.json, mode 0600, honoured by default, bypassed by --no-cache
// (cache: "off") and by a profile's `cache: refresh`.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkDocuments } from "../src/checker.js";
import { scriptedJudge } from "./engine-helpers.js";

const MODULE = `schema_version: 2
kind: verification-module
module: cached
oracles:
  falsifies(D, S):
    ask: The verification names a check that would fail if its claim were false.
    evidence: core.body(D, S)
    threshold: 0.5
rules:
  verification_section(D, S): core.section(D, S, _), core.heading(D, S, 'Verification')
constraints:
  verification-falsifies:
    forall: verification_section(D, S)
    require: falsifies(D, S)
    severity: error
`;

const DOC = "# D\n\n## Verification\n\n`pytest -q` fails when the parser drops a field.\n";

async function repository(profiles = ""): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-cache-"));
  await mkdir(path.join(root, "design"));
  await mkdir(path.join(root, "modules"));
  await writeFile(path.join(root, "modules/design.yaml"), MODULE);
  await writeFile(path.join(root, "design/a.md"), DOC);
  await writeFile(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: design/*.md
    artifact_kind: design
    modules: [modules/design.yaml]
invalidation_patterns: [.doc-verify.yaml]
judge: {kind: jev, model: jev-1.13.0, client_sha256: ce983f8de97d5b30d527a7116f0c49ad3d17e098d2c3f17c9600041260c65dcb, attestation_max_age_seconds: 3600}
policy: {kind: semantic-boundary, version: 1, max_evidence_bytes: 12000, forbidden_literals: []}
${profiles}`);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}

const atoms = (root: string): string[] => {
  const directory = path.join(root, ".doc-verify-cache/atoms");
  return existsSync(directory) ? readdirSync(directory) : [];
};

describe("persistent oracle cache", () => {
  it("answers a repeated atom from .doc-verify-cache without asking the judge", async () => {
    const root = await repository();
    const judge = scriptedJudge(() => ({ value: "holds" }));
    const first = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "promotion", backend: judge.backend });
    expect(first).toMatchObject({ verdict: "PASS", semanticCalls: 1, cacheHits: 0 });
    const files = atoms(root);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[a-f0-9]{64}\.json$/);
    expect(statSync(path.join(root, ".doc-verify-cache/atoms", files[0] ?? "")).mode & 0o777).toBe(0o600);

    const second = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "promotion", backend: judge.backend });
    expect(second).toMatchObject({ verdict: "PASS", semanticCalls: 0, cacheHits: 1 });
    expect(judge.requests).toHaveLength(1);
    expect(second.artifacts[0]?.engine?.report.oracles[0]?.cacheHit).toBe(true);
  });

  it("decides an oracle constraint from the cache with no key", async () => {
    const root = await repository();
    await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "promotion", backend: scriptedJudge(() => ({ value: "holds" })).backend });
    const previous = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      const keyless = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "promotion" });
      expect(keyless).toMatchObject({ verdict: "PASS", cacheHits: 1, semanticCalls: 0 });
    } finally {
      if (previous !== undefined) {
        process.env.TYPESAFE_API_KEY = previous;
      }
    }
  });

  it("neither reads nor writes the cache when it is off (--no-cache)", async () => {
    const root = await repository();
    const judge = scriptedJudge(() => ({ value: "holds" }));
    await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "promotion", backend: judge.backend, cache: "off" });
    expect(atoms(root)).toEqual([]);
    await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "promotion", backend: judge.backend });
    const off = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "promotion", backend: judge.backend, cache: "off" });
    expect(off).toMatchObject({ semanticCalls: 1, cacheHits: 0 });
    expect(judge.requests).toHaveLength(3);
  });

  it("asks again and rewrites the entry under a profile's cache: refresh", async () => {
    const root = await repository("profiles:\n  promotion: {cache: refresh}\n");
    const holds = scriptedJudge(() => ({ value: "holds" }));
    await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "promotion", backend: holds.backend });
    const fails = scriptedJudge(() => ({ value: "fails" }));
    const refreshed = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "promotion", backend: fails.backend });
    expect(refreshed).toMatchObject({ verdict: "NO-GO", semanticCalls: 1, cacheHits: 0 });
    expect(fails.requests).toHaveLength(1);
    // The draft profile has no refresh setting, so it reuses the rewritten entry.
    const draft = await checkDocuments({ root, mode: { kind: "paths", paths: ["design/a.md"] }, profile: "draft", backend: holds.backend });
    expect(draft).toMatchObject({ verdict: "NO-GO", cacheHits: 1 });
  });
});
