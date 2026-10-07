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

import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { planMigration, verifyPreservation } from "../scripts/memory-migrate.mjs";
import { appendFact, republish, acquireLock, releaseHeld, factKey, restoreWithoutClobbering, identityLookupCount } from "../scripts/memory-append.mjs";

const BASE_MS = 1_791_000_000_000;
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
  // Run as a pre-commit hook, git exports GIT_DIR and GIT_INDEX_FILE into this
  // process. Inherited, they point the fixture's git at the real repository:
  // init would set core.bare there, config would write the fixture identity, and
  // add would stage the fixture into the real index. The fixture gets an
  // environment with every GIT_* variable removed.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  const git = (...args) => spawnSync("git", args, { cwd: dir, encoding: "utf8", env });
  git("init", "-q", ".");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "t");
  git("add", "-A");
  git("commit", "-q", "-m", "fixture");
  const checkDoc = () => spawnSync(process.execPath, [ENGINE, "check", "--paths", "MEMORY.md"], { cwd: dir, encoding: "utf8", env });
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
// The stale-lock recovery used to evict a lock whose holder was still running, which let two writers
// enter the critical section and duplicate an append. Liveness is now checked BEFORE age, so a live
// holder is never a candidate for eviction.
//
// THIS CASE ASSERTS THE HARD PROPERTY, ON A HELD LOCK: while a holder is alive, its lock must still
// be THE SAME LOCK afterwards -- not moved aside, not replaced. (What the displaced writer then DOES
// is different: because the lock is a contention tool rather than a correctness dependency, a writer
// that cannot take it proceeds and the atomic claim keeps the append unique. That behaviour is
// covered by `lock-unavailable`.)
function caseLiveLock() {
  const dir = workspace();
  const lockPath = join(dir, "memory-append.lock");
  const held = acquireLock(dir, { timeoutMs: 1_000, staleMs: 60_000 });
  const before = statSync(lockPath);

  // A second writer that would consider the lock stale by age must NOT move a live lock.
  let took = null;
  try {
    took = acquireLock(dir, { timeoutMs: 200, staleMs: 0, pollMs: 10 });
  } catch (error) {
    took = error?.code ?? "threw";
  }
  check(took === "ELOCKED", `a LIVE lock must not be evicted by age, got ${String(took)}`);

  const after = existsSync(lockPath) ? statSync(lockPath) : null;
  check(after !== null, "a live lock must still exist after a failed waiter");
  if (after !== null) {
    check(after.ino === before.ino, "a live lock must be the SAME lock, not moved aside and replaced");
  }
  releaseHeld(held);
  check(!existsSync(lockPath), "releasing the holder must remove the lock");
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
  // A crashed holder: a pid that cannot exist, with a COMPLETE owner record (pid + start time). An
  // incomplete record reads as "unknown" and falls back to age, which would make this fixture
  // exercise the age path rather than the crashed-holder path it is named for. The lock is a FILE
  // whose whole content is the owner record.
  writeFileSync(lock, "999999 1000000000000\n");
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
    let retry = null;
    let retryError = null;
    try {
      retry = appendFact(index, fact);
    } catch (error) {
      retryError = error?.code ?? "threw";
    }
    check(retryError === null, `${name}: retry must not throw, got ${String(retryError)}`);
    const logPath = logFileFor(dir);
    const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
    const entries = log.split("\n").filter((l) => l.includes(fact)).length;
    check(entries === 1, `${name}: retry must leave EXACTLY ONE log entry, got ${String(entries)}`);
    check(readFileSync(index, "utf8").includes(fact), `${name}: retry must leave the fact VISIBLE in the index`);
    // And the retry must be honest about which of the two situations it was in.
    if (retry !== null) {
      if (expectLogged) {
        check(retry.appended === false, `${name}: the fact was already durable, so retry must not append again`);
        check(retry.indexRepaired === true, `${name}: retry must report that it FINISHED the publication`);
      } else {
        check(retry.appended === true, `${name}: the fact was never recorded, so retry must actually append it`);
      }
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
  // A live holder is never evicted (that is the fix that stopped eight writers cascading into
  // mutual eviction). So eviction is made reachable the way the protocol allows it: A's owner record
  // becomes UNATTRIBUTABLE, which is the case where AGE applies because identity cannot be proved.
  // A is still running -- exactly the situation where a careless release removes a successor's lock.
  writeFileSync(join(dir, "memory-append.lock"), "unreadable\n");
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

// --- 15. a TORN log entry is refused, not mistaken for the fact (body, not just key) -------------
// The key alone proves an entry STARTED. A partial write can leave the marker with a truncated body,
// so matching on the key alone would report success for a fact never fully stored. The log is parsed
// and the BODY compared exactly.
function caseTornEntry() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  const body = "the real fact";
  const key = factKey(body);
  mkdirSync(join(dir, "notes"), { recursive: true });
  // A torn entry: the key is present, the body is truncated.
  writeFileSync(logFileFor(dir), `\n## 2026-01-01T00:00:00Z <!-- ${key} -->\n\nthe rea`);
  let code = null;
  try {
    appendFact(index, body);
  } catch (error) {
    code = error?.code ?? "threw";
  }
  check(code === "ETORN", `a torn entry must be refused, not treated as recorded; got ${String(code)}`);
  check(!readFileSync(index, "utf8").includes(body), "a refused torn append must not put the fact in the index");

  // Control: the SAME key with the COMPLETE body IS this fact, and must report already-present.
  writeFileSync(logFileFor(dir), `\n## 2026-01-01T00:00:00Z <!-- ${key} -->\n\n${body}\n`);
  const receipt = appendFact(index, body);
  check(receipt.alreadyPresent === true, "a complete matching entry must report already present");
  check(readFileSync(index, "utf8").includes(body), "an already-present fact must be published to the index");
  rmSync(dir, { recursive: true, force: true });
}

// --- 16. holder identity: unknown is NOT dead, and a provably dead holder IS reclaimed ----------
// A bare pid is not an identity (pids are recycled), so the owner record carries pid AND start time.
// The rule that matters: "could not prove the holder dead" must NEVER become a success.
function caseHolderIdentity() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");

  // (a) MALFORMED claim -> identity unknown -> refuse. This is the boundary that prevents an
  // unattributable claim being silently overwritten.
  const badBody = "fact behind a malformed claim";
  const badKey = factKey(badBody);
  mkdirSync(join(dir, "notes", ".claims"), { recursive: true });
  writeFileSync(join(dir, "notes", ".claims", badKey), "not-a-pid\n");
  let badCode = null;
  try {
    appendFact(index, badBody);
  } catch (error) {
    badCode = error?.code ?? "threw";
  }
  check(badCode === "EINPROGRESS", `a malformed claim must refuse rather than assume death; got ${String(badCode)}`);

  // (b) A pid that cannot exist -> provably dead -> reclaimed and appended for real.
  const dead = workspace();
  const deadIndex = join(dead, "MEMORY.md");
  const deadBody = "fact behind a dead holder";
  const deadKey = factKey(deadBody);
  mkdirSync(join(dead, "notes", ".claims"), { recursive: true });
  writeFileSync(join(dead, "notes", ".claims", deadKey), "999999 1000000000000\n");
  const receipt = appendFact(deadIndex, deadBody);
  check(receipt.appended === true, "a provably dead holder must be reclaimed and the fact appended");
  check(readFileSync(deadIndex, "utf8").includes(deadBody), "the reclaimed append must be visible in the index");

  rmSync(dir, { recursive: true, force: true });
  rmSync(dead, { recursive: true, force: true });
}

// --- 17. an UNAVAILABLE lock must not lose the append ----------------------------------------
// The lock reduces contention; it is NOT what makes an append correct. Correctness comes from the
// atomic per-fact CLAIM and from the index being a fold of the log. An earlier revision treated the
// lock as a correctness dependency and FAILED the append when it could not be taken, which under
// contention meant every writer failing together -- measured at 3 of 30 trials with all eight
// writers refused. Writing nothing is worse than racing, so an unavailable lock now proceeds.
//
// This case asserts the consequence: with another holder on the lock, the append STILL completes,
// writes exactly one log entry, and is visible in the index.
function caseLockUnavailableStillAppends() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  const body = "fact under contention";
  const held = acquireLock(dir, { timeoutMs: 1_000, staleMs: 60_000 });
  let receipt = null;
  let failure = null;
  try {
    receipt = appendFact(index, body, { lockTimeoutMs: 150 });
  } catch (error) {
    failure = error?.code ?? "threw";
  }
  releaseHeld(held);
  check(failure === null, `an unavailable lock must not fail the append, got ${String(failure)}`);
  check(receipt !== null && receipt.appended === true, "the append must still record the fact");
  // Read defensively: if the append failed there is no log, and an ENOENT here would ABORT the run
  // instead of reporting the FAIL above -- hiding every case after this one.
  const logPath = logFileFor(dir);
  const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  const entries = log.split("\n").filter((l) => l.includes(`<!-- ${factKey(body)} -->`)).length;
  check(entries === 1, `exactly one log entry, got ${String(entries)}`);
  check(readFileSync(index, "utf8").includes(body), "the fact must be visible in the index");
  rmSync(dir, { recursive: true, force: true });
}

// --- 18. a claim is released only if it is still OURS ------------------------------------------
// The claim's state is freed on every exit path, but removing it BY PATH can delete a successor's
// live claim -- the same defect class as a path-only lock release, and it produced a real duplicate
// in 1 of 30 trials: a writer that FAILED to take the claim still removed the live holder's claim,
// letting a third writer append the same fact. This asserts the invariant directly: a claim owned by
// someone else survives a failed claimant's cleanup.
function caseClaimOwnership() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  const body = "contended fact";
  const key = factKey(body);
  const claimPath = join(dir, "notes", ".claims", key);

  // Writer A holds the claim; writer B fails to take it and runs its cleanup.
  const a = acquireLock(dir, { timeoutMs: 1_000, staleMs: 60_000 });
  mkdirSync(dirname(claimPath), { recursive: true });
  writeFileSync(claimPath, `${String(process.pid)} ${String(Math.round(Date.now() - process.uptime() * 1_000))}\n`);
  const ownedByA = statSync(claimPath).ino;

  let refused = null;
  try {
    appendFact(index, body, { lockTimeoutMs: 150 });
  } catch (error) {
    refused = error?.code ?? "threw";
  }
  check(refused === "EINPROGRESS", `a live claim must refuse a second writer, got ${String(refused)}`);
  check(existsSync(claimPath), "a failed claimant must NOT remove another writer's live claim");
  if (existsSync(claimPath)) {
    check(statSync(claimPath).ino === ownedByA, "the surviving claim must be the original one");
  }
  releaseHeld(a);
  rmSync(dir, { recursive: true, force: true });
}

// --- 19. the RELEASE replacement window (the interleaving the earlier case never entered) -------
// `successor-release` replaces the holder BEFORE `releaseHeld` starts, so it never reaches the window
// INSIDE the release where a successor can appear. This case drives that interleaving directly by
// swapping the lock between A's acquisition and its release -- the exact sequence CowBoy reproduced.
function caseReleaseReplacementWindow() {
  const dir = workspace();
  const lockPath = join(dir, "memory-append.lock");
  const a = acquireLock(dir, { timeoutMs: 1_000, staleMs: 60_000 });

  // A successor replaces the lock while A still intends to release it: remove A's lock and install
  // B's, exactly as an eviction would.
  rmSync(lockPath, { force: true });
  writeFileSync(lockPath, "999999 1000000000000\n");
  const bIno = statSync(lockPath).ino;
  check(bIno !== a.ino, "the successor lock must be a different lock");

  releaseHeld(a);                                   // A releases, but B owns the path now
  check(existsSync(lockPath), "A's release must NOT remove the successor's lock");
  if (existsSync(lockPath)) {
    check(statSync(lockPath).ino === bIno, "the surviving lock must still be the successor's");
    check(readFileSync(lockPath, "utf8").includes("999999"), "the successor's OWNER RECORD must survive");
  }
  rmSync(dir, { recursive: true, force: true });
}

// --- 20. a lock that EXISTS always carries its holder's identity (the successor-acquire window) --
// This is the observable consequence of creating and writing the lock in ONE atomic call. The earlier
// `mkdirSync` + path-write left a window where a successor could replace the directory and the first
// writer's record landed in the SUCCESSOR's lock -- both then believing they owned it. With an
// exclusive create-and-write there is no instant at which the lock exists without a complete owner
// record, so identity can never be overwritten by a writer that does not own it.
//
// Asserting the INVARIANT (existence implies a complete record) rather than a race: it is what the
// mechanism guarantees, and it is checkable without load.
function caseLockIdentityInseparable() {
  const dir = workspace();
  const lockPath = join(dir, "memory-append.lock");
  const held = acquireLock(dir, { timeoutMs: 1_000, staleMs: 60_000 });

  // The lock exists and its record is COMPLETE -- pid AND start time -- with no window in between.
  const raw = readFileSync(lockPath, "utf8").trim();
  const parts = raw.split(/\s+/);
  check(parts.length === 2, `the lock must carry a complete owner record, got ${JSON.stringify(raw)}`);
  check(Number.isInteger(Number.parseInt(parts[0], 10)) && Number.parseInt(parts[0], 10) > 0,
    "the owner record must begin with a pid");
  check(Number.isInteger(Number.parseInt(parts[1], 10)) && Number.parseInt(parts[1], 10) > 0,
    "the owner record must carry a start time, which is what distinguishes a recycled pid");

  // And the token's inode IS the lock's inode, so a release can prove ownership later.
  check(statSync(lockPath).ino === held.ino, "the returned token must name the lock actually created");

  // A second writer cannot get in, and CRUCIALLY cannot leave ITS identity in the lock.
  const before = readFileSync(lockPath, "utf8");
  let second = null;
  try {
    second = acquireLock(dir, { timeoutMs: 150, pollMs: 10, staleMs: 60_000 });
  } catch (error) {
    second = error?.code ?? "threw";
  }
  check(second === "ELOCKED", `a live lock must refuse a second writer, got ${String(second)}`);
  check(readFileSync(lockPath, "utf8") === before,
    "a refused writer must not modify the holder's owner record");

  releaseHeld(held);
  check(!existsSync(lockPath), "releasing the holder must remove the lock");
  rmSync(dir, { recursive: true, force: true });
}

// --- 21. a displaced lock is restored WITHOUT clobbering whoever holds the path now -------------
// `release-replacement-window` installs B before release starts; it never reaches the gap where a
// THIRD writer C has claimed the free path by the time the displaced lock is restored. `renameSync`
// OVERWRITES its destination, so a clobbering restore destroys C's live lock -- a deterministic
// reproduction, not a theoretical race.
//
// This drives `restoreWithoutClobbering`, which is the transition releaseLock and the eviction path
// both call. An earlier version of this case called `linkSync` itself, which tested JavaScript's
// semantics rather than the code under test: it stayed green when the restore was reverted to a
// clobbering rename.
function caseRestoreDoesNotClobber() {
  const dir = workspace();
  const target = join(dir, "memory-append.lock");
  const tombstone = join(dir, "memory-append.lock.displaced");

  // The path is already held by a third writer; the displaced lock sits at its tombstone.
  writeFileSync(target, "888888 1000000000000\n");
  writeFileSync(tombstone, "777777 1000000000000\n");
  const cIno = statSync(target).ino;

  const published = restoreWithoutClobbering(tombstone, target);
  check(published === false, "restoring into an OCCUPIED path must not publish");
  check(existsSync(target), "the third writer's lock must still exist");
  if (existsSync(target)) {
    check(statSync(target).ino === cIno, "the surviving lock must still be the third writer's");
    check(readFileSync(target, "utf8").includes("888888"), "the third writer's OWNER RECORD must survive intact");
  }
  // AND THE DISPLACED LOCK MUST SURVIVE. When the path is occupied the displaced record is no longer
  // reachable by name, so the tombstone is its ONLY handle; deleting it loses the record entirely.
  // An earlier revision published non-clobberingly and then removed the tombstone anyway, which the
  // card called out -- "leaving the tombstone if the path is occupied", not merely "C survives".
  check(existsSync(tombstone), "the displaced lock must remain recoverable at its tombstone");
  if (existsSync(tombstone)) {
    check(readFileSync(tombstone, "utf8").includes("777777"), "the tombstone must still hold the displaced record");
  }

  // Control: into a FREE path it does publish, so the function is not simply inert.
  const free = workspace();
  const freeTarget = join(free, "memory-append.lock");
  const freeTombstone = join(free, "displaced");
  writeFileSync(freeTombstone, "555555 1000000000000\n");
  const ok = restoreWithoutClobbering(freeTombstone, freeTarget);
  check(ok === true, "restoring into a FREE path must publish");
  check(existsSync(freeTarget) && readFileSync(freeTarget, "utf8").includes("555555"),
    "the restored lock must carry its owner record");
  check(!existsSync(freeTombstone), "a PUBLISHED restore must clean up its tombstone");
  rmSync(dir, { recursive: true, force: true });
  rmSync(free, { recursive: true, force: true });
}

// --- 22. a RECYCLED pid must not wedge a claim --------------------------------------------------
// The owner record stores a pid AND a start time. Parsing the start time and then IGNORING it is not
// a reuse story: a recycled pid is alive, so `kill(pid, 0)` says "alive" and the claim is never
// reclaimed -- it wedges forever, because age applies only to a dead or unparseable identity.
// The comparison against the live process's start time is what distinguishes a recycled pid.
function caseRecycledPid() {
  const dir = workspace();
  const index = join(dir, "MEMORY.md");
  const body = "fact behind a recycled pid";
  const key = factKey(body);
  // The CURRENT process's pid (definitely alive) with a start time from long ago: a recycled pid.
  mkdirSync(join(dir, "notes", ".claims"), { recursive: true });
  writeFileSync(join(dir, "notes", ".claims", key), `${String(process.pid)} 1\n`);
  let receipt = null;
  let code = null;
  try {
    receipt = appendFact(index, body);
  } catch (error) {
    code = error?.code ?? "threw";
  }
  check(code === null, `a recycled pid must not wedge the claim, got ${String(code)}`);
  check(receipt !== null && receipt.appended === true, "the fact must be appended");
  check(readFileSync(index, "utf8").includes(body), "the fact must be visible in the index");

  // Control: the SAME pid with a start time that matches the live process is the real holder, and
  // must NOT be reclaimed.
  const held = workspace();
  const heldIndex = join(held, "MEMORY.md");
  const heldBody = "fact behind a live holder";
  const heldKey = factKey(heldBody);
  mkdirSync(join(held, "notes", ".claims"), { recursive: true });
  const start = Math.round(Date.now() - process.uptime() * 1_000);
  writeFileSync(join(held, "notes", ".claims", heldKey), `${String(process.pid)} ${String(start)}\n`);
  let heldCode = null;
  try {
    appendFact(heldIndex, heldBody);
  } catch (error) {
    heldCode = error?.code ?? "threw";
  }
  check(heldCode === "EINPROGRESS", `a genuinely live holder must refuse, got ${String(heldCode)}`);
  rmSync(dir, { recursive: true, force: true });
  rmSync(held, { recursive: true, force: true });
}

// --- 23. within ONE attempt, polling must not multiply identity lookups ------------------------
// `startTimeOf` spawns `ps`. Doing that once per poll reintroduces the waiter starvation the polling
// design removed. The cache is scoped to a single `acquire()` attempt, so the assertion is made
// WITHIN one attempt: a real timeout makes the poll loop iterate, and the loop must ask at most once
// for the same holder. Counting real spawns is the only observable that separates a working cache
// from "it happened to be quick".
function caseIdentityLookupIsMemoized() {
  const dir = workspace();
  const lockPath = join(dir, "memory-append.lock");
  // A LIVE holder, so `holderState` takes the alive branch and WOULD reach the lookup.
  writeFileSync(lockPath, `${String(process.pid)} ${String(Math.round(Date.now() - process.uptime() * 1_000))}\n`);

  const before = identityLookupCount();
  let code = null;
  try {
    // ONE attempt that actually polls: a real timeout, a short poll interval.
    acquireLock(dir, { timeoutMs: 250, pollMs: 20, staleMs: 600_000 });
  } catch (error) {
    code = error?.code ?? "threw";
  }
  const spent = identityLookupCount() - before;
  check(code === "ELOCKED", `a live lock must end in ELOCKED, got ${String(code)}`);
  check(spent >= 1, "one attempt must take at least one identity observation");
  check(spent <= 2,
    `one attempt polling ~12 times over ONE holder must cost at most one lookup, spent ${String(spent)}`);

  rmSync(dir, { recursive: true, force: true });
}

// --- 24. a RECYCLED pid must be re-observed on a NEW attempt -----------------------------------
// The identity cache must live for ONE attempt and no longer. A process-lifetime cache keyed by the
// owner record freezes the answer, because the record is a HISTORICAL FACT that does not change when
// its author dies and the pid is recycled -- so the successor is permanently attributed to its
// predecessor and the already-recycled lock wedges forever.
//
// `ps` is supplied through a PATH shim whose start time ADVANCES on each invocation, which is exactly
// what a recycled pid looks like from here. The assertion is the consequence, not the mechanism: a
// fresh attempt must SEE the changed identity and reclaim.
function caseRecycledPidReobserved() {
  const dir = workspace();
  const lockPath = join(dir, "memory-append.lock");
  const shimDir = mkdtempSync(join(tmpdir(), "memory-spine-shim-"));
  const statePath = join(shimDir, "count");
  writeFileSync(statePath, "0");

  // A portable shim: emit `ps -o lstart=` shape from a counter, so the reported start time changes.
  const shim = [
    "#!/usr/bin/env node",
    'const fs = require("fs");',
    `const state = ${JSON.stringify(statePath)};`,
    "let n = 0; try { n = Number(fs.readFileSync(state, \"utf8\")); } catch { n = 0; }",
    "n += 1; fs.writeFileSync(state, String(n));",
    `const base = ${String(BASE_MS)};`,
    "const d = new Date(base + n * 100_000);",
    'const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];',
    'const mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];',
    'const pad = (x) => String(x).padStart(2, "0");',
    "console.log(`${days[d.getDay()]} ${mons[d.getMonth()]} ${String(d.getDate()).padStart(2, \" \")} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getFullYear()}`);",
    "",
  ].join("\n");
  const shimPath = join(shimDir, "ps");
  writeFileSync(shimPath, shim);
  chmodSync(shimPath, 0o755);

  const savedPath = process.env.PATH;
  try {
    process.env.PATH = `${shimDir}:${String(savedPath)}`;
    // The record names the ORIGINAL holder: this pid, at the shim's FIRST reported start time.
    writeFileSync(lockPath, `${String(process.pid)} ${String(BASE_MS + 100_000)}\n`);
    // The lock path evicts a RECYCLED holder only once AGE also says so, so the lock is backdated.
    // Without this the case would assert the wrong policy -- a fresh lock is never evicted, recycled
    // or not -- and would fail for a reason unrelated to the cache lifetime.
    const longAgo = new Date(Date.now() - 600_000);
    utimesSync(lockPath, longAgo, longAgo);

    const before = identityLookupCount();
    // ATTEMPT 1: the shim reports the ORIGINAL holder's start time, so identity MATCHES -> alive.
    // An alive holder is never evicted, whatever the age, so this must refuse.
    let first = null;
    try {
      acquireLock(dir, { timeoutMs: 0, staleMs: 30_000 });
    } catch (error) {
      first = error?.code ?? "threw";
    }
    // ATTEMPT 2: the shim reports a start time 100 s later -- the pid was RECYCLED. A fresh attempt
    // must SEE that; a process-lifetime cache returns attempt 1's answer and refuses forever.
    let second = null;
    try {
      const held = acquireLock(dir, { timeoutMs: 0, staleMs: 30_000 });
      releaseHeld(held);
      second = "acquired";
    } catch (error) {
      second = error?.code ?? "threw";
    }
    const spent = identityLookupCount() - before;

    check(first === "ELOCKED", `the original holder must be seen as alive, got ${String(first)}`);
    check(second === "acquired",
      `a NEW attempt must re-observe and reclaim the recycled holder, got ${String(second)}`);
    check(spent >= 2,
      `each attempt must take its own observation, spent ${String(spent)} for two attempts`);
  } finally {
    if (savedPath === undefined) delete process.env.PATH; else process.env.PATH = savedPath;
    rmSync(dir, { recursive: true, force: true });
    rmSync(shimDir, { recursive: true, force: true });
  }
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
  ["torn-entry", caseTornEntry],
  ["holder-identity", caseHolderIdentity],
  ["lock-unavailable", caseLockUnavailableStillAppends],
  ["claim-ownership", caseClaimOwnership],
  ["release-replacement-window", caseReleaseReplacementWindow],
  ["lock-identity-inseparable", caseLockIdentityInseparable],
  ["restore-no-clobber", caseRestoreDoesNotClobber],
  ["recycled-pid", caseRecycledPid],
  ["identity-lookup-memoized", caseIdentityLookupIsMemoized],
  ["recycled-pid-reobserved", caseRecycledPidReobserved],
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
