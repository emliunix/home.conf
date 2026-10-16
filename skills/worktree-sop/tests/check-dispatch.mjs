#!/usr/bin/env node

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(ROOT, "tests", "admitted-fixture.mjs");
// ⚠ A TEST PORT, NOT THE CONSTANT. This file runs on every `skills/` commit, and a real heavy gate
// may hold the DEFAULT port at that moment -- the fixture would be refused and the arm would redden
// about the host rather than about serialization. Both children are given the SAME port, which is
// the seam's stated use. The constant is pinned separately (anchor invariance).
const TEST_PORT = 47510;
const failures = [];

/** Temp roots minted by this file, removed once at the end. Registered at CREATION and torn down
 *  from ONE place, so a root cannot be created outside a teardown's reach. */
const created = [];

function fail(message) {
  failures.push(message);
}

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GATE_ADMISSION_PORT: String(TEST_PORT) },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => resolveRun({ status, stdout, stderr }));
  });
}

// ── serialization, RED and GREEN ────────────────────────────────────────────────────────────────
//
// ⚠ RE-SCOPED BY #329. This pair used to drive the retired lock's CLI (`gate-lock.mjs --lock-file
// … -- <fixture>`). The lock FILE is gone, so the pair now drives the replacement directly: the
// fixture acquires the slot itself.
//
// ⚠ WHAT LEFT THIS FILE, AND WHERE IT WENT. The lock's OWN cases -- the publish window, the
// three-way holder classification, stale-holder recovery, the identity-checked quarantine -- pinned
// behaviour that no longer exists, so `check-lock.mjs` and `check-lock-mutations.mjs` were deleted
// with their subject rather than rewritten to pass. A case kept against a deleted mechanism is a
// case that can no longer fail. The replacement's cases live in `check-admission.mjs`, beside the
// module they exercise.
//
// ⚠ AND THE STALE-HOLDER CLASSIFICATION IS NOT "MISSING COVERAGE" -- it is DELETED BEHAVIOUR. The
// slot has no staleness arm at all (a fixed loopback bind has no metadata to age), so there is
// nothing to classify and nothing to recover. The bound that replaces it is stated in
// `gate-admission.mjs`: a live holder is never displaced, and a LIVE-BUT-HUNG holder is never
// recovered either -- contenders wait the bounded budget and exit 75. That is a WAIT, not a second
// population.
async function runAdmittedPair(state) {
  const runOne = (tag) =>
    run(process.execPath, [
      FIXTURE,
      "--state",
      state,
      "--hold-ms",
      "120",
      "--tag",
      tag,
    ]);
  return Promise.all([runOne("A"), runOne("B")]);
}

function parseEvents(path) {
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [tag, phase, time, pid] = line.split(" ");
      return { tag, phase, time: Number(time), pid: Number(pid) };
    });
}

function hasOverlap(events) {
  let active;
  for (const event of events) {
    if (event.phase === "start") {
      if (active) return true;
      active = event;
    } else if (active && active.tag === event.tag) {
      active = undefined;
    }
  }
  return false;
}

function checkSurface() {
  const skill = read("SKILL.md");
  const frontMatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontMatter) fail("SKILL.md: missing frontmatter");
  else {
    if (!/^name:\s*worktree-sop\s*$/m.test(frontMatter[1])) {
      fail("SKILL.md: frontmatter name is not worktree-sop");
    }
    if (!/^description:/m.test(frontMatter[1])) {
      fail("SKILL.md: frontmatter has no description");
    }
  }
  for (const target of ["references/worktree-lifecycle.md"]) {
    if (!skill.includes(`(${target})`))
      fail(`SKILL.md: missing link to ${target}`);
    if (!existsSync(join(ROOT, target))) fail(`missing ${target}`);
  }
  if (!skill.includes("run-admitted-check.mjs")) {
    fail("SKILL.md: missing the admitted-seat command surface");
  }
}

async function checkRedGreen() {
  const dir = mkdtempSync(join(tmpdir(), "worktree-sop-"));
  created.push(dir);
  const admittedState = join(dir, "admitted.log");
  const unlockedState = join(dir, "unlocked.log");

  const admittedRuns = await runAdmittedPair(admittedState);
  if (admittedRuns.some((result) => result.status !== 0)) {
    fail(`admitted pair failed: ${JSON.stringify(admittedRuns.map((r) => r.status))}`);
  } else if (hasOverlap(parseEvents(admittedState))) {
    fail("admitted fixture overlapped");
  }

  // ⚠ THE CONTROL: the SAME two runs, with admission removed, MUST overlap. Without it the arm
  // above would pass on a machine that simply ran the two children slowly, and would not show the
  // slot is doing the work.
  //
  // ⚠⚠ EACH CHILD GETS A DIFFERENT PORT, AND THAT IS THE WHOLE BYPASS. Giving both children the
  // SAME (unused) port does NOT remove admission -- they would still bind that one port and
  // serialize, so the "control" would be a second GUARDED arm. MEASURED: it failed with "did not
  // overlap" while proving nothing, which is how the first version of this control was written.
  // Two DIFFERENT ports mean neither contends with the other: the honest model of "nothing
  // serializes these two runs".
  const unlocked = await Promise.all(
    [
      ["C", "47597"],
      ["D", "47596"],
    ].map(
      ([tag, port]) =>
        new Promise((resolveRun) => {
          const child = spawn(
            process.execPath,
            [FIXTURE, "--state", unlockedState, "--hold-ms", "200", "--tag", tag],
            { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GATE_ADMISSION_PORT: port } },
          );
          child.on("close", (status) => resolveRun({ status }));
        }),
    ),
  );
  if (unlocked.some((result) => result.status !== 0)) {
    fail(`unlocked control failed: ${JSON.stringify(unlocked.map((r) => r.status))}`);
  } else if (!hasOverlap(parseEvents(unlockedState))) {
    fail(
      "unlocked control did not overlap, so the fixture cannot prove serialization",
    );
  }
}

// The replacement's own cases live in a sibling file, beside the module they exercise:
// `check-admission.mjs` covers the atomicity, the environment invariance, the crash release, the
// refusal polarity and its control, and the fixed-seat wiring. The retired lock's cases
// (`check-lock.mjs`, `check-lock-mutations.mjs`) were DELETED with their subject rather than
// rewritten -- a case kept against a deleted mechanism is a case that can no longer fail.
//
// The canonical-checkout guard's cases and mutations, on the same contract: the cases pin the
// verdicts and the mutations prove each case is load-bearing rather than merely green.
// ⚠ THE MUTATION TABLE IS DELIBERATELY NOT HERE. It costs minutes, not seconds: its M6 arm
// has to re-run this whole case suite nested, because M6's target (a child `git` inheriting
// the caller's `GIT_*`) only exists under that nesting. Measured: the table is ~160 s against
// a ~14 s case suite. Paying that on every `skills/` commit buys nothing, because the guard it
// guards runs in no hook at all -- it is a lander's step. The table runs there instead, beside
// the guard, where its verdict can actually block something:
//
//   node skills/worktree-sop/tests/check-canonical-checkout-mutations.mjs
//
// ⚠ And it cannot simply be trimmed: marking the inner run `CASE_INHERITANCE_CHILD=1` to skip
// arm 9 drops the table from ~260 s to ~64 s AND BREAKS M6 -- measured, 6 of 7 redden instead
// of 7 of 7. The cost is structural, so the fix is placement, not deletion.
  async function checkCanonicalCases() {
    const result = await run(process.execPath, [join(ROOT, "tests", "check-canonical-checkout.mjs")]);
    if (result.status !== 0) {
      const detail = `${result.stdout}${result.stderr}`
        .trim()
        .split("\n")
        .filter((line) => line.trim().startsWith("- "))
        .join(" | ");
      fail(`check-canonical-checkout.mjs failed: ${detail || `exit ${result.status}`}`);
    }
  }

// The retired lock's own cases were DELETED with their subject (`check-lock.mjs`,
// `check-lock-mutations.mjs`); see the note above `runAdmittedPair`. The replacement's cases live in
// `check-admission.mjs`, and they are run HERE so a `skills/` commit still exercises them:
async function checkAdmissionCases() {
  const result = await run(process.execPath, [join(ROOT, "tests", "check-admission.mjs")]);
  if (result.status !== 0) {
    const detail = `${result.stdout}${result.stderr}`
      .trim()
      .split("\n")
      .filter((line) => line.trim().startsWith("FAIL"))
      .join(" | ");
    fail(`check-admission.mjs failed: ${detail || `exit ${result.status}`}`);
  }
}

checkSurface();
await checkRedGreen();
await checkAdmissionCases();
await checkCanonicalCases();

// ⚠ TEARDOWN FROM ONE PLACE, and it is NOT decoration: the retired `check-lock.mjs` minted ~15
// `gate-lock-case-*` roots per run through a `freshDir()` helper with no removal path, and 1,008 of
// them (4.6 MB) accumulated under `$TMPDIR` before anyone noticed -- the leak this card's revision
// note records. A root registered at CREATION cannot be missed by a teardown that was added later.
function teardown() {
  for (const dir of created) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* a leftover temp dir is not a case failure */
    }
  }
}

// ⚠⚠ AND IT IS REGISTERED ON `exit`, NOT MERELY CALLED AT THE END.
// MEASURED in the sibling case file (`check-admission.mjs`): a run whose stdout was piped to `head`
// died on EPIPE before reaching an end-of-body teardown and left 11 roots behind, while the same run
// with its output captured to a file left 0. `node … | head` is an ordinary way to read a long
// output, and this file's output will grow as cases are added, so the path is reachable here too even
// though today's short output happens not to trigger it.
process.on("exit", teardown);
process.stdout.on("error", (error) => {
  if (error && error.code === "EPIPE") process.exit(0);
});

teardown();

if (failures.length) {
  console.error(`check-dispatch: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  "check-dispatch: ok (surface, admission red/green, admission cases, canonical checkout)",
);
