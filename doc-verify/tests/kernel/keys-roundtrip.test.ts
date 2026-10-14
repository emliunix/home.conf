/**
 * An oracle atom whose input holds heading text must be written alike by the kernel's
 * `core_atom_key/2` and the host's `oracleAtomKey`, or an answered atom is routed nowhere and
 * shows `unasked`. Compared over Unicode, tab, backslash, quote, backtick, NBSP and a
 * 500-character heading; a mismatch prints the pair.
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
  it("over every awkward heading, inside a compound list and as a bare argument", async () => {
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

  it("an answered atom over such headings is never reported unasked", async () => {
    const markdown = ["# Keys fixture", "", ...HEADINGS.flatMap((text) => [`## ${text}`, "", "Body text.", ""])].join("\n");
    const moduleYaml = `schema_version: 2
kind: verification-module
module: keys
oracles:
  titled(D, S, H):
    ask: Is this section titled {H}?
    evidence: core.own(D, S)
rules:
  sub(D, S, H): core.heading(D, S, H), core.depth(D, S, 2)
constraints:
  c:
    forall: sub(D, S, H)
    require: titled(D, S, H)
    severity: error
`;
    const judge = scriptedJudge(() => ({ value: "holds" }));
    const report = await runProgram({ moduleYaml, documents: [{ path: "goals/01.md", markdown }], backend: judge.backend, model: "jev-test", policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] } });
    const bindings = report.constraints[0]?.bindings ?? [];
    expect(bindings).toHaveLength(HEADINGS.length);
    const unasked = JSON.stringify(bindings.map((b) => b.proof)).match(/"kind":"unasked"/g) ?? [];
    expect(unasked).toHaveLength(0);
    expect(bindings.filter((b) => b.status !== "satisfied").map((b) => b.values.H)).toEqual([]);
    expect(report.findings).toEqual([]);
  });
});
