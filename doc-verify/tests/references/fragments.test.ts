// Kernel-trials round 11 (design/07 phase 0): section references are checked. The fixture
// (`doc-verify/tests/references/fragment-fixture/fixture.md`, frozen from round 11) runs through `checkDocuments` with a
// rule selecting it as a design, and every `fixture` label in labels.yaml is scored by (line, target
// as written, backticks stripped): `dangling` -> exactly one `fragments-resolve` finding at that
// line naming it; `resolves` and `skipped` -> none. The matching rules are pinned below it.
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

import { checkDocuments } from "../../src/checker.js";
import { citationResolves, closest, documentFacts, foldTokens, isSectionId, sectionReferences, targetHeadings, type ReferenceContext } from "../../src/engine/facts.js";
import { writeTerm } from "../../src/engine/terms.js";
import { segmentMarkdown } from "../../src/segments.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
// The fixture and frozen, headings-only copies of the documents it cites, so the labels do not move
// when a live heading does. Inside the temporary repository the fixture keeps the path it was
// labelled at (its links climb four directories to the repository root).
const SOURCE = "doc-verify/tests/references/fragment-fixture";
const FIXTURES = "worklog/kernel-trials/probe/fragment-fixtures";
const FIXTURE = `${FIXTURES}/fixture.md`;

type Label = [number, string];
interface Labels { fixture: { resolves: Label[]; dangling: Label[]; skipped: Label[] } }

/** A repository holding the fixture and every document it cites, the fixture selected as a design. */
async function fixtureRepository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "doc-verify-fragments-"));
  const targets = path.join(REPO, SOURCE, "targets");
  const cited = (await readdir(targets, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(targets, path.join(entry.parentPath, entry.name)));
  const copies: Array<[string, string]> = [
    [path.join(SOURCE, "fixture.md"), FIXTURE],
    [path.join(SOURCE, "dup-target.md"), `${FIXTURES}/dup-target.md`],
    ...cited.map((file): [string, string] => [path.join(SOURCE, "targets", file), file]),
  ];
  for (const [from, to] of copies) {
    await mkdir(path.dirname(path.join(root, to)), { recursive: true });
    await copyFile(path.join(REPO, from), path.join(root, to));
  }
  await writeFile(path.join(root, ".doc-verify.yaml"), `schema_version: 1
kind: document-verification
documents:
  - pattern: ${FIXTURE}
    artifact_kind: design
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
  execFileSync("git", ["add", "-A"], { cwd: root, stdio: "ignore" });
  return root;
}

const strip = (text: string): string => text.replaceAll("`", "");
const targetOf = (message: string): string => strip(/ cites (.*), which names no section of that document$/.exec(message)?.[1] ?? message);

describe("round 11: the fragment fixture against its labels", () => {
  it("finds every dangling reference at its line and nothing on a resolving or skipped one", async () => {
    const labels = YAML.parse(await readFile(path.join(REPO, SOURCE, "labels.yaml"), "utf8")) as Labels;
    const root = await fixtureRepository();
    const report = await checkDocuments({ root, mode: { kind: "all" }, profile: "draft" });
    const artifact = report.artifacts[0];
    expect(artifact?.path).toBe(FIXTURE);
    const findings = (artifact?.findings ?? []).filter((finding) => finding.ruleId === "module.fragments-resolve")
      .map((finding) => ({ line: finding.line, target: targetOf(finding.message), claimed: false }));
    const outcomes: string[] = [];
    for (const kind of ["dangling", "resolves", "skipped"] as const) {
      for (const [line, target] of labels.fixture[kind]) {
        const hits = findings.filter((finding) => finding.line === line
          && (finding.target === strip(target) || finding.target.startsWith(`${strip(target)} `)));
        hits.forEach((hit) => { hit.claimed = true; });
        const want = kind === "dangling" ? 1 : 0;
        if (hits.length !== want) {
          outcomes.push(`${kind} ${String(line)} ${target}: ${String(hits.length)} findings`);
        }
      }
    }
    for (const finding of findings.filter((item) => !item.claimed)) {
      outcomes.push(`unlabelled ${String(finding.line)} ${finding.target}`);
    }
    expect(outcomes).toEqual([]);
    // Every other reference finding is silent: the fixture's links all exist.
    expect((artifact?.findings ?? []).filter((finding) => finding.ruleId !== "module.fragments-resolve")).toEqual([]);
    const repair = artifact?.findings.find((finding) => finding.message.includes("#kernal"))?.repair;
    expect(repair).toContain("#kernel");
  });
});

describe("round 11: section reference rules", () => {
  const context = (files: Record<string, string>, extra: Partial<ReferenceContext> = {}): ReferenceContext => ({
    path: "docs/a.md",
    exists: (file) => file in files || Object.keys(files).some((name) => name.startsWith(`${file}/`)),
    files: Object.keys(files),
    readTarget: (file) => files[file],
    ...extra,
  });
  const refs = (markdown: string, files: Record<string, string>, extra: Partial<ReferenceContext> = {}): Array<[string, boolean]> =>
    sectionReferences(markdown, segmentMarkdown(markdown), context(files, extra)).map((reference) => [reference.target, reference.resolves]);
  const TARGET = "# T\n\n## Rule syntax\n\n## Notes\n\n### Notes\n\n```md\n## Fenced\n```\n\n## Where `U` comes from\n";

  it("slugs fragments document-globally: duplicates number -1, a code heading slugs its text, fences are not headings", () => {
    expect(targetHeadings(["Notes", "Usage", "Notes"]).map((heading) => heading.slug)).toEqual(["notes", "usage", "notes-1"]);
    const files = { "docs/t.md": TARGET };
    expect(refs("[a](t.md#notes-1) [b](t.md#notes-2) [c](t.md#where-u-comes-from) [d](t.md#fenced) [e](t.md#rule-syntax)", files)).toEqual([
      ["t.md#notes-1", true], ["t.md#notes-2", false], ["t.md#where-u-comes-from", true], ["t.md#fenced", false], ["t.md#rule-syntax", true],
    ]);
  });

  it("skips line anchors, non-.md targets, missing files and backticked paths; a bare #frag is the document itself", () => {
    const files = { "docs/t.md": TARGET, "docs/x.ts": "" };
    expect(refs("# A\n\n[a](t.md#L12) [b](t.md#L1-L2) [c](x.ts#foo) [d](gone.md#foo) `t.md#nope` [e](#a) [f](#b)", files)).toEqual([
      ["#a", true], ["#b", false],
    ]);
  });

  it("has no normalizeSectionId fallback: a segmenter id is not a GitHub slug", () => {
    const files = { "docs/t.md": "# T\n\n## Kernel\n\n### Kernel\n" };
    expect(refs("[a](t.md#t/kernel) [b](t.md#kernel-1)", files)).toEqual([["t.md#t/kernel", false], ["t.md#kernel-1", true]]);
  });

  it("does nothing without readTarget", () => {
    const markdown = "[a](t.md#nope) and design/05 §Nope.";
    expect(sectionReferences(markdown, segmentMarkdown(markdown), { path: "docs/a.md", exists: () => true })).toEqual([]);
    const facts = documentFacts({ path: "docs/a.md", markdown, exists: () => true }).facts.map(writeTerm);
    expect(facts.some((fact) => fact.includes("fragment") || fact.includes("section_ref"))).toBe(false);
  });

  it("binds a § to the nearest resolvable document before it in the same sentence", () => {
    const files = { "docs/t.md": TARGET, "docs/u.md": "# U\n\n## Other\n", "design/05-x.md": "# X\n\n## Oracle toolkit\n" };
    expect(refs("See t.md and `u.md` §Other, then design/05 §Oracle toolkit.", files)).toEqual([
      ["u.md §Other", true], ["design/05 §Oracle toolkit", true],
    ]);
    // a sentence ends at `. `, a blank line, a table cell and a list item; not at `:` or a newline
    expect(refs("See t.md. §Notes", files)).toEqual([]);
    expect(refs("See t.md\n\n§Notes", files)).toEqual([]);
    expect(refs("| t.md | §Notes |\n| --- | --- |", files)).toEqual([]);
    expect(refs("- t.md\n- §Notes", files)).toEqual([]);
    expect(refs("See t.md: §Notes", files)).toEqual([["t.md §Notes", true]]);
    expect(refs("See t.md\nand §Nope", files)).toEqual([["t.md §Nope", false]]);
    // `design 04` names nothing; `design/05-x.md` is a path, not the shorthand
    expect(refs("design 04 §Notes, design/055 §Notes", files)).toEqual([]);
  });

  it("checks no § inside a code span or fence, and none whose first token is an id or number", () => {
    const files = { "docs/t.md": TARGET };
    expect(refs("t.md `t.md §Nope` §Notes\n\n```\nt.md §Nope\n```\n\nt.md §3, §9.2, §C9, §C1-receipt.", files)).toEqual([["t.md §Notes", true]]);
    expect(["3", "9.2", "C9", "C1-receipt", "C10,"].every(isSectionId)).toBe(true);
    expect(["Rule", "Notes 3", "API"].some(isSectionId)).toBe(false);
  });

  it("matches a heading prefix of the text, or the text before its first punctuation as a heading prefix", () => {
    const headings = targetHeadings(["Rule syntax", "Experiment programmes and the redesign loop", "Report contract"]);
    expect(citationResolves(headings, "Rule syntax and more words", "Rule syntax and more words")).toBe(true);
    expect(citationResolves(headings, "Experiment programmes.", "Experiment programmes")).toBe(true);
    expect(citationResolves(headings, "Rule", "Rule")).toBe(true); // accepted laxness
    expect(citationResolves(headings, "Reporting contract", "Reporting contract")).toBe(false);
    expect(citationResolves(headings, "Experiments loop", "Experiments loop")).toBe(false);
    expect(foldTokens("Where `U` comes-from!")).toEqual(["where", "u", "comes", "from"]);
  });

  it("names up to three closest headings by string distance", () => {
    expect(closest("kernal", ["kernel", "facts", "kernels", "model"])).toEqual(["kernel", "kernels", "model"]);
  });

  it("emits ref, section_ref and dangling facts for a miss", () => {
    const files = { "docs/t.md": TARGET };
    const markdown = "# A\n\n[x](t.md#nope)\n";
    const facts = documentFacts({ markdown, ...context(files) }).facts.map(writeTerm);
    expect(facts).toContain("'core::ref'('docs/a.md',a,'t.md#nope',fragment)");
    expect(facts).toContain("'core::dangling'('docs/a.md',a,'t.md#nope',fragment)");
    expect(facts.find((fact) => fact.startsWith("'core::section_ref'"))).toMatch(/^'core::section_ref'\('docs\/a\.md',a,'t\.md#nope',3,'#notes, /);
  });
});
