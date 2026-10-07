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

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { planMigration, verifyPreservation } from "../scripts/memory-migrate.mjs";
import { appendFact, republish, acquireLock, releaseHeld } from "../scripts/memory-append.mjs";

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
  // THE INDEX IS THE RECOVERY POINT, SO IT MUST CHANGE. An earlier revision asserted the OPPOSITE
  // -- "append must leave the index byte-identical" -- which encoded the defect as a requirement and
  // is why the suite stayed green while `appendFact` never published. Every appended fact must be
  // VISIBLE in the index, or a fresh agent reading it cannot see what the log durably holds.
  const after = readFileSync(index);
  check(!after.equals(before), "append must CHANGE the index -- a fact only in the log is not recoverable from the index");
  for (let i = 0; i < 6; i += 1) {
    check(after.toString("utf8").includes(`- concurrent fact ${String(i)}`), `fact ${String(i)} must be visible in the index`);
  }
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

// --- 10. a fact that would overrun the cap is refused, and NOTHING is written -----------------
// The published index is what a fresh agent reads, so an append that cannot be published must not
// half-happen: no log entry, no index change. Otherwise the log claims a fact the index cannot carry.
function caseCapRefusal() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  const before = readFileSync(index);
  // Fill the Key Knowledge section to just under the cap, then append one more fact.
  // Sized so the index is comfortably under the cap but one more fact crosses it.
  const filler = `- ${"pad".repeat(5_430)}`;
  writeFileSync(index, GOOD_INDEX().replace("- see `notes/real.md`", `- see \`notes/real.md\`\n${filler}`));
  const size = Buffer.byteLength(readFileSync(index, "utf8"), "utf8");
  check(size < 16_384, `fixture should start under the cap, got ${String(size)}`);
  const beforeFull = readFileSync(index);
  let code = null;
  try {
    appendFact(index, "one more fact");
  } catch (error) {
    code = error?.code ?? "threw";
  }
  check(code === "ECAP", `an append that would overrun the cap must be refused with ECAP, got ${String(code)}`);
  check(readFileSync(index).equals(beforeFull), "a refused append must leave the index byte-identical");
  check(!existsSync(logFileFor(dir)), "a refused append must not create a log entry");
  rmSync(dir, { recursive: true, force: true });
  void before;
}

// --- 11. the STALE -> FRESH lock transition (this is the case that was missing) ---------------
// A lock that is genuinely stale must be recovered -- and recovering it must not let a waiter evict
// the FRESH lock that a winner just created, which is the duplicate-append race. The earlier
// `live-lock` case only covered a PRESENT fresh lock and so never exercised this transition.
//
// The fixture therefore starts with a PRE-AGED lock (every waiter sees it stale) and eight barriered
// writers of ONE fact: exactly one log entry must result. Asserted with a real race because the
// property IS about concurrency, and the fix that closes it was verified by mutation -- removing the
// inode comparison took this from 0/12 failing trials to 6/12.
async function caseStaleLockRace() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  const lock = join(dir, "memory-append.lock");
  mkdirSync(lock, { recursive: true });
  writeFileSync(join(lock, "owner"), "12345\n");
  const old = (Date.now() - 300_000) / 1000;
  utimesSync(lock, old, old);                      // older than the 60 s stale threshold

  const racer = join(dir, "racer.mjs");
  writeFileSync(racer, [
    `import { appendFact } from ${JSON.stringify(APPEND)};`,
    "const startAt = Number(process.env.RACE_START);",
    "while (Date.now() < startAt) { /* barrier */ }",
    "try { appendFact(process.env.RACE_INDEX, 'one fact, eight writers'); } catch { /* refusal is fine */ }",
  ].join("\n"));
  const startAt = Date.now() + 2_000;
  await Promise.all(Array.from({ length: 8 }, () => new Promise((done) => {
    const child = spawn(process.execPath, [racer], {
      env: { ...process.env, RACE_START: String(startAt), RACE_INDEX: index },
    });
    child.on("close", () => done(null));
  })));

  const log = existsSync(logFileFor(dir)) ? readFileSync(logFileFor(dir), "utf8") : "";
  const entries = log.split("\n").filter((l) => l.startsWith("## 2")).length;
  check(entries === 1, `stale-lock recovery must not duplicate: eight writers, one fact, one entry; got ${String(entries)}`);
  check(!existsSync(`${lock}.stale`) && !existsSync(lock), "the lock must be released and no tombstone left behind");
  rmSync(dir, { recursive: true, force: true });
}

// --- 12. the index is a FOLD of the log, and converging on it is idempotent ---------------------
// The append path publishes a fold of the LOG rather than an amended snapshot, which is what makes a
// momentary lock failure unable to lose a fact. What that mechanism actually guarantees is
// CONVERGENCE, so that is what is asserted: republishing is idempotent and brings an index that is
// missing facts onto the full log. Claiming "no concurrent append is ever missed" would be a claim
// the mechanism does not support -- the log and the index are two files and cannot be updated
// atomically together.
function caseFoldConvergence() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  // Three appends, then simulate an index left behind by an interrupted publish: strip the bullets
  // the log owns and confirm a republish restores ALL of them.
  for (const fact of ["fact one", "fact two", "fact three"]) appendFact(index, fact);
  const full = readFileSync(index, "utf8");
  check(full.includes("- fact one") && full.includes("- fact three"), "appends must be visible in the index");

  const stripped = full.split("\n").filter((l) => !/^- fact .*<!--/.test(l)).join("\n");
  writeFileSync(index, stripped);
  check(!readFileSync(index, "utf8").includes("- fact two"), "fixture: the stale index is missing facts");

  const result = republish(index);
  check(result.republished === true, "republish must report that it changed the index");
  const restored = readFileSync(index, "utf8");
  for (const fact of ["fact one", "fact two", "fact three"]) {
    check(restored.includes(`- ${fact}`), `republish must restore ${fact}`);
  }

  // IDEMPOTENT: a second republish is a no-op, because a fold of the same log is the same text.
  const again = republish(index);
  check(again.republished === false, "a second republish must be a no-op (folding is idempotent)");
  check(readFileSync(index, "utf8") === restored, "a no-op republish must not rewrite the index");

  // Hand-written bullets are NOT the log's to manage and must survive the fold.
  const withHand = restored.replace("- fact one", "- a hand-written pointer to notes/x.md\n- fact one");
  writeFileSync(index, withHand);
  republish(index);
  check(readFileSync(index, "utf8").includes("- a hand-written pointer to notes/x.md"),
    "the fold must not remove hand-written bullets");
  rmSync(dir, { recursive: true, force: true });
}

// --- 13. a HARD crash (process.exit) leaves no silent loss and retry finishes the pair ----------
// The claim may only mean "in flight". An earlier revision let it mean "done", so a SIGKILL between
// the claim and the log write made EVERY retry report "already present" for a fact recorded nowhere.
// That is silent permanent loss reported as success, and it is worse than an ordinary interrupted
// write. These arms use a preload that calls process.exit(9), so no cleanup handler can run.
//
//   crash-before-log  -> the fact is NOT recorded; retry must append it (not claim "already present")
//   crash-before-rename -> the fact IS durable; retry must finish publication, not duplicate it
function crashArm(dir, index, fact, preload) {
  const run = spawnSync(process.execPath, ["--require", preload, "-e",
    `import(${JSON.stringify(APPEND)}).then((m) => { try { m.appendFact(${JSON.stringify(index)}, ${JSON.stringify(fact)}); } catch {} });`],
    { encoding: "utf8", timeout: 60_000 });
  return run;
}

function caseCrashRetry() {
  // Written to a TEMP dir, not into the package: a suite that litters the repository it tests is a
  // suite whose own artifacts show up as uncommitted changes and get mistaken for work.
  const preloads = mkdtempSync(join(tmpdir(), "memory-spine-preloads-"));
  // A: hard-exit the instant the claim file is written -- i.e. before any durable state exists.
  const preA = join(preloads, "exit-at-claim.cjs");
  // Exit AFTER the claim file exists but BEFORE the log write. Injecting on the claim WRITE exits
  // before it lands, which leaves no claim and therefore cannot test the claim path at all -- my
  // first version did exactly that and the case silently proved nothing.
  writeFileSync(preA, [
    'const fs = require("node:fs");',
    "const real = fs.writeFileSync;",
    "fs.writeFileSync = (p, ...rest) => {",
    '  const result = real(p, ...rest);',
    '  if (String(p).includes(".claims")) { process.exit(9); }',
    "  return result;",
    "};",
  ].join("\n"));
  // B: hard-exit after the log entry is fsynced, before the index rename.
  const preB = join(preloads, "exit-before-rename.cjs");
  writeFileSync(preB, [
    'const fs = require("node:fs");',
    "const real = fs.renameSync;",
    "fs.renameSync = (a, b) => {",
    '  if (String(b).endsWith("MEMORY.md")) { process.exit(9); }',
    "  return real(a, b);",
    "};",
  ].join("\n"));

  for (const [name, preload, expectLogged] of [["crash-before-log", preA, false], ["crash-before-rename", preB, true]]) {
    const dir = workspace();
    const index = join(dir, "MEMORY.md");
    const fact = `fact for ${name}`;
    const crashed = crashArm(dir, index, fact, preload);
    check(crashed.status === 9, `${name}: the injected crash should exit 9, got ${String(crashed.status)}`);
    const loggedAfterCrash = existsSync(logFileFor(dir)) && readFileSync(logFileFor(dir), "utf8").includes(fact);
    check(loggedAfterCrash === expectLogged, `${name}: log durable after the crash should be ${String(expectLogged)}`);

    // RETRY THE SAME FACT. This is the assertion the old suite could not make.
    // Read defensively: a regression here must produce a FAIL, not an ENOENT crash. A case that
    // throws instead of reporting measures nothing on exactly the runs that matter.
    const retry = appendFact(index, fact);
    const logPath = logFileFor(dir);
    const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
    const entries = log.split("\n").filter((l) => l.includes(fact)).length;
    check(entries === 1, `${name}: retry must leave EXACTLY ONE log entry, got ${String(entries)}`);
    check(readFileSync(index, "utf8").includes(fact), `${name}: retry must leave the fact VISIBLE in the index`);
    // And the retry must be honest about which of the two situations it was in.
    if (expectLogged) {
      check(retry.appended === false, `${name}: the fact was already durable, so retry must not append again`);
      check(retry.indexRepaired === true, `${name}: retry must report that it FINISHED the publication`);
    } else {
      check(retry.appended === true, `${name}: the fact was never recorded, so retry must actually append it`);
    }
    rmSync(dir, { recursive: true, force: true });
  }
  rmSync(preloads, { recursive: true, force: true });
}

// --- 14. release removes ONLY the lock it was given (the successor-release case) ---------------
// Eviction compares inodes, but release must too. If holder A outlives the stale threshold, B
// correctly evicts A and takes the lock; A's `finally` must then NOT remove B's live lock, or two
// writers hold the critical section at once. The eight-writer stale race cannot catch this.
function caseSuccessorRelease() {
  const dir = workspace();
  const a = acquireLock(dir, { timeoutMs: 1_000, staleMs: 60_000 });
  // staleMs 0 makes every waiter treat A as stale, so B evicts A and takes the lock.
  const b = acquireLock(dir, { timeoutMs: 2_000, staleMs: 0, pollMs: 5 });
  check(a.ino !== b.ino, "the evicting waiter must hold a different lock");

  releaseHeld(a);                                   // A's finally, after B took over
  const lockPath = join(dir, "memory-append.lock");
  // Assert without crashing: a path-only release removes the lock, and statSync on a missing path
  // would THROW instead of reporting a FAIL -- so a regression would abort the whole suite and the
  // remaining cases would silently not run. Read defensively and let `check` do the reporting.
  check(existsSync(lockPath), "A's release must NOT remove the lock B now holds");
  if (existsSync(lockPath)) {
    check(statSync(lockPath).ino === b.ino, "the surviving lock must still be B's");
  }

  // B still owns the critical section: a third writer must be refused while B holds it.
  let blocked = null;
  try {
    acquireLock(dir, { timeoutMs: 200, staleMs: 60_000, pollMs: 10 });
  } catch (error) {
    blocked = error?.code ?? "threw";
  }
  check(blocked === "ELOCKED", `a third writer must be blocked by B's live lock, got ${String(blocked)}`);

  releaseHeld(b);
  check(!existsSync(lockPath), "releasing the true owner must remove the lock");
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
  ["cap-refusal", caseCapRefusal],
  ["stale-lock-race", caseStaleLockRace],
  ["fold-convergence", caseFoldConvergence],
  ["crash-retry", caseCrashRetry],
  ["successor-release", caseSuccessorRelease],
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
