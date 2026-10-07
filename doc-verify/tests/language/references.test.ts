// Deterministic reference facts (owner priority 2, 2026-10-05): `core.ref`, `core.resolves` and
// `core.dangling`, and doc-verify:references' `references-resolve` / `paths-resolve`. No judge.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkDocuments } from "../../src/checker.js";
import { documentFacts, documentReferences, resolvesTarget, type ReferenceContext } from "../../src/engine/facts.js";
import { writeTerm } from "../../src/engine/terms.js";
import { renderText } from "../../src/report.js";
import { segmentMarkdown } from "../../src/segments.js";

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

  it("8: a line locator is its own kind, so a path rule never ranges over it", () => {
    // A line number is a position that rots, not a path: it is `line`, so `paths-resolve` (which
    // ranges over `path`) cannot report it, and a consumer opts in with `core.ref(D,S,T,line)`.
    expect(spans("`src/engine/run.ts:312` and `src/engine/run.ts:10-20`\n")).toEqual([
      ["src/engine/run.ts:312", "line"], ["src/engine/run.ts:10-20", "line"],
    ]);
    expect(spans("`src/engine/run.ts`\n")).toEqual([["src/engine/run.ts", "path"]]);
    // A bare name carrying an extension is a locator too.
    expect(spans("`facts.ts:148`\n")).toEqual([["facts.ts:148", "line"]]);
  });

  it("9: a colon that is not a file locator is not a reference at all", () => {
    // The stem must look like a file. These are not locators, so they are no reference. A port, a
    // version and a time are the near misses that make the stem test load-bearing.
    expect(spans("`node:18`, `12:30`, `utf-8:3`, `sleep:30`, `ratio:2`, `max:3`\n")).toEqual([]);
    expect(spans("`Step 3:12`\n")).toEqual([]);
    expect(spans("`localhost:8080`, `127.0.0.1:5432`, `example.com:443`\n")).toEqual([]);
  });

  it("10: a multi-dot stem and an extensionless stem are still locators", () => {
    // `types.d.ts` and a bare `Dockerfile` have no single-suffix extension, but the stem of a
    // locator is a file either way: the first ends in a known extension, the second carries a `/`.
    expect(spans("`types.d.ts:286`, `foo.test.ts:48`, `migrations-v2.test.ts:49-62`\n")).toEqual([
      ["types.d.ts:286", "line"], ["foo.test.ts:48", "line"], ["migrations-v2.test.ts:49-62", "line"],
    ]);
    expect(spans("`impl/environment/Dockerfile:38`\n")).toEqual([["impl/environment/Dockerfile:38", "line"]]);
  });

  it("11: a comma-separated list and a multi-range are one locator, not several", () => {
    // `:11,16` and `:280-289,393-400` name several lines of one file; the citation is the span.
    expect(spans("`schema.sql:11,16`\n")).toEqual([["schema.sql:11,16", "line"]]);
    expect(spans("`claim-loop.ts:280-289,393-400`\n")).toEqual([["claim-loop.ts:280-289,393-400", "line"]]);
    expect(spans("`impl/environment/Dockerfile:38,56-66`\n")).toEqual([
      ["impl/environment/Dockerfile:38,56-66", "line"],
    ]);
  });

  it("12: a dotfile locator is a locator; the dot is not an extension", () => {
    expect(spans("`.gitignore:3`, `.env:12`\n")).toEqual([[".gitignore:3", "line"], [".env:12", "line"]]);
  });

  it("13: a slash alt so `:797/826` is one locator, like the comma list", () => {
    expect(spans("`onboarding.test.ts:797/826`\n")).toEqual([["onboarding.test.ts:797/826", "line"]]);
    expect(spans("`facade.ts:119/154`\n")).toEqual([["facade.ts:119/154", "line"]]);
    expect(spans("`facade.ts:118-119`\n")).toEqual([["facade.ts:118-119", "line"]]);
  });

  it("14: a short-form stem naming a real document is a locator, resolved from context", () => {
    // `design/103:55` names a real design document by its short form, so the stem is a file. Only
    // the reference context knows that, so without one the shorthand stays out -- a guess would
    // make `child/3:1` a citation the moment a `child/3-*.md` existed.
    const files = ["design/103-pi-provision-surface.md", "design/21-ui-serving-extraction.md"];
    const context: ReferenceContext = { path: "design/x.md", exists: (file) => files.includes(file) || file === "design", files };
    const at = (markdown: string): Array<[string, string]> =>
      documentReferences(markdown, segmentMarkdown(markdown), context).map((r) => [r.target, r.kind]);
    expect(at("A `design/103:55` span.\n")).toEqual([["design/103:55", "line"]]);
    expect(at("A `design/21:157` span, and `design/21:157-160` too.\n")).toEqual([
      ["design/21:157", "line"], ["design/21:157-160", "line"],
    ]);
    // No such document: the stem names nothing, so it is not a locator.
    expect(at("A `design/99:5` span and a `child/3:1` signature.\n")).toEqual([]);
    // No context at all: the same shorthand stays out.
    expect(documentReferences("A `design/103:55` span.\n", segmentMarkdown("A `design/103:55` span.\n"))).toEqual([]);
  });

  it("15: a bare extensionless repository file is a locator, resolved from the inventory", () => {
    // A fixed extension list cannot cover every real filename (`Dockerfile`, `Makefile`, `.tf`), so
    // the inventory answers whether the bare stem is a file -- beside the document, at the root, or
    // uniquely in it. Without a context nothing resolves, which is what keeps the near misses out.
    const files = ["Dockerfile", "Makefile", "src/run.ts"];
    const context: ReferenceContext = { path: "docs/a.md", exists: (file) => files.includes(file), files };
    const at = (markdown: string, chosen = context): Array<[string, string]> =>
      documentReferences(markdown, segmentMarkdown(markdown), chosen).map((r) => [r.target, r.kind]);
    expect(at("A `Dockerfile:16` span, and `Dockerfile:16-20`.\n")).toEqual([
      ["Dockerfile:16", "line"], ["Dockerfile:16-20", "line"],
    ]);
    expect(at("A `Makefile:12` span.\n")).toEqual([["Makefile:12", "line"]]);
    // The same span with no context, or with the file absent, names nothing.
    expect(at("A `Dockerfile:16` span.\n", { path: "docs/a.md", exists: () => false, files: [] })).toEqual([]);
    expect(documentReferences("A `Dockerfile:16` span.\n", segmentMarkdown("A `Dockerfile:16` span.\n"))).toEqual([]);
    // A port, a version and a time are still not files.
    expect(at("`node:18`, `localhost:8080`, `12:30`, `utf-8:3`\n")).toEqual([]);
    // A resolved file name proves the STEM, not the value: the span must still be a line tail, or
    // every `Dockerfile:foo` and `Dockerfile:` would be a locator -- the port mistake in another
    // costume. The colon is taken from the FIRST colon, so a second colon cannot sneak past.
    expect(at("`Dockerfile:`, `Dockerfile:foo`, `Dockerfile:16abc`, `Dockerfile:x:16`\n")).toEqual([]);
    expect(at("`Makefile:`, `Makefile:-1`, `Makefile:1-`, `Makefile:1.5`, `Makefile: 1`\n")).toEqual([]);
  });

  it("16: a placeholder or predicate-indicator stem is not a locator", () => {
    // The stem is what the placeholder and predicate-indicator guards describe, so the guards are
    // tested against the stem, not the whole span.
    expect(spans("`path/X.md:123`, `task/N:5`, `child/3:1`, `design/02:12`\n")).toEqual([]);
  });

  it("17: a line locator inside a link's label is still a locator", () => {
    // Rule 1 normally suppresses a span that is only a link's label, so one link yields one ref.
    // A locator is not suppressed: the label is the reader's visible text and rots like any other
    // citation, while the link's own target is a different kind, so nothing is counted twice.
    const context = (extra: Partial<ReferenceContext> = {}): ReferenceContext => ({
      path: "docs/a.md", exists: (file) => file === "src/run.ts", files: ["src/run.ts"], ...extra,
    });
    const at = (markdown: string): Array<[string, string]> =>
      documentReferences(markdown, segmentMarkdown(markdown), context()).map((r) => [r.target, r.kind]);
    expect(at("See [`src/run.ts:312`](src/run.ts).\n")).toEqual([["src/run.ts", "link"], ["src/run.ts:312", "line"]]);
    // A label that is not a locator keeps the rule-1 suppression: one ref, the link.
    expect(at("See [`src/run.ts`](src/run.ts).\n")).toEqual([["src/run.ts", "link"]]);
    // A locator labelling a URL is prose, not a URL: it is still a citation.
    expect(at("See [`src/run.ts:312`](https://example.com).\n")).toEqual([["src/run.ts:312", "line"]]);
  });
});

async function repository(files: Record<string, string>, modules = "[doc-verify:references]"): Promise<string> {
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
    modules: ${modules}
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

describe("doc-verify:no-line-citations", () => {
  const MODULES = "[doc-verify:no-line-citations]";

  it("reddens a real path:line citation, deterministically and without a judge", async () => {
    const root = await repository(
      { "docs/a.md": "# Doc\n\n## Body\n\nThe publisher is `src/run.ts:312`.\n" },
      MODULES,
    );
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["docs/a.md"] }, profile: "auto" });
    const artifact = report.artifacts[0];
    const finding = artifact?.findings.find((item) => item.ruleId === "module.no-line-citations");
    expect(finding?.verdict).toBe("NO-GO");
    expect(finding?.message).toContain("src/run.ts:312");
    expect(artifact?.semanticCalls).toBe(0);
    expect(report.verdict).toBe("NO-GO");
  });

  it("stays green on a line-free document, and asks no judge", async () => {
    const root = await repository(
      { "docs/a.md": "# Doc\n\n## Body\n\nThe publisher is `src/run.ts` in `publish`.\n" },
      MODULES,
    );
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["docs/a.md"] }, profile: "auto" });
    const artifact = report.artifacts[0];
    expect(artifact?.findings.find((item) => item.ruleId === "module.no-line-citations")).toBeUndefined();
    expect(artifact?.semanticCalls).toBe(0);
    expect(report.verdict).toBe("PASS");
  });
});
