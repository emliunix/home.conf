#!/usr/bin/env node

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCK = join(ROOT, "scripts", "gate-lock.mjs");
const FIXTURE = join(ROOT, "tests", "gate-fixture.mjs");
const failures = [];

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
      env: process.env,
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

async function runLockedPair(state, lockFile) {
  const runOne = (tag) =>
    run(process.execPath, [
      LOCK,
      "--lock-file",
      lockFile,
      "--timeout-ms",
      "5000",
      "--stale-ms",
      "60000",
      "--poll-ms",
      "10",
      "--",
      process.execPath,
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
  for (const target of [
    "references/worktree-lifecycle.md",
    "references/gate-lock.md",
  ]) {
    if (!skill.includes(`(${target})`))
      fail(`SKILL.md: missing link to ${target}`);
    if (!existsSync(join(ROOT, target))) fail(`missing ${target}`);
  }
  if (!skill.includes("scripts/gate-lock.mjs")) {
    fail("SKILL.md: missing gate-lock command surface");
  }
}

async function checkRedGreen() {
  const dir = mkdtempSync(join(tmpdir(), "worktree-sop-"));
  const lockedState = join(dir, "locked.log");
  const unlockedState = join(dir, "unlocked.log");
  const lockFile = join(dir, "gate.lock");

  const lockedRuns = await runLockedPair(lockedState, lockFile);
  if (lockedRuns.some((result) => result.status !== 0)) {
    fail(`locked pair failed: ${JSON.stringify(lockedRuns)}`);
  } else if (hasOverlap(parseEvents(lockedState))) {
    fail("locked fixture overlapped");
  }

  const unlocked = await Promise.all([
    run(process.execPath, [
      FIXTURE,
      "--state",
      unlockedState,
      "--hold-ms",
      "120",
      "--tag",
      "C",
    ]),
    run(process.execPath, [
      FIXTURE,
      "--state",
      unlockedState,
      "--hold-ms",
      "120",
      "--tag",
      "D",
    ]),
  ]);
  if (unlocked.some((result) => result.status !== 0)) {
    fail(`unlocked control failed: ${JSON.stringify(unlocked)}`);
  } else if (!hasOverlap(parseEvents(unlockedState))) {
    fail(
      "unlocked control did not overlap, so the fixture cannot prove serialization",
    );
  }

  writeFileSync(
    lockFile,
    `${JSON.stringify({
      token: "stale",
      pid: 99999999,
      command: "stale",
      startedAt: new Date(0).toISOString(),
    })}\n`,
  );
  const staleState = join(dir, "stale.log");
  const stale = await run(process.execPath, [
    LOCK,
    "--lock-file",
    lockFile,
    "--timeout-ms",
    "1000",
    "--stale-ms",
    "1",
    "--poll-ms",
    "10",
    "--",
    process.execPath,
    FIXTURE,
    "--state",
    staleState,
    "--hold-ms",
    "1",
    "--tag",
    "stale",
  ]);
  if (stale.status !== 0 || !existsSync(staleState)) {
    fail("stale-holder recovery did not acquire the lock");
  }

  writeFileSync(
    lockFile,
    `${JSON.stringify({
      token: "live",
      pid: process.pid,
      command: "test-holder",
      startedAt: new Date().toISOString(),
    })}\n`,
  );
  const timeout = await run(process.execPath, [
    LOCK,
    "--lock-file",
    lockFile,
    "--timeout-ms",
    "50",
    "--stale-ms",
    "60000",
    "--poll-ms",
    "10",
    "--",
    process.execPath,
    "-e",
    "process.exit(0)",
  ]);
  unlinkSync(lockFile);
  if (
    timeout.status !== 75 ||
    !timeout.stdout.includes('"state":"lock_timeout"')
  ) {
    fail("live holder did not produce a bounded lock timeout");
  }
}

// The lock's own cases live in a sibling file: the landed fixture here writes a FULLY FORMED
// lock, so it never presents the publish window that the live-holder eviction came from.
// check-lock.mjs drives that window and the identity-checked transitions directly, and
// check-lock-mutations.mjs proves each of those cases FIREs on the defect it targets.
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

async function checkLockCases() {
  for (const file of ["check-lock.mjs", "check-lock-mutations.mjs"]) {
    const result = await run(process.execPath, [join(ROOT, "tests", file)]);
    if (result.status !== 0) {
      const detail = `${result.stdout}${result.stderr}`
        .trim()
        .split("\n")
        .filter((line) => line.trim().startsWith("- "))
        .join(" | ");
      fail(`${file} failed: ${detail || `exit ${result.status}`}`);
    }
  }
}

checkSurface();
await checkRedGreen();
await checkLockCases();
await checkCanonicalCases();

if (failures.length) {
  console.error(`check-dispatch: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  "check-dispatch: ok (surface, serialization red/green, stale recovery, lock classification, seeded mutations, canonical checkout)",
);
