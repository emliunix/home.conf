/**
 * Kernel-trials round 12 (design-07 review S2): an oracle atom whose input is a path holds heading
 * text, so the kernel's `core_atom_key/2` and the host's `oracleAtomKey` must write it alike, or an
 * answered atom is routed nowhere and shows `unasked`. Compared over Unicode, tab, backslash,
 * quote, backtick, NBSP and a 500-character heading; a mismatch prints the pair.
 */

import { describe, expect, it } from "vitest";

import { compileModule, oracleAtomKey, runProgram } from "../../src/engine/index.js";
import { atom, compound, list, number, writeTerm, type Term } from "../../src/engine/terms.js";
import { Kernel, translateProgram } from "../../src/kernel/index.js";
import { scriptedJudge } from "../engine-helpers.js";

const HEADINGS = [
  "été", "日本語", "αβγ", "Ünïcode — dash", "tab\there", "back\\slash", "it's quoted", "tick`s", "nb sp",
  "x".repeat(500), "lower_ok", "Upper", "two words", "\"double\"",
];

const MINIMAL = `schema_version: 2
kind: verification-module
module: keys
constraints:
  c:
    forall: core.section(D, S, _)
    require: core.heading(D, S, _)
    severity: error
`;

describe("kernel and host atom keys agree", () => {
  it("over every awkward heading, as a path step and as a bare argument", async () => {
    const kernel = await Kernel.create();
    await kernel.load(translateProgram(await compileModule(MINIMAL), []), { sandbox: true });
    const mismatches: string[] = [];
    for (const text of HEADINGS) {
      const inputs: Term[] = [atom("goals/01.md"), atom(`sec#row1`), list([compound("title", [atom(text)]), compound("heading", [number(2), atom(text), number(1)]), compound("row", [atom(text)])]), atom(text)];
      const host = oracleAtomKey("m::o", inputs);
      const goal = `core_atom_key('m::o'(${inputs.map(writeTerm).join(",")}), R)`;
      const kernelKey = kernel.q(goal, "~w");
      if (kernelKey !== host) mismatches.push(`host ${JSON.stringify(host)}\nkernel ${JSON.stringify(kernelKey)}`);
    }
    expect(mismatches.join("\n\n")).toBe("");
  });

  it("an answered atom over such paths is never reported unasked", async () => {
    const markdown = ["# Keys fixture", "", ...HEADINGS.flatMap((text, i) => [`## ${text}`, "", "| Requirement | Evidence |", "| --- | --- |", `| K${String(i)} | ran and printed ok |`, ""])].join("\n");
    const moduleYaml = `schema_version: 2
kind: verification-module
module: keys
request_shape: per-atom
oracles:
  reasons(D, R, P, C):
    ask: Is this a reasoning chain?
    evidence: core.cell(D, R, C)
    context: [P]
rules:
  addressed(D, R, C, P): core.row(D, T, R), core.header_pos(D, T, C, _), core.cell_path(D, R, C, [title, heading, row_key('Requirement'), column], P)
constraints:
  c:
    forall: core.row(D, T, R)
    require: addressed(D, R, 'Evidence', P), reasons(D, R, P, 'Evidence')
    severity: error
`;
    const judge = scriptedJudge(() => ({ value: "holds" }));
    const report = await runProgram({ moduleYaml, documents: [{ path: "goals/01.md", markdown }], backend: judge.backend, model: "jev-test", policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] } });
    const bindings = report.constraints[0]?.bindings ?? [];
    expect(bindings).toHaveLength(HEADINGS.length);
    const unasked = JSON.stringify(bindings.map((b) => b.proof)).match(/"kind":"unasked"/g) ?? [];
    expect(unasked).toHaveLength(0);
    expect(bindings.filter((b) => b.status !== "satisfied").map((b) => b.values.R)).toEqual([]);
    expect(report.findings).toEqual([]);
  });
});
