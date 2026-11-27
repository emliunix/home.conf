/**
 * The module-docs gate (design/13 §Verification design) on this repository's own module
 * documents, and each clause seen failing on a seeded defect.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkModuleDocs, type ReadDoc } from "./module-docs.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");

const disk: ReadDoc = (rel) => {
  const p = path.join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : undefined;
};

/** The repository's documents with one document rewritten. */
function seeded(rel: string, edit: (text: string) => string): ReadDoc {
  return (r) => {
    const text = disk(r);
    if (r !== rel || text === undefined) return text;
    const out = edit(text);
    if (out === text) throw new Error(`seed did not change ${rel}`);
    return out;
  };
}

/** Replace the first table row whose first cell is `cell`. */
function editRow(cell: string, edit: (cells: string[]) => string[]) {
  return (text: string) =>
    text
      .split("\n")
      .map((line) => {
        const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
        return line.trim().startsWith("|") && cells[0] === cell ? `| ${edit(cells).join(" | ")} |` : line;
      })
      .join("\n");
}

const clauses = (read: ReadDoc) => checkModuleDocs(ROOT, read).map((v) => /clause (\d)/.exec(v)?.[1]);

describe("module-docs gate", () => {
  it("holds on this repository's module documents", () => {
    expect(checkModuleDocs(ROOT)).toEqual([]);
  });

  it("clause 1: a Module path that is missing or a directory", () => {
    const missing = seeded("docs/modules/report/contract.md", editRow("`doc-verify/src/report.ts`", ([, ...rest]) => ["`doc-verify/src/no-such.ts`", ...rest]));
    expect(clauses(missing)).toContain("1");
    const dir = seeded("docs/modules/report/contract.md", editRow("`doc-verify/src/report.ts`", ([, ...rest]) => ["`doc-verify/src/engine`", ...rest]));
    expect(clauses(dir)).toContain("1");
  });

  it("clause 2: an export the file does not have, and an exporting file marked an entry point", () => {
    const main = seeded("docs/modules/report/contract.md", editRow("`doc-verify/src/cli.ts`", ([m, , ...rest]) => [m as string, "`main`", ...rest]));
    expect(checkModuleDocs(ROOT, main).join("\n")).toMatch(/clause 2: doc-verify\/src\/cli\.ts does not export main/);
    const entry = seeded("docs/modules/report/contract.md", editRow("`doc-verify/src/report.ts`", ([m, , ...rest]) => [m as string, "none (entry point)", ...rest]));
    expect(clauses(entry)).toContain("2");
  });

  it("clause 2 resolves aliases: constraintReports is a re-export alias, not a missing export", () => {
    const alias = seeded("docs/modules/report/contract.md", editRow("`doc-verify/src/engine/diagnostics.ts`", ([m, e, ...rest]) => [m as string, `${e as string}, \`constraintReports\``, ...rest]));
    expect(checkModuleDocs(ROOT, alias)).toEqual([]);
  });

  it("clause 3: a claimed id with no row, and a row for an id not claimed", () => {
    const dropped = seeded("docs/modules/report/verification.md", (t) => t.split("\n").filter((l) => !l.startsWith("| P-report-01 ")).join("\n"));
    expect(clauses(dropped)).toContain("3");
    const orphan = seeded("docs/modules/report/verification.md", editRow("P-report-01", ([, ...rest]) => ["P-report-99", ...rest]));
    expect(clauses(orphan)).toContain("3");
  });

  it("clause 4: a Check path that does not exist", () => {
    const gone = seeded("docs/modules/report/verification.md", editRow("P-report-01", ([id, , limit]) => [id as string, "`doc-verify/tests/report/no-such.test.ts`", limit as string]));
    expect(clauses(gone)).toContain("4");
  });

  it("clause 5: a subprocess test labelled unit", () => {
    const wrong = seeded("docs/modules/report/verification.md", editRow("P-report-04", ([id, check, limit]) => [id as string, check as string, (limit as string).replace(/^subprocess;/, "unit;")]));
    expect(clauses(wrong)).toContain("5");
  });

  it("clause 6: a bare Module name, a Limit with no tier, and a Check path that is not a test", () => {
    const bare = seeded("docs/modules/report/contract.md", editRow("`doc-verify/src/report.ts`", ([, ...rest]) => ["`report`", ...rest]));
    expect(clauses(bare)).toContain("6");
    const noTier = seeded("docs/modules/report/verification.md", editRow("P-report-01", ([id, check, limit]) => [id as string, check as string, (limit as string).replace(/^[a-z-]+; /, "")]));
    expect(clauses(noTier)).toContain("6");
    const notTest = seeded("docs/modules/report/verification.md", editRow("P-report-01", ([id, , limit]) => [id as string, "`doc-verify/src/report.ts`", limit as string]));
    expect(clauses(notTest)).toContain("6");
  });
});
