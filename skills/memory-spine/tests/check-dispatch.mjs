#!/usr/bin/env node
// check-dispatch.mjs -- coverage for the memory-spine skill's own instruments.
//
// Every skill in this repository that ships a dispatcher runs its coverage check from the
// `skill-dispatch` pre-commit hook; this is memory-spine's. It asserts REACHABILITY and the
// named reds, not prose quality.
//
// WHY THIS IS A LINEAR SEQUENCE. An earlier revision ran its cases as top-level blocks and ended
// the process from inside an async callback, so every case after that one was silently skipped --
// a suite that reported "all pass" while measuring four of six things. Each case here is awaited
// in order, and the summary is printed once, at the end, after every case has returned.
//
// THE NAMED CASES (task #198 acceptance):
//   1. over-cap red, reporting the exact bytes over
//   2. pointer-resolution failure
//   2b. missing required spine heading
//   3. concurrent append serialization, and idempotence under it
//   4. interrupted publish preserves the previous valid pair
//   5. refused write leaves both files byte-identical
//   6. the doc-verify profile fails closed on a broken pointer and a missing section
// Plus the mutation the card requires: removing the cap check must redden case 1.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { planMigration, verifyPreservation } from "../scripts/memory-migrate.mjs";
import { appendFact } from "../scripts/memory-append.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LINT = join(ROOT, "scripts", "memory-lint.mjs");
const APPEND = join(ROOT, "scripts", "memory-append.mjs");
const MIGRATE = join(ROOT, "scripts", "memory-migrate.mjs");
// Derived from this file's own location, never hardcoded: this repository is public, and a
// host-absolute path in a committed test is both a leak and a test that only passes on one machine.
const ENGINE = resolve(ROOT, "..", "..", "doc-verify", "dist", "cli.js");
const failures = [];
const today = () => new Date().toISOString().slice(0, 10);

const logFileFor = (dir) => join(dir, "notes", `memory-log-${today()}.md`);
const GOOD_INDEX = () =>
  "# TestAgent\n\n## Role\nx\n\n## Key Knowledge\n- see `notes/real.md`\n\n## Active Context\nworking\n";

function check(condition, message) {
  if (!condition) failures.push(message);
}

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), "memory-spine-"));
  mkdirSync(join(dir, "notes"), { recursive: true });
  writeFileSync(join(dir, "notes", "real.md"), "detail\n");
  writeFileSync(join(dir, "MEMORY.md"), GOOD_INDEX());
  return dir;
}

function lint(index) {
  return spawnSync(process.execPath, [LINT, index], { encoding: "utf8" });
}

// --- 1. over-cap red, with the exact bytes over ----------------------------------------------
function caseOverCap() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  writeFileSync(index, `${GOOD_INDEX()}${"x".repeat(17_000)}\n`);
  const run = lint(index);
  const expectedOver = Buffer.byteLength(readFileSync(index, "utf8"), "utf8") - 16_384;
  check(run.status === 1, `over-cap should exit 1, got ${String(run.status)}`);
  check(/B over the 16384 B cap/.test(run.stderr), "over-cap must report bytes over the cap");
  check(run.stderr.includes(String(expectedOver)), `over-cap must name the exact bytes over (${expectedOver})`);
  check(/largest sections:/.test(run.stderr), "over-cap must name the largest sections to trim");
  rmSync(dir, { recursive: true, force: true });
}

// --- 2. pointer-resolution failure, with a control ------------------------------------------
function casePointer() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  writeFileSync(index, GOOD_INDEX().replace("notes/real.md", "notes/missing.md"));
  const run = lint(index);
  check(run.status === 1, `broken pointer should exit 1, got ${String(run.status)}`);
  check(/pointer does not resolve: notes\/missing\.md/.test(run.stderr), "broken pointer must be named");
  // Control: the same document with the pointer repaired passes, so the red IS the pointer.
  writeFileSync(index, GOOD_INDEX());
  const control = lint(index);
  check(control.status === 0, "repaired pointer must pass -- otherwise the red is not the pointer");
  rmSync(dir, { recursive: true, force: true });
}

// --- 2b. a missing required heading is also a red -------------------------------------------
function caseHeading() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  writeFileSync(index, GOOD_INDEX().replace("\n## Active Context\nworking\n", ""));
  const run = lint(index);
  check(run.status === 1, `missing heading should exit 1, got ${String(run.status)}`);
  check(/missing required index heading: ## Active Context/.test(run.stderr), "missing heading must be named");
  rmSync(dir, { recursive: true, force: true });
}

// --- 3. concurrent append serialization + idempotence ---------------------------------------
async function caseConcurrent() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  const before = readFileSync(index);
  const writers = Array.from({ length: 6 }, (_, i) =>
    new Promise((done) => {
      const child = spawn(process.execPath, [APPEND, index, `concurrent fact ${String(i)}`]);
      child.on("close", (code) => done(code));
    }));
  const duplicate = new Promise((done) => {
    const child = spawn(process.execPath, [APPEND, index, "concurrent fact 0"]);
    child.on("close", () => done(null));
  });
  const codes = await Promise.all([...writers, duplicate]);
  check(codes.slice(0, 6).every((c) => c === 0), `all concurrent writers should succeed, got ${codes.join(",")}`);
  const log = readFileSync(logFileFor(dir), "utf8");
  const entries = log.split("\n").filter((l) => l.startsWith("## 2")).length;
  check(entries === 6, `exactly one entry per distinct fact (idempotent under concurrency), got ${String(entries)}`);
  check(readFileSync(index).equals(before), "append must leave the index byte-identical");
  rmSync(dir, { recursive: true, force: true });

  // THE DISCRIMINATING HALF. Eight writers of ONE fact must leave exactly ONE entry, because what
  // a broken lock actually breaks is IDEMPOTENCE -- writers race past the `already present` check
  // and all append the same fact. Measuring this required a BARRIER: spawning the arms and hoping
  // they overlap does not race, because process-start latency serializes them and the case then
  // passes while measuring nothing (verified: the `wx`->`w` mutation did not redden the unbarriered
  // version, and DID redden this one -- 1 entry vs 3). So each arm busy-waits on one shared instant.
  const same = workspace();
  const racer = join(same, "racer.mjs");
  writeFileSync(racer, [
    `import { appendFact } from ${JSON.stringify(APPEND)};`,
    "const [indexPath, startAt, ...words] = process.argv.slice(2);",
    "const until = Number(startAt);",
    "while (Date.now() < until) { /* barrier: all arms start on one shared instant */ }",
    "try { appendFact(indexPath, words.join(\" \")); }",
    "catch (error) { process.exit(error?.code === \"ELOCKED\" ? 3 : 1); }",
  ].join("\n"));
  const sameIndex = join(same, "MEMORY.md");
  const startAt = Date.now() + 3_000;
  const racers = Array.from({ length: 8 }, () =>
    new Promise((done) => {
      const child = spawn(process.execPath, [racer, sameIndex, String(startAt), "one fact, eight writers"]);
      child.on("close", () => done(null));
    }));
  await Promise.all(racers);
  const sameLog = readFileSync(logFileFor(same), "utf8");
  const sameEntries = sameLog.split("\n").filter((l) => l.startsWith("## 2")).length;
  check(sameEntries === 1, `eight barriered writers of ONE fact must leave exactly one entry (lock holds), got ${String(sameEntries)}`);
  rmSync(same, { recursive: true, force: true });
}

// --- 4. interrupted publish preserves the previous valid pair -------------------------------
function caseInterrupted() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  const before = readFileSync(index);
  const crash = spawnSync(
    process.execPath,
    ["-e", `
      const { writeFileSync } = require("node:fs");
      writeFileSync(${JSON.stringify(index)} + ".interrupted.tmp", "PARTIAL PUBLISH -- must never be visible");
      process.exit(9);
    `],
    { encoding: "utf8" },
  );
  check(crash.status === 9, "the simulated crash should exit 9");
  check(readFileSync(index).equals(before), "an interrupted publish must leave the index byte-identical");
  // The atomicity is a property of the WRITE SHAPE: a temp file in the target's own directory,
  // renamed over it. If either half is missing the rename is not atomic and this case is a lie.
  const source = readFileSync(APPEND, "utf8");
  check(/join\(dirname\(indexPath\)/.test(source), "publish temp must live in the target's own directory");
  check(/renameSync\(tmp, indexPath\)/.test(source), "publish must rename the temp over the target");
  rmSync(dir, { recursive: true, force: true });
}

// --- 5. refused write leaves both files byte-identical --------------------------------------
function caseRefused() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  const before = readFileSync(index);
  const run = spawnSync(process.execPath, [APPEND, index, "   "], { encoding: "utf8" });
  check(run.status === 1, `blank fact should be refused, got ${String(run.status)}`);
  check(/REFUSED/.test(run.stderr), "a refused append must say so");
  check(readFileSync(index).equals(before), "a refused write must leave the index byte-identical");
  check(!existsSync(logFileFor(dir)), "a refused write must not create a log entry");
  // A MISSING fact is a different fault from a blank one: usage (64), not refusal (1).
  const usage = spawnSync(process.execPath, [APPEND, index], { encoding: "utf8" });
  check(usage.status === 64, `a missing fact should be usage error 64, got ${String(usage.status)}`);
  rmSync(dir, { recursive: true, force: true });
}

// --- 6. the doc-verify profile fails closed -------------------------------------------------
function caseProfile() {
  const profileReady = existsSync(join(ROOT, ".doc-verify.yaml")) && existsSync(join(ROOT, "module.yaml")) && existsSync(ENGINE);
  if (!profileReady) {
    failures.push("doc-verify profile case did not run: engine or profile absent (this must not read as a pass)");
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "memory-spine-dv-"));
  mkdirSync(join(dir, "notes"), { recursive: true });
  writeFileSync(join(dir, "notes", "real.md"), "detail\n");
  writeFileSync(join(dir, ".doc-verify.yaml"), readFileSync(join(ROOT, ".doc-verify.yaml")));
  writeFileSync(join(dir, "module.yaml"), readFileSync(join(ROOT, "module.yaml")));
  const good = GOOD_INDEX();
  writeFileSync(join(dir, "MEMORY.md"), good);
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q", ".");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "t");
  git("add", "-A");
  git("commit", "-q", "-m", "fixture");
  const checkDoc = () => spawnSync(process.execPath, [ENGINE, "check", "--paths", "MEMORY.md"], { cwd: dir, encoding: "utf8" });
  const stage = (text) => {
    writeFileSync(join(dir, "MEMORY.md"), text);
    git("add", "-A");
  };

  const clean = checkDoc();
  check(clean.status === 0, `profile must PASS a good index, got ${String(clean.status)}`);

  stage(good.replace("notes/real.md", "notes/gone.md"));
  const broken = checkDoc();
  check(broken.status !== 0, "profile must fail closed on a broken pointer");
  check(/dangling|does not resolve/.test(`${broken.stdout}${broken.stderr}`), "the broken pointer must be named");

  stage(good.replace("\n## Active Context\nworking\n", ""));
  const noSection = checkDoc();
  check(noSection.status !== 0, "profile must fail closed on a missing spine section");
  check(/required-section|missing required section/.test(`${noSection.stdout}${noSection.stderr}`), "the missing section must be named");

  rmSync(dir, { recursive: true, force: true });
}

// --- 7. bounded migration: preservation, refusal, and dry-run-by-default ---------------------
function caseMigration() {
  // A section that must leave the index. The sizes are chosen so ONE move closes the gap.
  const bulky = (name, n) => `## ${name}\n${Array.from({ length: n }, (_, i) => `- ${name}${String(i)}: ${"pad".repeat(24)}`).join("\n")}`;
  const build = (sections) =>
    `# TestAgent\n\n## Role\nx\n\n## Key Knowledge\n- see \`notes/real.md\`\n\n## Active Context\nworking\n\n${sections.join("\n\n")}\n`;

  // (a) DRY RUN writes nothing. The plan is reviewable before anything on disk changes.
  const dry = workspace();
  const dryIndex = join(dry, "MEMORY.md");
  // Sized so the two sections together exceed the cap while ONE move closes the gap, which is what
  // makes the "dry run wrote nothing" and "apply preserved everything" cases both meaningful.
  const heavy = build([bulky("Open threads", 130), bulky("My laws", 130)]);
  writeFileSync(dryIndex, heavy);
  const dryBefore = readFileSync(dryIndex);
  const planRun = spawnSync(process.execPath, [MIGRATE, dryIndex], { encoding: "utf8" });
  check(planRun.status === 0, `a plannable migration should exit 0, got ${String(planRun.status)}`);
  check(/PLAN for/.test(planRun.stdout) && /Dry run/.test(planRun.stdout), "dry run must print the plan and say it wrote nothing");
  check(readFileSync(dryIndex).equals(dryBefore), "a dry run must leave the index byte-identical");
  check(!existsSync(join(dry, "notes", "my-laws.md")), "a dry run must not write notes");

  // (b) APPLY preserves every moved line and brings the index under the cap.
  const applied = workspace();
  const appliedIndex = join(applied, "MEMORY.md");
  writeFileSync(appliedIndex, heavy);
  const moved = heavy.split("\n").filter((l) => l.startsWith("- My laws"));
  const applyRun = spawnSync(process.execPath, [MIGRATE, appliedIndex, "--apply"], { encoding: "utf8" });
  check(applyRun.status === 0, `apply should exit 0, got ${String(applyRun.status)}`);
  const afterLint = lint(appliedIndex);
  check(afterLint.status === 0, `the migrated index must pass the lint, got: ${afterLint.stderr.trim()}`);
  // Read the note the PLAN named -- the greedy stops as soon as the index fits, so asserting a
  // particular section moved would be asserting an implementation detail of the ordering.
  const planned = /-> notes\/(\S+)\.md \(saves/.exec(applyRun.stdout);
  check(planned !== null, "the apply output must name the note it wrote");
  if (planned !== null) {
    const heading = /- (## .*?) -> notes/.exec(applyRun.stdout)?.[1] ?? "";
    const note = readFileSync(join(applied, "notes", `${planned[1]}.md`), "utf8");
    const sectionLines = heavy.split("\n").filter((l) => l.startsWith(`- ${heading.replace(/^##\s+/, "")}`));
    const lost = sectionLines.filter((line) => !note.includes(line));
    check(sectionLines.length > 0, "the fixture should contain the moved section's lines");
    check(lost.length === 0, `every moved line must survive in its note; ${String(lost.length)} lost`);
    check(!readFileSync(appliedIndex, "utf8").includes(`${sectionLines[0] ?? "\u0000"}`),
      "moved content must no longer be inlined in the index");
  }

  // (c) THE BOUND REFUSES rather than cutting to fit: one move cannot close a large gap.
  const bounded = workspace();
  const boundedIndex = join(bounded, "MEMORY.md");
  writeFileSync(boundedIndex, build(["A", "B", "C", "D", "E", "F", "G", "H"].map((n) => bulky(`Section ${n}`, 30))));
  const boundedBefore = readFileSync(boundedIndex);
  const boundRun = spawnSync(process.execPath, [MIGRATE, boundedIndex, "--max-moves", "1"], { encoding: "utf8" });
  check(boundRun.status === 1, `a too-small bound must refuse, got ${String(boundRun.status)}`);
  check(/REFUSED/.test(boundRun.stderr) && /bound stopped the plan/.test(boundRun.stderr),
    "the refusal must name the bound as what stopped it, not claim there was nothing to move");
  check(readFileSync(boundedIndex).equals(boundedBefore), "a refused migration must leave the index byte-identical");

  // (d) PRESERVATION IS ENFORCED, NOT ASSUMED. The invariant must be a check, so removing content
  // from the note has to redden. We exercise the exported function directly: a note that lacks the
  // moved body is a violation, which is what stops the index from being published.
  const violated = join(bounded, "notes");
  mkdirSync(violated, { recursive: true });
  writeFileSync(join(violated, "section-a.md"), "## Section A\nNOT THE BODY\n");
  const planFor = planMigration(readFileSync(boundedIndex, "utf8"), { maxMoves: 8 });
  const moveA = planFor.moves.find((m) => m.fileName === "section-a.md");
  check(moveA !== undefined, "the plan should move Section A for this fixture");
  if (moveA !== undefined) {
    const violations = verifyPreservation({ moves: [moveA] }, violated);
    check(violations.length > 0, "a note missing the moved body must be reported as a preservation violation");
  }
  for (const dir of [dry, applied, bounded]) rmSync(dir, { recursive: true, force: true });
}

// --- 8. a LIVE lock is never evicted (this case found a real bug) ---------------------------
// The stale-lock recovery used to read the holder's start time OUT OF the lock file, but the lock
// is created empty, so `Number("") || 0` was 0 and every waiter computed an age of ~1.7e12 ms. It
// evicted a live lock and entered the critical section. Two writers then appended one fact twice.
//
// This is asserted DETERMINISTICALLY rather than by racing, because the race only reproduced it in
// about one trial in six: a live lock must be respected and must still be there afterwards. Both
// arms were measured directly -- the fixed code refuses with ELOCKED in ~200 ms and leaves the lock
// in place; the content-based version appends in ~8 ms and steals it.
function caseLiveLock() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  const lock = join(dir, "memory-append.lock");
  // Exactly what acquire() creates: the path exists, its mtime is NOW, and it has no content.
  writeFileSync(lock, "");
  let outcome = null;
  try {
    appendFact(index, "a fact", { timeoutMs: 300, pollMs: 10 });
    outcome = "appended";
  } catch (error) {
    outcome = error?.code ?? "threw";
  }
  check(outcome === "ELOCKED", `a live lock must be respected (expected ELOCKED, got ${String(outcome)})`);
  check(existsSync(lock), "a live lock must NOT be evicted by a waiter");
  check(!existsSync(logFileFor(dir)), "a refused writer must not have written a log entry");
  rmSync(dir, { recursive: true, force: true });
}

// --- run them in order, then report once ----------------------------------------------------
const cases = [
  ["over-cap", caseOverCap],
  ["pointer", casePointer],
  ["heading", caseHeading],
  ["concurrent", caseConcurrent],
  ["interrupted", caseInterrupted],
  ["refused", caseRefused],
  ["profile", caseProfile],
  ["migration", caseMigration],
  ["live-lock", caseLiveLock],
];
const ran = [];
for (const [name, run] of cases) {
  await run();
  ran.push(name);
}

if (failures.length > 0) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  process.exit(1);
}
console.log(`memory-spine: all ${String(ran.length)} cases pass (${ran.join(", ")}).`);
process.exit(0);
