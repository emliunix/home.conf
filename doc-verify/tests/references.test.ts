// Deterministic reference facts (owner priority 2, 2026-10-05): `core.ref`, `core.resolves` and
// `core.dangling`, and doc-verify:references' `references-resolve` / `paths-resolve`. No judge.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkDocuments } from "../src/checker.js";
import { documentFacts, documentReferences, resolvesTarget, type ReferenceContext } from "../src/engine/facts.js";
import { writeTerm } from "../src/engine/terms.js";
import { renderText } from "../src/report.js";
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

// Third pass (2026-10-05): which code spans are paths. One test per rule in README "Reference facts".
describe("core.ref path rules", () => {
  const FILES = ["README.md", "docs/README.md", "docs/a.md", "src/engine/run.ts", "src/notes.md", "packages/core/ir.py", "packages/core/notes.md", "archive/notes.md"];
  const directories = new Set(["docs", "src", "src/engine", "packages", "packages/core", "archive"]);
  const context = (extra: Partial<ReferenceContext> = {}): ReferenceContext => ({
    path: "docs/a.md",
    exists: (file) => FILES.includes(file) || directories.has(file),
    files: FILES,
    ...extra,
  });
  const spans = (markdown: string, extra: Partial<ReferenceContext> = {}): Array<[string, string]> =>
    documentReferences(markdown, segmentMarkdown(markdown), context(extra))
      .filter((reference) => reference.kind !== "link")
      .map((reference) => [reference.target, reference.kind]);

  it("1: a span in the text of a link that resolves (or of a URL) is the link's label", () => {
    expect(spans("See [`ir.py`](../packages/core/ir.py) and [`x.py`](https://example.com/x.py).\n")).toEqual([]);
    expect(spans("See [`gone/x.py`](gone/x.py).\n")).toEqual([["gone/x.py", "path"]]);
  });

  it("2: a span that is only extensions is not a path", () => {
    expect(spans("Files ending `.md`, or `.md/.yaml`; but `docs/a.md` is one.\n")).toEqual([["docs/a.md", "path"]]);
  });

  it("3: a span starting with / is a URL route", () => {
    expect(spans("POST `/api/build`, then `/step`; also `/tmp/run.py`.\n")).toEqual([]);
  });

  it("4: slash-joined words are a path only with an extension or an existing first directory", () => {
    expect(spans("The `lane/site/visit` order; `src/engine` and `docs/gone`; `nowhere/x.md`; `../src/engine`.\n")).toEqual([
      ["src/engine", "path"], ["docs/gone", "path"], ["nowhere/x.md", "path"], ["../src/engine", "path"],
    ]);
  });

  it("5: a Git ref is not a path: the ref list, or the origin/archive/exp/refs prefixes", () => {
    const markdown = "Tag `archive/pre-cut-2026-10-01`, `origin/main`, `exp/overnight`, `refs/heads/main`, `p2/layering-check.md`.\n";
    expect(spans(markdown, { gitRefs: ["archive/pre-cut-2026-10-01", "p2/layering-check.md"] })).toEqual([]);
    // The prefix alone does not hide a path under a directory of that name; the ref list does.
    expect(spans("`archive/notes.md`, `archive/pre-cut-2026-10-01`\n")).toEqual([
      ["archive/notes.md", "path"], ["archive/pre-cut-2026-10-01", "path"],
    ]);
    expect(spans("`origin/main`, `exp/overnight`\n")).toEqual([]);
  });

  it("6: a bare file name is a path when it resolves or names one tracked file, else a name", () => {
    const markdown = "Read `ir.py`, `README.md`, `a.md`, `notes.md`, `gone.py` and `local-env.md`.\n";
    // ir.py: one tracked file; README.md: at the root; notes.md: two tracked files, neither beside the document.
    expect(spans(markdown, { path: "design/01.md" })).toEqual([
      ["ir.py", "path"], ["README.md", "path"], ["a.md", "path"], ["notes.md", "name"], ["gone.py", "name"], ["local-env.md", "name"],
    ]);
    // Beside the document a name resolves even when other files share it.
    expect(spans("`notes.md`\n", { path: "src/doc.md" })).toEqual([["notes.md", "path"]]);
    const facts = documentFacts({ ...context({ path: "design/01.md" }), markdown }).facts.map(writeTerm);
    expect(facts).toContain("'core::resolves'('design/01.md','ir.py')");
    expect(facts).toContain("'core::dangling'('design/01.md','@preamble','gone.py',name)");
    expect(facts.filter((fact) => fact.startsWith("'core::dangling'") && fact.endsWith(",path)"))).toEqual([]);
  });

  it("7: YAML front matter is metadata, not a section, and is not read for references", () => {
    const markdown = "---\nstatus: living\nsee: 'the `gone/x.md` file'\n---\n\n# Title\n\n## Body\n\n`gone/y.md`\n";
    expect(segmentMarkdown(markdown).map((section) => [section.id, section.depth])).toEqual([["@preamble", 0], ["title", 1], ["body", 2]]);
    expect(spans(markdown)).toEqual([["gone/y.md", "path"]]);
    // A document that opens with a rule over prose keeps its heading.
    const ruled = "---\n# Title\n---\n\ntext\n";
    expect(segmentMarkdown(ruled).some((section) => section.id === "title")).toBe(true);
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
    expect(finding?.repair).toBe("Fix the path or remove the link");
    expect(finding?.sections).toEqual(["body"]);
    expect(finding?.basis).toEqual(["structural: core.dangling(docs/a.md, body, gone.md, link)"]);
  });

  it("warns on a backtick path that does not exist, without failing the document", async () => {
    const root = await repository({ "docs/a.md": GOOD.replace("`docs/guide.md`", "`docs/old-guide.md`"), "docs/guide.md": "# Guide\n" });
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["docs/a.md"] }, profile: "auto" });
    const artifact = report.artifacts[0];
    expect(artifact?.verdict).toBe("PASS");
    expect(artifact?.findings.find((item) => item.ruleId === "module.paths-resolve")?.verdict).toBe("WARN");
  });

  it("8: labels a violated warning WARN in the text report, and leaves a bare name and a branch alone", async () => {
    const root = await repository({
      "docs/a.md": GOOD.replace("`docs/guide.md`", "`docs/old-guide.md`, `notes.py`, `feat/x`"),
      "docs/guide.md": "# Guide\n",
    });
    execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "--allow-empty", "-qm", "init"], { cwd: root });
    execFileSync("git", ["branch", "feat/x"], { cwd: root });
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["docs/a.md"] }, profile: "auto" });
    const text = renderText(report);
    expect(text).toContain("module.paths-resolve WARN violated: docs/a.md §body names the path docs/old-guide.md, which does not exist");
    expect(text).not.toContain("NEEDS-REVIEW");
    expect(text).not.toContain("notes.py");
    expect(text).not.toContain("feat/x");
    expect(report.verdict).toBe("PASS");
  });
});
