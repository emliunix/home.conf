/**
 * Kernel-trials round 12 (design/07 §Model): the neutral table facts `core.header_pos/4` and
 * `core.cell_text/4`, and the spine relations `core.path/4`, `core.cell_path/5` and
 * `core.section_keyed/3` as dedicated literal kinds (checker, translator, core.pl, sandbox).
 */

import { describe, expect, it } from "vitest";

import { compileModule, runProgram } from "../../src/engine/index.js";
import { documentFacts } from "../../src/engine/facts.js";
import { ModuleError } from "../../src/engine/module.js";
import { Kernel, translateProgram, type FactTerm } from "../../src/kernel/index.js";
import { scriptedJudge } from "../engine-helpers.js";

const DOC_PATH = "goals/09-spine.md";

/** Holds `### R1` and `### R10` (the prefix seed), and two same-text siblings `### Log`. */
const DOC = [
  "# Spine fixture - OPEN",
  "",
  "## Requirements",
  "",
  "### R1 - First thing",
  "",
  "The first requirement.",
  "",
  "### R10 - Tenth thing",
  "",
  "The tenth requirement.",
  "",
  "## AC coverage",
  "",
  "| Requirement | Design | Evidence |",
  "| --- | --- | --- |",
  "| R1 | design/01 | the run printed ok |",
  "| R10 | design/10 | |",
  "",
  "## Notes",
  "",
  "### Log",
  "",
  "| Key | Evidence |",
  "| --- | --- |",
  "| a | x |",
  "",
  "### Log",
  "",
  "| Key | Evidence |",
  "| --- | --- |",
  "| b | y |",
  "",
].join("\n");

const MINIMAL = `schema_version: 2
kind: verification-module
module: spine
constraints:
  any:
    forall: core.section(D, S, _)
    require: core.heading(D, S, _)
    severity: error
`;

async function kernelOver(markdown: string): Promise<Kernel> {
  const facts = documentFacts({ path: DOC_PATH, markdown }).facts as FactTerm[];
  const kernel = await Kernel.create();
  await kernel.load(translateProgram(await compileModule(MINIMAL), facts), { sandbox: true });
  return kernel;
}

/** Every solution of a goal, printed canonically (~k: `table` is a prefix operator in SWI). */
const all = (kernel: Kernel, template: string, goal: string): string => kernel.q(`findall(${template}, (${goal}), R)`, "~k");

const D = `'${DOC_PATH}'`;

describe("core.header_pos/4 and core.cell_text/4", () => {
  it("emit a header's position and every cell's text, empty cells included", async () => {
    const kernel = await kernelOver(DOC);
    expect(all(kernel, "h(N,C)", `core_header_pos(${D}, 'ac-coverage#table1', C, N)`)).toBe("[h(1,'Requirement'),h(2,'Design'),h(3,'Evidence')]");
    expect(all(kernel, "c(C,X)", `core_cell_text(${D}, 'ac-coverage#row2', C, X)`)).toBe("[c('Requirement','R10'),c('Design','design/10'),c('Evidence','')]");
    expect(all(kernel, "C", `core_cell(${D}, 'ac-coverage#row2', C)`)).toBe("['Requirement','Design']");
  });
});

describe("core.cell_path/5", () => {
  it("gives the steps from the root down in a fixed order, whatever the order of Kinds", async () => {
    const kernel = await kernelOver(DOC);
    expect(all(kernel, "P", `core_cell_path(${D}, 'ac-coverage#row1', 'Evidence', [column, row_key('Requirement'), table, heading, title], P)`))
      .toBe("[[title('Spine fixture - OPEN'),heading(2,'AC coverage'),table(['Requirement','Design','Evidence']),row('R1'),column('Evidence')]]");
  });

  it("keeps only the kinds listed", async () => {
    const kernel = await kernelOver(DOC);
    expect(all(kernel, "P", `core_cell_path(${D}, 'ac-coverage#row2', 'Evidence', [heading, column], P)`))
      .toBe("[[heading(2,'AC coverage'),column('Evidence')]]");
  });

  it("has no path when the row_key column is not a header of the row's table", async () => {
    const kernel = await kernelOver(DOC);
    expect(all(kernel, "P", `core_cell_path(${D}, 'ac-coverage#row1', 'Evidence', [row_key('Row'), column], P)`)).toBe("[]");
    expect(all(kernel, "P", `core_cell_path(${D}, 'ac-coverage#row1', 'Nope', [column], P)`)).toBe("[]");
  });

  it("indexes same-text siblings by their place, so the two Log tables never share a path", async () => {
    const kernel = await kernelOver(DOC);
    const first = all(kernel, "P", `core_row(${D}, T, R), core_cell_text(${D}, R, 'Key', a), core_cell_path(${D}, R, 'Evidence', [title, heading, row_key('Key')], P)`);
    const second = all(kernel, "P", `core_row(${D}, T, R), core_cell_text(${D}, R, 'Key', b), core_cell_path(${D}, R, 'Evidence', [title, heading, row_key('Key')], P)`);
    expect(first).toBe("[[title('Spine fixture - OPEN'),heading(2,'Notes'),heading(3,'Log',1),row(a)]]");
    expect(second).toBe("[[title('Spine fixture - OPEN'),heading(2,'Notes'),heading(3,'Log',2),row(b)]]");
  });

  it("rejects a call whose inputs are unbound (the checker's safety rule, enforced again in the kernel)", async () => {
    const kernel = await kernelOver(DOC);
    expect(() => kernel.q(`core_cell_path(${D}, _, 'Evidence', [column], R)`)).toThrow(/core_rejected\(unbound_path/);
  });
});

describe("core.path/4", () => {
  it("includes the subject's own heading and gives the depth-1 heading as the title", async () => {
    const kernel = await kernelOver(DOC);
    const sections = documentFacts({ path: DOC_PATH, markdown: DOC }).sections;
    const r10 = sections.find((section) => section.heading.startsWith("R10"))?.id as string;
    expect(all(kernel, "P", `core_path(${D}, '${r10}', [title, heading], P)`))
      .toBe("[[title('Spine fixture - OPEN'),heading(2,'Requirements'),heading(3,'R10 - Tenth thing')]]");
    expect(all(kernel, "P", `core_path(${D}, '${r10}', [heading], P)`)).toBe("[[heading(2,'Requirements'),heading(3,'R10 - Tenth thing')]]");
  });
});

describe("core.section_keyed/3", () => {
  it("matches the first token of the heading exactly: R1 does not find R10", async () => {
    const kernel = await kernelOver(DOC);
    const headings = all(kernel, "H", `core_section_keyed(${D}, 'R1', S), core_heading(${D}, S, H)`);
    expect(headings).toBe("['R1 - First thing']");
    expect(all(kernel, "H", `core_section_keyed(${D}, 'R10', S), core_heading(${D}, S, H)`)).toBe("['R10 - Tenth thing']");
    expect(all(kernel, "S", `core_section_keyed(${D}, 'R', S)`)).toBe("[]");
  });

  it("reads a token up to punctuation or layout", async () => {
    const kernel = await kernelOver("# T\n\n## R2: Second\n\nx\n\n## A7. Seventh\n\ny\n");
    expect(all(kernel, "H", `core_section_keyed(${D}, 'R2', S), core_heading(${D}, S, H)`)).toBe("['R2: Second']");
    expect(all(kernel, "H", `core_section_keyed(${D}, 'A7', S), core_heading(${D}, S, H)`)).toBe("['A7. Seventh']");
  });
});

describe("the spine relations in a module", () => {
  const MODULE = `schema_version: 2
kind: verification-module
module: spine
params:
  key_headers: ['Requirement', 'Row']
rules:
  key_col(D, T, K): core.header(D, T, K), K in $key_headers
  claim(D, R, S): core.row(D, T, R), key_col(D, T, K), core.cell_text(D, R, K, Key), core.section_keyed(D, Key, S)
constraints:
  every-row-has-a-claim:
    forall: core.row(D, T, R), key_col(D, T, K), core.cell_path(D, R, 'Evidence', [heading, row_key(K), column], P)
    require: claim(D, R, S), core.path(D, S, [heading], Q)
    severity: error
`;

  it("evaluates through the checker, the translator and the sandboxed kernel", async () => {
    const report = await runProgram({ moduleYaml: MODULE, documents: [{ path: DOC_PATH, markdown: DOC }], backend: scriptedJudge(() => ({ value: "holds" })).backend, model: "jev-test", policy: { maxEvidenceBytes: 20_000, forbiddenLiterals: [] } });
    const bindings = report.constraints[0]?.bindings ?? [];
    expect(bindings.map((binding) => [binding.values.R, binding.status])).toEqual([["ac-coverage#row1", "satisfied"], ["ac-coverage#row2", "satisfied"]]);
    expect(bindings[0]?.values.P).toContain("row(R1)");
    const proofText = JSON.stringify(bindings[0]?.proof);
    expect(proofText).toContain("core.cell_path(");
    expect(proofText).toContain("core.section_keyed(");
  });

  it("refuses a kind outside the relation's steps, a repeated kind, and an unbound input", async () => {
    const bad = (body: string) => compileModule(`schema_version: 2
kind: verification-module
module: spine
constraints:
  c:
    forall: ${body}
    require: core.row(D, T, R)
    severity: error
`);
    await expect(bad("core.row(D, T, R), core.path(D, R, [column], P)")).rejects.toThrow(/column is not a step kind of core.path/);
    await expect(bad("core.row(D, T, R), core.cell_path(D, R, 'Evidence', [heading, heading], P)")).rejects.toThrow(/lists the kind heading twice/);
    await expect(bad("core.row(D, T, R), core.cell_path(D, R, C, [heading], P)")).rejects.toThrow(/C is unsafe/);
    await expect(bad("core.row(D, T, R), core.cell_path(D, R, 'Evidence', [row_key(K)], P)")).rejects.toThrow(/K is unsafe/);
    await expect(bad("core.row(D, T, R), core.section_keyed(D, K, S)")).rejects.toThrow(ModuleError);
  });
});
