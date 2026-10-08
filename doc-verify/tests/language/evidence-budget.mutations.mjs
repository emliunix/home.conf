#!/usr/bin/env node
// The committed runner for `evidence-budget.mutations.md` (task #196).
//
// What it does: for each mutation below, copy the focused suite's inputs into a scratch tree, apply
// the single source edit, and require THE CASE THE ROW NAMES to redden. A mutation whose anchor is
// absent is reported BROKEN, a run with no readable report is HARNESS, and a run whose failures do
// not include the named case is WRONG-CASE -- none of the three is scored as a pass.
//
// ⚠⚠ WHY "WHICH CASE" AND NOT "DID ANYTHING FAIL". `references.mutations.mjs` recorded the lesson at
// cost (task #216): scoring `RED` on any non-zero exit made a mutation that reddened an UNRELATED
// case indistinguishable from one that reddened the named case, and two rows were silently false.
// This runner parses Vitest's JSON report and requires the row's own case name among the failures.
//
// ⚠⚠ M1 MUTATES THE FIXTURE'S CAP CONSTANT, NOT THE ENGINE, and that is deliberate. Rows 2 and 3
// show the ENGINE enforces the cap; M1 shows the UNDER-CAP case is actually sensitive to the cap's
// VALUE rather than passing for some unrelated reason -- which is the failure mode a `toBeUndefined()`
// assertion invites. The two directions are different claims and need different mutations.
//
// Usage: node doc-verify/tests/language/evidence-budget.mutations.mjs

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root, derived from this file's location -- never a hard-coded host path. */
const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const FOCUSED = "doc-verify/tests/language/evidence-budget.test.ts";
/** The one status that counts as evidence in this table. */
const SCORED = "RED";
/** Copied into the scratch tree so the focused suite can run without the rest of the repository. */
const NEEDED = ["doc-verify/src", "doc-verify/lib", "doc-verify/tests", "doc-verify/tsconfig.json", "doc-verify/tsconfig.build.json", "package.json"];

/**
 * Each entry: a full-path target, the exact text to replace, its replacement, and the case the edit
 * must redden. The case name is the assertion's own title, so a rename breaks this file loudly
 * rather than silently re-pointing at a case that no longer exists.
 */
const MUTATIONS = [
  { id: "M1", file: "doc-verify/tests/language/evidence-budget.test.ts",
    from: "const CAP = 32_000;",
    to: "const CAP = 24_000;",
    // A 30,000-byte section under a 24,000-byte cap must BLOCK, so the under-cap row cannot pass.
    name: "judges a union just under the calibrated cap" },
  { id: "M2", file: "doc-verify/src/engine/oracles.ts",
    from: "    if (oracle.maxBytes !== undefined && bytes > oracle.maxBytes) {",
    to: "    if (false) {",
    // Removing the item-cap comparison entirely: the over-cap row must stop BLOCKing.
    name: "BLOCKs a union above the calibrated cap, naming max_bytes rather than the item" },
  { id: "M3", file: "doc-verify/src/engine/oracles.ts",
    from: "  if (alone > limit) {",
    to: "  if (false) {",
    // Removing the judge-state ceiling: raising the item cap would then admit an oversized section,
    // so the row asserting the ceiling is binding must redden.
    name: "keeps the cap BELOW the judge's state ceiling, so the cap is the binding rule" },
  { id: "M4", file: "doc-verify/tests/language/evidence-budget.test.ts",
    from: '    expect(failure).toContain("above max_bytes 32000");',
    to: '    expect(failure).toContain("above max_bytes 16000");',
    // The removal-red's OWN reverse: if the calibrated cap is reported as the inherited 16,000, the
    // over-cap row's message assertion must fail. This is what makes row 3's 16,000 discriminating.
    name: "BLOCKs a union above the calibrated cap, naming max_bytes rather than the item" },
];

const results = [];
for (const mutation of MUTATIONS) {
  const scratch = mkdtempSync(join(tmpdir(), "evidence-budget-mut-"));
  try {
    for (const relative of NEEDED) {
      cpSync(join(REPO, relative), join(scratch, relative), { recursive: true });
    }
    // The suite needs the toolchain; link the repository's own install rather than copying it.
    const modules = join(REPO, "node_modules");
    if (existsSync(modules)) {
      mkdirSync(join(scratch, "node_modules"), { recursive: true });
      rmSync(join(scratch, "node_modules"), { recursive: true, force: true });
      try { symlinkSync(modules, join(scratch, "node_modules")); } catch { /* copied below */ }
    }

    const target = join(scratch, mutation.file);
    const text = readFileSync(target, "utf8");
    if (!text.includes(mutation.from)) {
      results.push({ id: mutation.id, status: "BROKEN", detail: `anchor not found in ${mutation.file}` });
      continue;
    }
    writeFileSync(target, text.replace(mutation.from, mutation.to));

    const reportPath = join(scratch, "vitest-report.json");
    try {
      execFileSync("npx", ["vitest", "run", FOCUSED, "--reporter=json", `--outputFile=${reportPath}`],
        { cwd: scratch, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      // A non-zero exit is expected; the JSON report below is the evidence, not the exit code.
    }
    let report = null;
    try {
      report = JSON.parse(readFileSync(reportPath, "utf8"));
    } catch {
      results.push({ id: mutation.id, status: "HARNESS", detail: "no readable JSON report" });
      continue;
    }
    if (!(report.numTotalTests > 0)) {
      results.push({ id: mutation.id, status: "HARNESS", detail: "the report carries no test result" });
      continue;
    }
    const failedNames = (report.testResults ?? [])
      .flatMap((file) => file.assertionResults ?? [])
      .filter((assertion) => assertion.status === "failed")
      .map((assertion) => assertion.title);
    if (failedNames.length === 0) {
      results.push({ id: mutation.id, status: "GREEN", name: mutation.name });
      continue;
    }
    if (!failedNames.some((name) => name.includes(mutation.name))) {
      results.push({
        id: mutation.id,
        status: "WRONG-CASE",
        detail: `reddened ${failedNames.map((n) => JSON.stringify(n.slice(0, 60))).join(", ")} -- not ${JSON.stringify(mutation.name)}`,
      });
      continue;
    }
    results.push({ id: mutation.id, status: "RED", name: mutation.name });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

let unscored = 0;
for (const result of results) {
  console.log(`  ${result.status.padEnd(11)} ${result.id}  ${result.detail ?? result.name ?? ""}`);
  if (result.status !== SCORED) unscored++;
}
console.log(`\n${results.length - unscored}/${results.length} mutations redden the case their row names`);
process.exit(unscored === 0 ? 0 : 1);
