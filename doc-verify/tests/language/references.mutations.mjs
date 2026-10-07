#!/usr/bin/env node
// The committed runner for `references.mutations.md`.
//
// ⚠⚠ THIS FILE EXISTS BECAUSE THE TABLE USED TO DESCRIBE IT WITHOUT IT EXISTING. The table said "the
// harness targets the full path and reports `BROKEN` (anchor absent) or `HARNESS` (no test line)",
// and no such artefact was committed or reachable -- so the sentence promised an enforcement
// mechanism that was really the author's host-side script. Two reviewers measured that gap. A claim
// about a mechanism has to be inspectable, or it is prose.
//
// What it does: for each mutation below, copy the focused suite's inputs into a scratch tree, apply
// the single source edit, and require the suite to REDDEN. A mutation whose anchor is absent is
// reported BROKEN and a run that produces no test line is reported HARNESS -- NEITHER is scored as a
// pass. Scoring a no-op or a crash as green is worse than scoring it as "did not redden".
//
// Usage: node doc-verify/tests/language/references.mutations.mjs
//
// ⚠ Every target is a FULL repository path. Two files here are called `checker.ts` and both are on
// one import chain, so a mutation applied to the wrong one compiles, runs, and measures an
// unmutated tree. See the note in `references.mutations.md`.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root, derived from this file's location -- never a hard-coded host path. */
const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const FOCUSED = "doc-verify/tests/language/references.test.ts";
/** Copied into the scratch tree so the focused suite can run without the rest of the repository. */
const NEEDED = ["doc-verify/src", "doc-verify/lib", "doc-verify/tests", "doc-verify/tsconfig.json", "doc-verify/tsconfig.build.json", "package.json"];

/**
 * Each entry: a full-path target, the exact text to replace, its replacement, and the case the edit
 * must redden. The case name is the assertion's own title, so a rename breaks this file loudly
 * rather than silently re-pointing at a case that no longer exists.
 */
const MUTATIONS = [
  { id: "M1", file: "doc-verify/src/engine/facts.ts",
    from: '  if (specParts(value, context) !== undefined) {\n    return "spec";\n  }',
    to: '  if (false) {\n    return "spec";\n  }',
    name: "spec: a revision-qualified span is its own kind" },
  { id: "M2", file: "doc-verify/src/engine/facts.ts",
    from: '  if (!(SPEC_HEX.test(revision) || SPEC_HEAD.test(revision) || (context?.gitRefs?.includes(revision) ?? false))) {\n    return undefined;\n  }',
    to: '  if (revision.length === 0) {\n    return undefined;\n  }',
    name: "spec: an UNLISTED ref name is not a spec" },
  { id: "M3", file: "doc-verify/src/engine/facts.ts",
    from: '  if (!file.includes("/") && !FILE_EXTENSION.test(file)) {\n    return undefined;\n  }',
    to: '  if (false) {\n    return undefined;\n  }',
    name: "spec: an UNLISTED ref name is not a spec" },
  { id: "M4", file: "doc-verify/src/engine/facts.ts",
    from: '  if (reference.kind === "spec") {\n    return context.resolveSpec === undefined || context.resolveSpec(reference.target) === "ok";\n  }',
    to: '  if (reference.kind === "spec") {\n    return true;\n  }',
    name: "spec: the failure NAMES ITS COMPONENT" },
  { id: "M5", file: "doc-verify/src/engine/facts.ts",
    from: '        if (context.resolveSpec !== undefined) {\n          const verdict = context.resolveSpec(reference.target);\n          if (verdict !== "ok") {\n            facts.push(core("spec_unresolved", [D, atom(reference.section), atom(reference.target), atom(verdict)]));\n          }\n        }',
    to: '        if (context.resolveSpec === undefined) {\n          facts.push(core("spec_unresolved", [D, atom(reference.section), atom(reference.target), atom("unresolved")]));\n        } else {\n          const verdict = context.resolveSpec(reference.target);\n          if (verdict !== "ok") {\n            facts.push(core("spec_unresolved", [D, atom(reference.section), atom(reference.target), atom(verdict)]));\n          }\n        }',
    name: "spec: with no resolver the span is classified but RESOLUTION IS NOT CLAIMED" },
  // ⚠ M6 is the ORDERING arm and needs the comment lines above the arm, or it is textually identical
  // to M1: here the arm is removed WITH its position marker, so the `:` reaches `PATH_SPAN` first.
  { id: "M6", file: "doc-verify/src/engine/facts.ts",
    from: '  // A revision-qualified reference is decided before the path rules, because PATH_SPAN (below)\n  // refuses a `:` outright -- which is exactly why `<rev>:<path>` was invisible.\n  if (specParts(value, context) !== undefined) {\n    return "spec";\n  }',
    to: '  // (the ordering arm removed by M6)',
    name: "spec: a revision-qualified span is its own kind" },
  // ⚠ M7 and M9 target `doc-verify/src/checker.ts`, NOT `doc-verify/src/engine/checker.ts`.
  { id: "M7", file: "doc-verify/src/checker.ts",
    from: '      if (!gitResolves(root, ["cat-file", "-e", `${revision}^{tree}`])) {',
    to: '      if (!gitResolves(root, ["cat-file", "-e", `${revision}`])) {',
    name: "references: an unresolved spec reddens with the component named" },
  { id: "M8", file: "doc-verify/lib/references.yaml",
    from: "    forbid: core.spec_unresolved(D, S, T, revision)",
    to: "    forbid: core.spec_unresolved(D, S, T, path)",
    name: "references: an unresolved spec reddens with the component named" },
  { id: "M9", file: "doc-verify/src/checker.ts",
    from: '      if (!gitResolves(root, ["cat-file", "-e", `${revision}^{tree}`])) {',
    to: '      if (!gitResolves(root, ["rev-parse", "--verify", "-q", revision])) {',
    name: "references: an unresolved spec reddens with the component named" },
];

const results = [];
for (const mutation of MUTATIONS) {
  const scratch = mkdtempSync(join(tmpdir(), "references-mut-"));
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

    let out = "";
    let failed = false;
    try {
      out = execFileSync("npx", ["vitest", "run", FOCUSED, "--reporter=basic"],
        { cwd: scratch, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      failed = true;
      out = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    }
    // A run that produced no test line did not measure anything: report it, never score it.
    const ran = /Tests\s+\d+/.exec(out);
    if (ran === null) {
      results.push({ id: mutation.id, status: "HARNESS", detail: "no test line in the output" });
      continue;
    }
    results.push({ id: mutation.id, status: failed ? "RED" : "GREEN", name: mutation.name });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

let unscored = 0;
for (const result of results) {
  console.log(`  ${result.status.padEnd(6)} ${result.id}  ${result.detail ?? result.name ?? ""}`);
  if (result.status !== "RED") unscored++;
}
console.log(`\n${results.length - unscored}/${results.length} mutations redden a named case`);
process.exit(unscored === 0 ? 0 : 1);
