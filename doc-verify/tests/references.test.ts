// Deterministic reference facts (owner priority 2, 2026-10-05): `core.ref`, `core.resolves` and
// `core.dangling`, and doc-verify:references' `references-resolve` / `paths-resolve`. No judge.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkDocuments } from "../src/checker.js";
import { documentFacts, documentReferences, resolvesTarget } from "../src/engine/facts.js";
import { writeTerm } from "../src/engine/terms.js";
import { segmentMarkdown } from "../src/segments.js";

const DOC = [
  "Intro links [the readme](../README.md).",
  "",
  "# Title",
  "",
  "## Links",
  "",
  "See [design](02-other.md#rationale), [site](https://example.com), [mail](mailto:a@b.c),",
  "[self](#links), ![img](img/a.png) and [gone](missing/nowhere.md).",
  "",
  "[ref]: ../tools/run.sh",
  "",
  "### Paths",
  "",
  "Read `src/a.ts`, `package.json`, `child/3`, `core.body`, `path/X.md`, `just-a-word`, `a b/c`.",
  "",
  "```sh",
  "cat [not a link](nowhere.md) `fenced/path.ts`",
  "```",
  "",
].join("\n");

describe("core.ref facts", () => {
  it("collects non-URL link targets and path-like code spans, by innermost section", () => {
    const references = documentReferences(DOC, segmentMarkdown(DOC));
    expect(references).toEqual([
      { section: "@preamble", target: "../README.md", kind: "link" },
      { section: "links", target: "02-other.md#rationale", kind: "link" },
      { section: "links", target: "#links", kind: "link" },
      { section: "links", target: "img/a.png", kind: "link" },
      { section: "links", target: "missing/nowhere.md", kind: "link" },
      { section: "links", target: "../tools/run.sh", kind: "link" },
      { section: "links/paths", target: "src/a.ts", kind: "path" },
      { section: "links/paths", target: "package.json", kind: "path" },
    ]);
  });

  it("resolves relative to the document's directory or the repository root; a directory counts", () => {
    const files = new Set(["README.md", "design/02-other.md", "src/a.ts", "tools"]);
    const exists = (file: string): boolean => files.has(file);
    expect(resolvesTarget("design/01.md", "../README.md", exists)).toBe(true);
    expect(resolvesTarget("design/01.md", "02-other.md#rationale", exists)).toBe(true);
    expect(resolvesTarget("design/01.md", "src/a.ts", exists)).toBe(true);
    expect(resolvesTarget("design/01.md", "../tools/", exists)).toBe(true);
    expect(resolvesTarget("design/01.md", "#links", exists)).toBe(true);
    expect(resolvesTarget("design/01.md", "missing/nowhere.md", exists)).toBe(false);
    expect(resolvesTarget("design/01.md", "../../outside.md", exists)).toBe(false);
  });

  it("emits ref/4, resolves/2 and dangling/4", () => {
    const files = new Set(["README.md", "design/02-other.md", "src/a.ts", "package.json", "design/img/a.png", "tools/run.sh"]);
    const facts = documentFacts({ path: "design/01.md", markdown: DOC, exists: (file) => files.has(file) }).facts.map(writeTerm);
    expect(facts).toContain("'core::ref'('design/01.md',links,'missing/nowhere.md',link)");
    expect(facts).toContain("'core::dangling'('design/01.md',links,'missing/nowhere.md',link)");
    expect(facts).toContain("'core::resolves'('design/01.md','02-other.md#rationale')");
    expect(facts.filter((fact) => fact.startsWith("'core::dangling'"))).toHaveLength(1);
  });
});

async function repository(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-refs-"));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  await writeFile(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: docs/*.md
    artifact_kind: doc
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
`);
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  return root;
}

describe("doc-verify:references", () => {
  const GOOD = "# Doc\n\n## Body\n\nSee [the guide](guide.md) and `docs/guide.md`.\n";

  it("passes when every link and path resolves, with no judge", async () => {
    const root = await repository({ "docs/a.md": GOOD, "docs/guide.md": "# Guide\n" });
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["docs/a.md"] }, profile: "auto" });
    expect(report.artifacts[0]?.verdict).toBe("PASS");
    expect(report.semanticCalls).toBe(0);
  });

  it("turns a seeded broken link NO-GO with the library's message and repair", async () => {
    const root = await repository({ "docs/a.md": GOOD.replace("guide.md)", "gone.md)"), "docs/guide.md": "# Guide\n" });
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["docs/a.md"] }, profile: "auto" });
    const artifact = report.artifacts[0];
    expect(artifact?.verdict).toBe("NO-GO");
    const finding = artifact?.findings.find((item) => item.ruleId === "module.references-resolve");
    expect(finding?.verdict).toBe("NO-GO");
    expect(finding?.message).toContain("docs/a.md §body links to gone.md, which does not exist");
    expect(finding?.message).toContain("Fix the path or remove the link");
  });

  it("warns on a backtick path that does not exist, without failing the document", async () => {
    const root = await repository({ "docs/a.md": GOOD.replace("`docs/guide.md`", "`docs/old-guide.md`"), "docs/guide.md": "# Guide\n" });
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["docs/a.md"] }, profile: "auto" });
    const artifact = report.artifacts[0];
    expect(artifact?.verdict).toBe("PASS");
    expect(artifact?.findings.find((item) => item.ruleId === "module.paths-resolve")?.verdict).toBe("NEEDS-REVIEW");
  });
});
