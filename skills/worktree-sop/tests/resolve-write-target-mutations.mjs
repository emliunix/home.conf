#!/usr/bin/env node
// Seeded mutations for `scripts/resolve-write-target.mjs` (task #307).
//
// WHY THIS FILE EXISTS. `tests/resolve-write-target.mjs` asserts the check's verdicts, but a suite
// cannot show that its own cases are load-bearing: a case that passes because the check never ran
// looks identical to one that passes because the check agreed. Each mutation below reintroduces ONE
// defect and requires the named case to redden. A mutation whose anchor is ABSENT is reported BROKEN
// and is NEVER scored as a pass -- the same contract as `check-canonical-checkout-mutations.mjs` and
// `check-lock-mutations.mjs`, the in-repo precedent for a committed runner behind a mutation table.
//
// ⚠ M2 IS THE IMPORTANT ONE. It is not a hypothetical: it is the defect this script HAD, measured,
// while it was being written. Without `--path-format=absolute` the classifier reported the SHARED
// PRIMARY as a safe "worktree" and the check told its caller it was fine to write -- the exact
// inversion the check exists to prevent.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CHECK = join(ROOT, "scripts", "resolve-write-target.mjs");
const CASES = join(HERE, "resolve-write-target.mjs");

const MUTATIONS = [
  {
    id: "M1",
    name: "never refuse: a shared primary is treated as allowed",
    apply: (s) => s.replace('common === gitDir ? "shared-main" : "worktree"', '"worktree"'),
    expects: "a symlink INTO the shared primary REFUSES",
  },
  {
    id: "M2",
    name: "drop --path-format=absolute (the measured defect: primary read as a worktree)",
    apply: (s) =>
      s.replace('git(["rev-parse", "--path-format=absolute", "--git-common-dir"], dir)', 'git(["rev-parse", "--git-common-dir"], dir)'),
    expects: "a file inside the primary's SUBDIRECTORY refuses",
  },
  {
    id: "M3",
    name: "classify the FILE rather than its containing directory",
    apply: (s) => s.replace("    if (!statSync(dir).isDirectory()) dir = dirname(dir);", "    if (false) dir = dirname(dir);"),
    expects: "a symlink INTO the shared primary REFUSES",
  },
  {
    id: "M4",
    name: "refuse everything, including an agent-local path",
    // A path outside any repo has gitDir === null; classifying THAT as shared-main refuses an
    // agent's own file, which is the over-refusal direction and just as wrong as under-refusal.
    apply: (s) =>
      s.replace(
        'return { kind: "local", root: null, gitDir: null };',
        'return { kind: "shared-main", root: null, gitDir: null };',
      ),
    expects: "an AGENT-LOCAL path outside any repo is ALLOWED",
  },
  {
    id: "M7",
    name: "fold a BARE repo into agent-local (the fail-open defect this script had)",
    apply: (s) =>
      s.replace(
        'return { kind: bare === "true" ? "bare" : "unknown", root: null, gitDir };',
        'return { kind: "local", root: null, gitDir };',
      ),
    expects: "a BARE repository REFUSES",
  },
  {
    id: "M5",
    name: "a usage error becomes a silent pass",
    apply: (s) => s.replace("  process.exit(2);", "  process.exit(0);"),
    expects: "no arguments is a usage error (exit 2), not a silent pass",
  },
  {
    id: "M6",
    name: "--quiet still prints (silence is a property, not a preference)",
    apply: (s) => s.replace('if (!QUIET) {\n    console.log(`${input}`);', "if (true) {\n    console.log(`${input}`);"),
    expects: "--quiet emits nothing and keeps the exit code",
  },
];

function casesRunOn(checkPath) {
  const src = readFileSync(CASES, "utf8").replace(
    /const CHECK = resolve\(HERE, "\.\.", "scripts", "resolve-write-target\.mjs"\);/,
    `const CHECK = ${JSON.stringify(checkPath)};`,
  );
  const tmp = mkdtempSync(join(tmpdir(), "rw-mut-cases-"));
  const file = join(tmp, "cases.mjs");
  writeFileSync(file, src);
  return { file, dir: tmp };
}

const original = readFileSync(CHECK, "utf8");
const results = [];
let broken = 0;

for (const m of MUTATIONS) {
  const mutated = m.apply(original);
  if (mutated === original) {
    results.push(["BROKEN", `${m.id} ${m.name} -- ANCHOR ABSENT (mutation did not apply; not scored as a pass)`]);
    broken += 1;
    continue;
  }
  const scratch = mkdtempSync(join(tmpdir(), "rw-mut-"));
  const mutatedPath = join(scratch, "resolve-write-target.mjs");
  writeFileSync(mutatedPath, mutated);
  const { file: casesFile, dir: casesDir } = casesRunOn(mutatedPath);
  const r = spawnSync("node", [casesFile], { encoding: "utf8" });
  const out = `${r.stdout}${r.stderr}`;
  rmSync(scratch, { recursive: true, force: true });
  rmSync(casesDir, { recursive: true, force: true });

  const failedNames = out
    .split("\n")
    .filter((l) => l.trim().startsWith("FAIL"))
    .map((l) => l.trim().slice(4).trim());
  const reddened = failedNames.some((n) => n.includes(m.expects));
  if (reddened) results.push(["OK", `${m.id} ${m.name} -- '${m.expects}' went RED`]);
  else
    results.push([
      "LEAK",
      `${m.id} ${m.name} -- expected '${m.expects}' to redden, but it stayed green`,
    ]);
}

// The unmutated control: the suite must be green with no mutation, or every red above is meaningless.
const { file: controlFile, dir: controlDir } = casesRunOn(CHECK);
const control = spawnSync("node", [controlFile], { encoding: "utf8" });
rmSync(controlDir, { recursive: true, force: true });
const controlGreen = control.status === 0;

for (const [verdict, name] of results) console.log(`  ${verdict.padEnd(7)} ${name}`);
console.log(
  `\n  control (unmutated)  ${controlGreen ? "GREEN" : "RED"}  <- must be GREEN, or no red above means anything`,
);
console.log(`  ${results.filter(([v]) => v === "OK").length}/${MUTATIONS.length} mutations reddened their case`);

const bad = results.filter(([v]) => v !== "OK").length + (controlGreen ? 0 : 1);
process.exit(bad > 0 ? 1 : 0);
