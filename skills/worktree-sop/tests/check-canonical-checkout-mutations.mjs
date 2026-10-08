#!/usr/bin/env node
// Seeded mutations for `scripts/check-canonical-checkout.mjs` (task #219).
//
// WHY THIS FILE EXISTS. `tests/check-canonical-checkout.mjs` asserts the guard's verdicts, but a
// suite cannot show that its own cases are load-bearing: a case that passes because the guard
// never ran looks identical to one that passes because the guard agreed. Each mutation below
// reintroduces ONE defect in the guard and requires the named case to redden. A mutation whose
// anchor is absent is reported BROKEN and is NEVER scored as a pass -- the same contract as
// `doc-verify/tests/language/references.mutations.mjs` and
// `skills/worktree-sop/tests/check-lock-mutations.mjs`, which are the in-repo precedent for a
// committed runner behind a mutation table.
//
// The guard is copied into a temp dir before each mutation, so the working tree is never left
// mutated and a crash mid-run cannot corrupt the source.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const GUARD = join(ROOT, "scripts", "check-canonical-checkout.mjs");
const CASES = join(HERE, "check-canonical-checkout.mjs");

const MUTATIONS = [
  {
    id: "M1",
    name: "drop the DETACHED refusal",
    file: GUARD,
    apply: (source) => source.replace("  if (branch === null) {", "  if (false) {"),
    // The detached arm asserts the word DETACHED; without the refusal the branch falls through
    // to the named-branch problem, which is a different message and a different diagnosis.
    expects: "detached arm",
  },
  {
    id: "M2",
    name: "tolerate a detached tree when it points at main's commit",
    file: GUARD,
    apply: (source) =>
      source.replace(
        "  if (branch === null) {",
        "  if (branch === null && head !== expectedTip) {",
      ),
    expects: "detached arm",
  },
  {
    id: "M3",
    name: "drop the untracked allowlist",
    file: GUARD,
    apply: (source) =>
      source.replace(
        'if (ALLOWED_UNTRACKED.some((re) => re.test(path))) continue;',
        "if (false) continue;",
      ),
    expects: "allowed-drift arm",
  },
  {
    id: "M4",
    name: "read status with the default (collapses untracked directories)",
    file: GUARD,
    apply: (source) =>
      source.replace('["status", "--porcelain", "-uall"]', '["status", "--porcelain"]'),
    expects: "allowed-drift arm",
  },
  {
    id: "M5",
    name: "remove the one-worktree decline",
    file: GUARD,
    apply: (source) => source.replace("  if (worktreeCount <= 1) {", "  if (false) {"),
    expects: "decline arm",
  },
  {
    id: "M6",
    name: "let a child git inherit the hook's environment",
    file: CASES,
    apply: (source) =>
      source.replace(
        '    env: cleanEnv(),\n    ...options,',
        '    ...options,',
      ),
    expects: "inheritance arm",
  },
  {
    id: "M7",
    name: "drop the core.bare refusal",
    file: GUARD,
    apply: (source) => source.replace('  if (isBare === "true") {', "  if (false) {"),
    expects: "bare arm",
  },
    {
      id: "M8",
      name: "let the escape hatch excuse barness and dirt again",
      file: GUARD,
      // Reproduce the ORIGINAL defect: an unscoped hatch that exits before the bareness and
      // dirty arms. Anchored on the bareness check's own first line.
      apply: (source) =>
        source.replace(
          "  let isBare = null;",
          '  if (detachedAllowed) {\n    console.log(`check-canonical-checkout: SKIPPED by ${ALLOW_ENV}=1`);\n    process.exit(0);\n  }\n\n  let isBare = null;',
        ),
      expects: "allowlist-bare arm",
    },
];

// ⚠⚠ Same hazard as the case suite: this runner also executes inside the `pre-commit` hook, and
// a child `git` that inherits the hook's `GIT_*` variables writes to the CALLER's repository
// rather than to a temp directory. See the long note in `check-canonical-checkout.mjs`. The
// mutation subprocess re-runs the case suite, so it must receive the same cleaned environment.
function cleanEnv() {
  const env = { PATH: process.env.PATH };
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("GIT_")) continue;
    env[key] = value;
  }
  return env;
}

const results = [];

for (const mutation of MUTATIONS) {
  const original = readFileSync(mutation.file, "utf8");
  const mutated = mutation.apply(original);
  if (mutated === original) {
    results.push({ id: mutation.id, status: "BROKEN", detail: `anchor not found in ${mutation.file}` });
    continue;
  }

  const dir = mkdtempSync(join(tmpdir(), "canonical-mut-"));
  const guardCopy = join(dir, "check-canonical-checkout.mjs");
  const casesCopy = join(dir, "cases.mjs");
  try {
    // The cases resolve the guard by a path relative to their own location, so the pair is
    // copied together and the cases are pointed at the mutated copy explicitly.
    writeFileSync(guardCopy, mutated);
    writeFileSync(
      casesCopy,
      readFileSync(CASES, "utf8").replace(
        'const GUARD = join(ROOT, "scripts", "check-canonical-checkout.mjs");',
        `const GUARD = ${JSON.stringify(guardCopy)};`,
      ),
    );
    const run = spawnSync(process.execPath, [casesCopy], { encoding: "utf8", env: cleanEnv() });
    const output = `${run.stdout}${run.stderr}`;
    const reddened = run.status !== 0;
    const namedTheCase = output.includes(mutation.expects);
    if (!reddened) {
      results.push({ id: mutation.id, status: "GREEN", detail: `${mutation.name}: the suite stayed GREEN` });
    } else if (!namedTheCase) {
      results.push({
        id: mutation.id,
        status: "UNRELATED",
        detail: `${mutation.name}: reddened, but not at '${mutation.expects}'`,
      });
    } else {
      results.push({ id: mutation.id, status: "RED", detail: mutation.name });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let bad = 0;
for (const result of results) {
  const label = result.status.padEnd(9);
  console.log(`  ${label} ${result.id}  ${result.detail}`);
  if (result.status !== "RED") bad += 1;
}
console.log("");
if (bad > 0) {
  console.error(`check-canonical-checkout (mutations): ${bad} of ${MUTATIONS.length} did not redden a named case`);
  process.exit(1);
}
console.log(`check-canonical-checkout (mutations): ${MUTATIONS.length}/${MUTATIONS.length} mutations redden a named case`);
