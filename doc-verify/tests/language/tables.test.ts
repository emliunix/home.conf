// Table facts (added 2026-10-13, owner direction on goal evidence cells): `core.row/3`,
// `core.cell/3`, and the `core.cell(D, R, C)` evidence form that asks a judge one question per
// cell. Deterministic facts first; then a scripted judge shows the constraint binds per row.
import { describe, expect, it } from "vitest";

import { cellEvidence, cellsEvidence, columnEvidence, documentFacts, documentTables, splitCells } from "../../src/engine/facts.js";
import { runProgram } from "../../src/engine/index.js";
import { writeTerm } from "../../src/engine/terms.js";
import { segmentMarkdown } from "../../src/segments.js";
import { DOC_PATH, moduleText, scriptedJudge } from "../engine-helpers.js";

const DOC = [
  "---",
  "title: t",
  "---",
  "# Goal - OPEN",
  "",
  "Intro | with a pipe but no table.",
  "",
  "## AC coverage",
  "",
  "| Requirement | Design | Evidence |",
  "| --- | --- | --- |",
  "| R1 | design/05 | Ran `probe/run.mjs`; 24/24 witnesses pass, so the kernel matches the model. |",
  "| R2 | design/05 | done, works |",
  "| R3 | design/05 | |",
  "| R4 | a \\| b | `x.md` holds a \\| in code: `a|b`. Conclusion: fine. |",
  "",
  "```",
  "| H | E |",
  "| --- | --- |",
  "| fenced | not a row |",
  "```",
  "",
  "### Notes",
  "",
  "| H |",
  "| --- |",
  "| one column |",
  "",
].join("\n");

describe("table facts", () => {
  it("splits cells on unescaped pipes outside code spans", () => {
    expect(splitCells("| a | b \\| c | `d|e` |")).toEqual(["a", "b | c", "`d|e`"]);
    expect(splitCells("a|b")).toEqual(["a", "b"]);
  });

  it("finds data rows by innermost section, skipping fences and the front matter", () => {
    const { tables, rows } = documentTables(DOC, segmentMarkdown(DOC));
    expect([...tables.keys()]).toEqual(["ac-coverage#table1", "ac-coverage/notes#table1"]);
    expect(tables.get("ac-coverage#table1")).toEqual({ id: "ac-coverage#table1", section: "ac-coverage", line: 10, headers: ["Requirement", "Design", "Evidence"] });
    expect([...rows.keys()]).toEqual(["ac-coverage#row1", "ac-coverage#row2", "ac-coverage#row3", "ac-coverage#row4", "ac-coverage/notes#row1"]);
    expect(rows.get("ac-coverage/notes#row1")?.table).toBe("ac-coverage/notes#table1");
    const row4 = rows.get("ac-coverage#row4");
    expect(row4?.line).toBe(15);
    expect(row4?.cells.get("Design")).toBe("a | b");
    expect(row4?.cells.get("Evidence")).toBe("`x.md` holds a | in code: `a|b`. Conclusion: fine.");
  });

  it("emits row/3 for every data row and cell/3 only for non-empty cells", () => {
    const facts = documentFacts({ path: "goals/04.md", markdown: DOC });
    const written = facts.facts.map(writeTerm);
    expect(written).toContain("'core::table'('goals/04.md','ac-coverage','ac-coverage#table1')");
    expect(written).toContain("'core::header_pos'('goals/04.md','ac-coverage#table1','Evidence',3)");
    expect(written.some((fact) => fact.startsWith("'core::header'("))).toBe(false);
    expect(written).toContain("'core::row'('goals/04.md','ac-coverage#table1','ac-coverage#row1')");
    expect(written).toContain("'core::cell'('goals/04.md','ac-coverage#row1','Evidence')");
    expect(written).toContain("'core::cell'('goals/04.md','ac-coverage#row3','Requirement')");
    expect(written).not.toContain("'core::cell'('goals/04.md','ac-coverage#row3','Evidence')");
    expect(written.filter((fact) => fact.startsWith("'core::row'"))).toHaveLength(5);
  });

  it("resolves cell evidence to the cell's text at the row's line, and to nothing for an empty or absent cell", () => {
    const facts = documentFacts({ path: "goals/04.md", markdown: DOC });
    const evidence = cellEvidence(facts, "ac-coverage#row2", "Evidence");
    expect(evidence).toEqual({ sections: ["ac-coverage"], text: "done, works", pieces: [{ id: "ac-coverage#row2", startLine: 13, offset: 0, text: "done, works" }] });
    expect(cellEvidence(facts, "ac-coverage#row3", "Evidence")).toBeUndefined();
    expect(cellEvidence(facts, "ac-coverage#row9", "Evidence")).toBeUndefined();
    expect(cellEvidence(facts, "ac-coverage#row1", "Nope")).toBeUndefined();
  });

  it("matches the header text exactly, so a differently spelt column is a different column", () => {
    const facts = documentFacts({ path: "goals/04.md", markdown: DOC });
    expect(cellEvidence(facts, "ac-coverage#row1", "evidence")).toBeUndefined();
    expect(cellEvidence(facts, "ac-coverage#row1", "Evidence ")).toBeUndefined();
  });

  it("yields no row for a heading with no table, a malformed table, or a table whose delimiter count differs", () => {
    const none = ["# T", "", "## AC coverage", "", "no table here", "", "| a | b |", "| --- |", "| 1 | 2 |", ""].join("\n");
    expect(documentTables(none, segmentMarkdown(none)).rows.size).toBe(0);
    expect(documentTables(none, segmentMarkdown(none)).tables.size).toBe(0);
  });

  it("renders a row's listed cells as one atom, each line headed by its column, dropping columns the row lacks", () => {
    const facts = documentFacts({ path: "goals/04.md", markdown: DOC });
    const evidence = cellsEvidence(facts, "ac-coverage#row2", ["Requirement", "Nope", "Evidence"]);
    expect(evidence).toEqual({ sections: ["ac-coverage"], text: "Requirement: R2\nEvidence: done, works\n", pieces: [{ id: "ac-coverage#row2", startLine: 13, offset: 0, text: "Requirement: R2\nEvidence: done, works\n" }] });
    expect(cellsEvidence(facts, "ac-coverage#row3", ["Evidence"])).toBeUndefined();
    expect(cellsEvidence(facts, "ac-coverage#row9", ["Evidence"])).toBeUndefined();
  });

  it("concatenates a section's column as evidence, one cell per line at its row's line", () => {
    const facts = documentFacts({ path: "goals/04.md", markdown: DOC });
    const evidence = columnEvidence(facts, "ac-coverage#table1", "Evidence");
    expect(evidence?.sections).toEqual(["ac-coverage"]);
    expect(evidence?.pieces.map((piece) => [piece.id, piece.startLine])).toEqual([["ac-coverage#row1", 12], ["ac-coverage#row2", 13], ["ac-coverage#row4", 15]]);
    expect(evidence?.text.split("\n")[1]).toBe("done, works");
    expect(columnEvidence(facts, "ac-coverage#table1", "Nope")).toBeUndefined();
    expect(columnEvidence(facts, "ac-coverage", "Evidence")).toBeUndefined();
  });
});

const MODULE = moduleText(`oracles:
  reasons(D, R, C):
    ask: Is this {C} cell a reasoning chain?
    evidence: core.cell(D, R, C)
    threshold: 0.5
rules:
  coverage(D, S): core.heading(D, S, 'AC coverage')
constraints:
  rows-reason:
    forall: coverage(D, S), core.table(D, S, T), core.header_pos(D, T, 'Evidence', _), core.row(D, T, R)
    require: core.cell(D, R, 'Evidence'), reasons(D, R, 'Evidence')
    severity: error
    message: "{R} is not a chain"
`);

describe("a per-cell oracle", () => {
  it("binds nothing, and so asks nothing, when the coverage table has no Evidence column (the population is the header's)", async () => {
    const noColumn = ["# T", "", "## AC coverage", "", "| Requirement | Proof |", "| --- | --- |", "| R1 | done |", ""].join("\n");
    const { backend, requests } = scriptedJudge(() => ({ value: "holds" }));
    const report = await runProgram({
      moduleYaml: MODULE, documents: [{ path: DOC_PATH, markdown: noColumn }], backend, model: "jev-test",
      policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
    });
    expect(requests).toHaveLength(0);
    const constraint = report.constraints.find((entry) => entry.id === "rows-reason");
    expect(constraint?.bindings).toHaveLength(0);
  });

  it("asks one question per non-empty cell and violates only the rows the judge fails or that are empty", async () => {
    const { backend, requests } = scriptedJudge((question) => ({ value: /\.\s*$|\.\s/.test(question.text) ? "holds" : "fails" }));
    const report = await runProgram({
      moduleYaml: MODULE, documents: [{ path: DOC_PATH, markdown: DOC }], backend, model: "jev-test",
      policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] },
    });
    const asked = requests.flatMap((request) => request.questions.map((question) => (typeof question.instruction === "string" ? question.instruction : "")));
    expect(asked.filter((text) => text.includes("Is this Evidence cell"))).toHaveLength(3);
    const constraint = report.constraints.find((entry) => entry.id === "rows-reason");
    const byRow: Record<string, string> = Object.fromEntries((constraint?.bindings ?? []).map((binding) => [String(binding.values.R), binding.status]));
    expect(byRow).toEqual({ "ac-coverage#row1": "satisfied", "ac-coverage#row2": "violated", "ac-coverage#row3": "violated", "ac-coverage#row4": "satisfied" });
    const leaf = report.oracles.find((entry) => entry.atom.includes("row2"));
    expect(leaf?.label).toBe("fails");
    expect(leaf?.sections).toEqual(["ac-coverage"]);
    expect(leaf?.span?.startLine).toBe(13);
  });
});

// The checker's finding placement with several atoms on one section (the staged-check defect of
// 2026-10-13): each row's finding must carry its own span, line and probability, not the first
// failing row's.
describe("per-row findings through the checker", () => {
  it("places each violated row's finding at its own line with its own deciding sentence", async () => {
    const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const { execFileSync } = await import("node:child_process");
    const { checkDocuments } = await import("../../src/checker.js");
    const root = await mkdtemp(path.join(tmpdir(), "doc-verify-rows-"));
    await mkdir(path.join(root, "goals"), { recursive: true });
    await writeFile(path.join(root, "goals/01-x.md"), [
      "# X - OPEN", "", "## Goal", "", "G.", "", "## User requirements - anchored root", "", "R1, R2, R3.", "",
      "## Design files", "", "none.", "", "## Workstreams", "", "W1.", "", "## AC coverage", "",
      "| Requirement | Design | Evidence |", "| --- | --- | --- |",
      "| R1 | d | Ran the suite; 9 of 9 pass, so R1 holds. |",
      "| R2 | d | done, works |",
      "| R3 | d | Read design 05; it names Z3. Covered. |",
      "", "## Worklog", "", "none.", "",
    ].join("\n"));
    await writeFile(path.join(root, ".doc-verify.yaml"), [
      "schema_version: 1", "kind: document-verification", "documents:",
      "  - pattern: goals/*.md", "    artifact_kind: goal", "    modules: [doc-verify:goal]", "    status_from: title",
      "invalidation_patterns: [.doc-verify.yaml]", "judge:", "  kind: jev", "  model: jev-test",
      "  client_sha256: ce983f8de97d5b30d527a7116f0c49ad3d17e098d2c3f17c9600041260c65dcb", "  attestation_max_age_seconds: 3600",
      "policy:", "  kind: semantic-boundary", "  version: 1", "  max_evidence_bytes: 20000", "  forbidden_literals: []", "",
    ].join("\n"));
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    const { backend } = scriptedJudge((question) => {
      if (question.options.includes("s0")) {
        return { value: "s0" }; // the span follow-up: the first sentence decides
      }
      if (!question.instruction.includes("evidence cell")) {
        return { value: "holds" };
      }
      // Fail the two cells that state no fact; give each its own probability so the report can be told apart.
      return question.text.includes("9 of 9") ? { value: "holds" } : { value: "fails", distribution: question.text.includes("done") ? [0.1, 0.9, 0] : [0.3, 0.7, 0] };
    });
    const report = await checkDocuments({ root, mode: { kind: "paths", paths: ["goals/01-x.md"] }, profile: "promotion", cache: "off", backend });
    const findings = (report.artifacts[0]?.findings ?? []).filter((finding) => finding.ruleId === "module.goal-evidence-reasons");
    expect(findings.map((finding) => [finding.line, finding.span?.quote, finding.basis?.find((line) => line.startsWith("answered"))?.slice(0, 21)])).toEqual([
      [24, "done, works", "answered fails (p=0.9"],
      [25, "Read design 05; it names Z3.", "answered fails (p=0.7"],
    ]);
  });
});
