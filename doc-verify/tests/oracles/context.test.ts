/**
 * Kernel-trials round 12 (design/07 §Model; design-07 review B1, S1, N1-N3): the oracle field
 * `context:`. Its "Where:" block is rendered apart from the evidence, one step per line; the
 * outbound policy scans it; its bytes count toward `max_bytes`; it is part of the cache key; and
 * the echo rule refuses a row-keyed context on a `choose` oracle (static) and does not ask an atom
 * whose label the context spells out (run time).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { compileModule, memoryOracleCache, runProgram, type OracleCache } from "../../src/engine/index.js";
import { scriptedJudge, type SeenQuestion, type ScriptedAnswer } from "../engine-helpers.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const DOC_PATH = "goals/09-context.md";

const doc = (coverage = "AC coverage", notes: [string, string] = ["x ran and printed ok", "y ran and printed ok"]) => [
  "# Context fixture - OPEN",
  "",
  `## ${coverage}`,
  "",
  "| Requirement | Evidence |",
  "| --- | --- |",
  "| R1 | the probe printed complete: true |",
  "",
  "## Notes",
  "",
  "### Log",
  "",
  "| Requirement | Evidence |",
  "| --- | --- |",
  `| N1 | ${notes[0]} |`,
  "",
  "### Log",
  "",
  "| Requirement | Evidence |",
  "| --- | --- |",
  `| N2 | ${notes[1]} |`,
  "",
].join("\n");

const MODULE = (extra = "") => `schema_version: 2
kind: verification-module
module: ctx
request_shape: per-atom
oracles:
  reasons(D, R, P, C):
    ask: Is this evidence cell a reasoning chain?
    evidence: core.cell(D, R, C)
    context: [P]
    threshold: 0.5
    max_bytes: 4000
${extra}rules:
  addressed(D, R, C, P): core.row(D, T, R), core.header_pos(D, T, C, _), core.cell_path(D, R, C, [title, heading, row_key('Requirement'), column], P)
constraints:
  evidence-reasons:
    forall: core.table(D, S, T), core.row(D, T, R)
    require: addressed(D, R, 'Evidence', P), reasons(D, R, P, 'Evidence')
    severity: error
`;

interface Entry { sections: string[]; text: string; context?: string }

function judge(decide: (question: SeenQuestion) => ScriptedAnswer = () => ({ value: "holds" })) {
  const scripted = scriptedJudge(decide);
  const entries = (): Entry[] => scripted.requests.flatMap((request) => Object.values((request.state as unknown as { evidence: Record<string, Entry> }).evidence));
  return { ...scripted, entries };
}

const check = (moduleYaml: string, backend: Parameters<typeof runProgram>[0]["backend"], markdown: string, extra: { cache?: OracleCache; forbidden?: string[] } = {}) =>
  runProgram({
    moduleYaml, documents: [{ path: DOC_PATH, markdown }], backend, model: "jev-test",
    policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: extra.forbidden ?? [] },
    ...(extra.cache === undefined ? {} : { cache: extra.cache }),
  });

describe("context: the Where: block", () => {
  it("is rendered apart from the evidence, one indented line per step", async () => {
    const j = judge();
    const report = await check(MODULE(), j.backend, doc());
    expect(report.verdict).toBe("PASS");
    const entry = j.entries().find((e) => e.text.includes("complete: true")) as Entry;
    expect(entry.text).toBe("the probe printed complete: true");
    expect(entry.text).not.toContain("Where:");
    expect(entry.context).toBe("Where:\n  title: Context fixture - OPEN\n  heading 2: AC coverage\n  row: R1\n  column: Evidence");
    const leaf = report.oracles.find((l) => l.atom.includes("ac-coverage#row1"));
    expect(leaf?.contextBytes).toBe(Buffer.byteLength(entry.context as string));
    expect(leaf?.bytes).toBe(Buffer.byteLength(entry.text) + (leaf?.contextBytes ?? 0));
  });

  it("names a same-text sibling by its occurrence", async () => {
    const j = judge();
    await check(MODULE(), j.backend, doc());
    const contexts = j.entries().map((e) => e.context ?? "").filter((c) => c.includes("Log"));
    expect(contexts).toEqual(expect.arrayContaining([expect.stringContaining("heading 3: Log (occurrence 1)\n  row: N1"), expect.stringContaining("heading 3: Log (occurrence 2)\n  row: N2")]));
  });

  it("is scanned by the outbound policy: a heading holding a home path never reaches the judge", async () => {
    const j = judge();
    const report = await check(MODULE(), j.backend, doc("Coverage of /Users/someone/notes"));
    expect(report.verdict).toBe("NO-GO");
    expect(report.failure?.message).toMatch(/prohibited data/);
    expect(j.requests.every((request) => !JSON.stringify(request.state).toLowerCase().includes("/users/"))).toBe(true);
  });

  it("counts toward max_bytes", async () => {
    const tight = MODULE().replace("max_bytes: 4000", `max_bytes: ${String(Buffer.byteLength("the probe printed complete: true") + 10)}`);
    const report = await check(tight, judge().backend, doc());
    expect(report.verdict).toBe("BLOCKED");
    expect(report.failure?.message).toMatch(/with its context, above max_bytes/);
  });

  it("is part of the cache key: an ancestor heading edit re-asks, an unchanged document does not", async () => {
    const cache = memoryOracleCache();
    const first = judge();
    await check(MODULE(), first.backend, doc(), { cache });
    expect(first.requests.length).toBe(3);
    const again = judge();
    await check(MODULE(), again.backend, doc(), { cache });
    expect(again.requests.length).toBe(0);
    const edited = judge();
    const report = await check(MODULE(), edited.backend, doc("AC coverage matrix"), { cache });
    expect(edited.requests.length).toBe(1);
    expect(report.oracles.find((l) => l.atom.includes("ac-coverage-matrix#row1"))?.cacheHit).toBe(false);
  });

  it("keeps same-text siblings apart when they are swapped: no answer crosses", async () => {
    const byText = (q: SeenQuestion): ScriptedAnswer => ({ value: q.text.startsWith("x") ? "holds" : "fails" });
    const cache = memoryOracleCache();
    const first = await check(MODULE(), judge(byText).backend, doc(), { cache });
    const swapped = await check(MODULE(), judge(byText).backend, doc("AC coverage", ["y ran and printed ok", "x ran and printed ok"]), { cache });
    const label = (report: typeof first, row: string) => report.oracles.find((l) => l.atom.includes(`${row},`))?.label;
    expect([label(first, "notes/log#row1"), label(first, "notes/log-1#row1")]).toEqual(["holds", "fails"]);
    expect([label(swapped, "notes/log#row1"), label(swapped, "notes/log-1#row1")]).toEqual(["fails", "holds"]);
  });
});

describe("the echo rule", () => {
  const CHOOSE = `schema_version: 2
kind: verification-module
module: echo
oracles:
  which(D, R, C, P, L):
    choose: [r1, r2]
    ask: Which requirement does this evidence argue?
    evidence: core.cell(D, R, C)
    context: [P]
EXTRA
rules:
  addressed(D, R, C, P): core.row(D, T, R), core.header_pos(D, T, C, _), core.cell_path(D, R, C, [heading, row_key('Requirement')], P)
constraints:
  c:
    forall: core.row(D, T, R)
    require: addressed(D, R, 'Evidence', P), which(D, R, 'Evidence', P, L), L in [r1]
    severity: error
`;

  it("refuses a choose oracle whose context holds a row key, unless context_may_echo", async () => {
    await expect(compileModule(CHOOSE.replace("EXTRA\n", ""))).rejects.toThrow(/context: P is bound by a core.cell_path with a row_key step/);
    await expect(compileModule(CHOOSE.replace("EXTRA", "    context_may_echo: true"))).resolves.toBeDefined();
  });

  it("refuses round 9's E1 module rewritten with a row_key step", async () => {
    const e1 = readFileSync(path.join(REPO, "worklog/kernel-trials/probe/oracle-fixtures/witness_property_choose/real-02.yaml"), "utf8")
      .replace(/^extends:.*\n/m, "")
      .replace("witness_property_choose(D, R, C, L):", "witness_property_choose(D, R, C, P, L):")
      .replace("    evidence: core.row_with_column(D, R, C)", "    evidence: core.row_with_column(D, R, C)\n    context: [P]")
      .replace("rules:\n", "rules:\n  addressed(D, R, C, P): core.row(D, T, R), core.header_pos(D, T, C, _), core.cell_path(D, R, C, [heading, row_key('Property'), column], P)\n  top(D, S): core.section(D, S, _)\n")
      .replace("require: core.cell(D, R, C), witness_property_choose(D, R, C, P),", "require: core.cell(D, R, C), addressed(D, R, C, A), witness_property_choose(D, R, C, A, P),");
    expect(e1).toContain("context: [P]");
    expect(e1).toContain("addressed(D, R, C, A), witness_property_choose(D, R, C, A, P)");
    await expect(compileModule(e1)).rejects.toThrow(/row_key step/);
  });

  it("does not ask an atom whose label the context spells out", async () => {
    const j = judge(() => ({ value: "r1" }));
    const markdown = "# T\n\n## Coverage\n\n| Requirement | Evidence |\n| --- | --- |\n| R1 | ran ok |\n| R3 | ran too |\n";
    const report = await check(CHOOSE.replace("EXTRA", "    context_may_echo: true"), j.backend, markdown);
    const echoed = report.oracles.find((l) => l.atom.includes("coverage#row1"));
    expect(echoed).toMatchObject({ key: "-", label: "unknown", finding: "echo: label r1 appears in context" });
    expect(report.oracles.find((l) => l.atom.includes("coverage#row2"))?.label).toBe("r1");
    expect(j.requests.length).toBe(1);
  });
});
