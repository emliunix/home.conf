#!/usr/bin/env node
// Deterministic cases for the gate-lock publish window and ownership transitions.
//
// WHY THIS FILE EXISTS. The landed suite missed the live-holder eviction because its fixture
// wrote a FULLY FORMED lock before the waiter started, so the empty publish window was never
// presented. These cases drive that window directly, and the identity-checked quarantine and
// release paths, by importing the module rather than racing the CLI.
//
// Every case is shown to FIRE on the defect it targets; the mutations live in
// `check-lock-mutations.mjs`.

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as defaultLock from "../scripts/gate-lock.mjs";

// When the harness points the case file at a seeded copy, import that module instead so the
// direct-call cases exercise the same object the CLI cases do.
const lockModule = process.env.GATE_LOCK_SCRIPT
  ? await import(process.env.GATE_LOCK_SCRIPT)
  : defaultLock;
const {
  EXIT,
  LOCK_STATE,
  lockIsReclaimable,
  observeLock,
  quarantine,
  reclaimAgedClaim,
  release,
  withRecoveryClaim,
} = lockModule;

// Overridable so the mutation harness can point one case file at a seeded copy. Rewriting the
// test source per mutation is fragile; env indirection keeps a single source of truth.
const SCRIPT =
  process.env.GATE_LOCK_SCRIPT ??
  fileURLToPath(new URL("../scripts/gate-lock.mjs", import.meta.url));
const PRELOAD =
  process.env.GATE_LOCK_PRELOAD ??
  fileURLToPath(
    new URL("./preloads/pause-before-publish.cjs", import.meta.url),
  );
// The boundary preload records every mutation of the shared path and can inject a successor at
// a named boundary, which is how the release and quarantine windows are driven deterministically.
const SWAP_PRELOAD =
  process.env.GATE_SWAP_PRELOAD ??
  fileURLToPath(new URL("./preloads/swap-at-boundary.cjs", import.meta.url));
const PARK_PRELOAD =
  process.env.GATE_PARK_PRELOAD ??
  fileURLToPath(
    new URL("./preloads/park-at-recovery-rename.cjs", import.meta.url),
  );
const INJECT_PRELOAD =
  process.env.GATE_INJECT_PRELOAD ??
  fileURLToPath(
    new URL("./preloads/inject-successor-claim.cjs", import.meta.url),
  );

const failures = [];

function fail(message) {
  failures.push(message);
}

function freshDir() {
  return mkdtempSync(join(tmpdir(), "gate-lock-case-"));
}

/**
 * Run the wrapper with the boundary preload installed, returning its parsed output and the
 * mutation log the preload wrote. `env` carries GATE_BOUNDARY / GATE_SUCCESSOR / GATE_LOCK_PATH.
 */
function runWithBoundaryPreload(
  lockFile,
  extraEnv,
  { timeoutMs = 600, pollMs = 10 } = {},
) {
  const dir = dirname(lockFile);
  const log = join(dir, "boundary.log");
  writeFileSync(log, "");
  return new Promise((resolveRun) => {
    const child = spawn(
      process.execPath,
      [
        "--require",
        SWAP_PRELOAD,
        SCRIPT,
        "--lock-file",
        lockFile,
        "--timeout-ms",
        String(timeoutMs),
        "--poll-ms",
        String(pollMs),
        "--",
        "true",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          GATE_LOG: log,
          GATE_LOCK_PATH: lockFile,
          ...extraEnv,
        },
      },
    );
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("close", (code) => {
      let parsed;
      try {
        parsed = JSON.parse(stdout.trim().split("\n")[0]);
      } catch {
        parsed = undefined;
      }
      let events;
      try {
        events = readFileSync(log, "utf8").trim().split("\n").filter(Boolean);
      } catch {
        events = [];
      }
      resolveRun({ code, parsed, events });
    });
  });
}

/** Poll `predicate` until true or `timeoutMs` elapses. */
async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await delay(10);
  }
  return false;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

/** Run the wrapper against `lockFile` and resolve its parsed output. */
function runWrapper(
  lockFile,
  { timeoutMs = 600, pollMs = 10, staleMs, command = ["true"], env } = {},
) {
  return new Promise((resolveRun) => {
    const child = spawn(
      process.execPath,
      [
        SCRIPT,
        "--lock-file",
        lockFile,
        "--timeout-ms",
        String(timeoutMs),
        "--poll-ms",
        String(pollMs),
        ...(staleMs === undefined ? [] : ["--stale-ms", String(staleMs)]),
        "--",
        ...command,
      ],
      { stdio: ["ignore", "pipe", "pipe"], env: env ?? process.env },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      let parsed;
      try {
        parsed = JSON.parse(stdout.trim().split("\n")[0]);
      } catch {
        parsed = undefined;
      }
      resolveRun({ code, stdout, stderr, parsed });
    });
  });
}

// ---------------------------------------------------------------- state classification

function checkClassification() {
  const dir = freshDir();
  const path = join(dir, "gate.lock");

  const missing = observeLock(path);
  if (missing.state !== LOCK_STATE.missing) {
    fail(`absent lock should observe 'missing', got '${missing.state}'`);
  }
  if (lockIsReclaimable(missing, 1000)) {
    fail(
      "a missing lock must not be reclaimable: there is no holder to displace",
    );
  }

  writeFileSync(path, ""); // exactly what openSync("wx") leaves, momentarily
  const empty = observeLock(path);
  if (empty.state !== LOCK_STATE.unparseable) {
    fail(`empty lock should observe 'unparseable', got '${empty.state}'`);
  }
  if (lockIsReclaimable(empty, 60_000)) {
    fail("a FRESH unparseable lock must be honoured, not reclaimed");
  }
  if (!lockIsReclaimable(empty, 60_000, Date.now() + 61_000)) {
    fail(
      "an AGED unparseable lock must become reclaimable, or a corrupt file wedges the gate",
    );
  }

  writeFileSync(path, JSON.stringify({ token: "t", pid: process.pid }));
  const parsed = observeLock(path);
  if (parsed.state !== LOCK_STATE.parsed) {
    fail(`valid lock should observe 'parsed', got '${parsed.state}'`);
  }
  if (lockIsReclaimable(parsed, 60_000)) {
    fail("a valid lock held by a live pid must be honoured");
  }
  if (!lockIsReclaimable(parsed, 60_000, Date.now() + 61_000)) {
    fail("an aged valid lock must become reclaimable");
  }
  writeFileSync(path, JSON.stringify({ token: "t", pid: 2 ** 30 }));
  const dead = observeLock(path);
  if (!lockIsReclaimable(dead, 60_000)) {
    fail("a lock whose holder is dead must be reclaimable");
  }
}

// ------------------------------------------------- no observable empty window (pre-publish pause)

/**
 * The lock is published atomically, so the lock path is never observable in a partial state.
 *
 * Holder A is paused with its staging file complete and the publish NOT yet attempted, and
 * waiter B runs during that pause. The property under test is that `lockPath` is only ever
 * ABSENT or COMPLETE — never present-and-empty — which is what removes the eviction window.
 * B may legitimately acquire a free lock, so "B did not enter" would be the wrong assertion;
 * what must hold is that no waiter saw an unparseable lock and that the two commands never
 * overlapped.
 */
async function checkNoEmptyPublishWindow() {
  const dir = freshDir();
  const path = join(dir, "gate.lock");
  const pauseLog = join(dir, "pause.log");
  const execLog = join(dir, "exec.log");
  const release = join(dir, "release");
  writeFileSync(pauseLog, "");
  writeFileSync(execLog, "");

  // Each holder marks its command's start/end in a shared log, so overlap is measured from the
  // command's own execution, not from the wrapper's timestamps.
  const command = [
    process.execPath,
    "-e",
    'const{appendFileSync}=require("fs");appendFileSync(process.env.LOCK_EXEC_LOG,"S\\n");const t=Date.now();while(Date.now()-t<100){};appendFileSync(process.env.LOCK_EXEC_LOG,"E\\n");',
  ];
  const holder = spawn(
    process.execPath,
    [
      "--require",
      fileURLToPath(
        new URL("./preloads/pause-before-publish.cjs", import.meta.url),
      ),
      SCRIPT,
      "--lock-file",
      path,
      "--timeout-ms",
      "20000",
      "--poll-ms",
      "20",
      "--",
      ...command,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        LOCK_EXEC_LOG: execLog,
        GATE_LOCK_PAUSE_LOG: pauseLog,
        GATE_LOCK_PAUSE_PATH: path,
        GATE_LOCK_PAUSE_RELEASE: release,
        GATE_LOCK_PAUSE_MS: "15000",
      },
    },
  );
  let holderOut = "";
  holder.stdout.on("data", (chunk) => {
    holderOut += chunk;
  });

  // The corrected lock marks "STAGING_WRITTEN" (paused before an atomic publish); a
  // non-atomic mutation marks "CREATED_THEN_EMPTY" (paused after an exclusive create).
  const paused = await waitFor(
    () =>
      /STAGING_WRITTEN|CREATED_THEN_EMPTY/.test(readFileSync(pauseLog, "utf8")),
    5000,
  );
  if (!paused) {
    fail("holder did not reach the pre-publish pause");
    holder.kill();
    return;
  }

  // The pause point: staging is complete, the publish has not been attempted. Poll hard for an
  // unparseable observation — that is exactly the state the landed lock exposed.
  let unparseable = 0;
  let observations = 0;
  for (let i = 0; i < 60; i += 1) {
    observations += 1;
    if (observeLock(path).state === LOCK_STATE.unparseable) unparseable += 1;
    await delay(4);
  }
  if (unparseable > 0) {
    fail(
      `an empty lock was observable at the path during the pre-publish pause (${unparseable}/${observations} polls)`,
    );
  }

  // B runs during the pause. Whether it acquires a free lock or waits is immaterial; it must
  // not corrupt the state or produce an overlap.
  const waiter = await runWrapper(path, {
    timeoutMs: 6000,
    pollMs: 10,
    command,
    env: { ...process.env, LOCK_EXEC_LOG: execLog },
  });
  if (!["completed", "lock_timeout"].includes(waiter.parsed?.state)) {
    fail(
      `waiter produced an unexpected state during the pause: ${waiter.parsed?.state}`,
    );
  }

  writeFileSync(release, "");
  await new Promise((resolveClose) => holder.on("close", resolveClose));
  if (!holderOut.includes('"state":"completed"')) {
    fail(
      `holder did not complete after release: ${holderOut.trim() || "no output"}`,
    );
  }

  let current = 0;
  let max = 0;
  for (const line of readFileSync(execLog, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)) {
    if (line === "S") {
      current += 1;
      if (current > max) max = current;
    } else if (line === "E") current -= 1;
  }
  if (max > 1)
    fail(`holder and waiter executed concurrently (max concurrent = ${max})`);

  // The staging file must not survive the holder.
  const leftovers = readdirSync(dir).filter((name) =>
    name.includes(".staging."),
  );
  if (leftovers.length > 0) {
    fail(`staging files were not cleaned up: ${leftovers.join(", ")}`);
  }
}

/** A malformed lock is installed directly: it must be honoured until the age threshold. */
async function checkMalformedLockWaits() {
  const dir = freshDir();
  const path = join(dir, "gate.lock");
  writeFileSync(path, "{ this is not json");
  const waited = await runWrapper(path, { timeoutMs: 300, pollMs: 10 });
  if (waited.parsed?.state !== "lock_timeout") {
    fail(
      `a fresh malformed lock must be honoured; got ${waited.parsed?.state}`,
    );
  }
  let present;
  try {
    present = readFileSync(path, "utf8");
  } catch {
    present = undefined;
  }
  if (present !== "{ this is not json") {
    fail("a fresh malformed lock must not be displaced");
    // It was displaced, so the aged-recovery half cannot run against the same path. Restore the
    // fixture so that half still measures something, and let the failure above stand.
    writeFileSync(path, "{ this is not json");
  }

  // Aged, it must become recoverable.
  const old = Date.now() / 1000 - 3600;
  utimesSync(path, old, old);
  const recovered = await runWrapper(path, {
    timeoutMs: 2000,
    pollMs: 10,
    staleMs: 1000,
  });
  if (recovered.parsed?.state !== "completed") {
    fail(
      `an aged malformed lock must be recoverable; got ${recovered.parsed?.state}`,
    );
  }
}

// ---------------------------------------------------------------- identity-checked quarantine

function checkQuarantineIdentity() {
  const dir = freshDir();
  const path = join(dir, "gate.lock");

  // The measured lock is displaced.
  writeFileSync(path, JSON.stringify({ token: "measured", pid: 2 ** 30 }));
  const measured = observeLock(path);
  if (!quarantine(path, measured))
    fail("quarantine should displace the identity it measured");

  // A successor published between measurement and rename must SURVIVE.
  writeFileSync(path, JSON.stringify({ token: "measured", pid: 2 ** 30 }));
  const staleObservation = observeLock(path);
  const successor = join(dir, "successor");
  writeFileSync(
    successor,
    JSON.stringify({ token: "successor", pid: process.pid }),
  );
  renameSync(successor, path); // the successor now occupies the path
  const displaced = quarantine(path, staleObservation);
  if (displaced) {
    fail(
      "quarantine must not report success when the identity changed under it",
    );
  }
  let present;
  try {
    present = JSON.parse(readFileSync(path, "utf8")).token;
  } catch {
    present = undefined;
  }
  if (present !== "successor") {
    fail(`the successor lock must survive quarantine; found token=${present}`);
  }
}

// ---------------------------------------------------------------- ownership-safe release

function checkReleaseOwnership() {
  const dir = freshDir();
  const path = join(dir, "gate.lock");
  // Read the token at a path, or undefined when there is no readable lock there. Release must
  // never crash the caller, so every assertion reads through this.
  const tokenAt = (target) => {
    try {
      return JSON.parse(readFileSync(target, "utf8"))?.token;
    } catch {
      return undefined;
    }
  };

  writeFileSync(path, JSON.stringify({ token: "ours", pid: process.pid }));
  release(path, "ours");
  if (tokenAt(path) !== undefined) {
    fail("release must remove the lock it owns");
  }

  // A different holder's token must not be removable.
  writeFileSync(path, JSON.stringify({ token: "theirs", pid: process.pid }));
  release(path, "ours");
  if (tokenAt(path) !== "theirs") {
    fail("release must not remove another holder's lock");
  }

  // An unparseable lock is not provably ours.
  writeFileSync(path, "not json");
  release(path, "ours");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    raw = undefined;
  }
  if (raw !== "not json") {
    fail(
      "release must leave an unparseable lock alone: it is not provably ours",
    );
  }
  try {
    unlinkSync(path);
  } catch {
    // Already gone.
  }
}

// ---------------------------------------------------------------- missing-lock acquisition

async function checkMissingLockAcquires() {
  const dir = freshDir();
  const result = await runWrapper(join(dir, "gate.lock"), { timeoutMs: 400 });
  if (result.parsed?.state !== "completed") {
    fail(
      `acquisition with no lock present must succeed; got ${result.parsed?.state}`,
    );
  }
}

// ---------------------------------------------------------------- no two holders at once

async function checkSerialization() {
  const dir = freshDir();
  const path = join(dir, "gate.lock");
  const log = join(dir, "log");
  writeFileSync(log, "");
  const command = [
    process.execPath,
    "-e",
    'const{appendFileSync}=require("fs");appendFileSync(process.env.LOCK_LOG,"S\\n");const t=Date.now();while(Date.now()-t<150){};appendFileSync(process.env.LOCK_LOG,"E\\n");',
  ];
  const runs = Array.from(
    { length: 6 },
    () =>
      new Promise((resolveRun) => {
        const child = spawn(
          process.execPath,
          [
            SCRIPT,
            "--lock-file",
            path,
            "--timeout-ms",
            "15000",
            "--poll-ms",
            "1",
            "--",
            ...command,
          ],
          {
            stdio: ["ignore", "ignore", "ignore"],
            env: { ...process.env, LOCK_LOG: log },
          },
        );
        child.on("close", resolveRun);
      }),
  );
  await Promise.all(runs);
  let current = 0;
  let max = 0;
  for (const line of readFileSync(log, "utf8").trim().split("\n")) {
    if (line === "S") {
      current += 1;
      if (current > max) max = current;
    } else if (line === "E") current -= 1;
  }
  if (max > 1)
    fail(`two holders executed concurrently (max concurrent = ${max})`);
}

// ------------------------- the recovery claim cannot delete a successor's claim (review F5)

/**
 * The recovery claim serializes stale recovery. Its own aged-claim cleanup must therefore not be
 * path-based: `rmdir(claim)` after an age check can delete a successor's FRESH claim that appeared
 * in between, and then two decisions run — the same overlap the claim exists to prevent, one layer
 * down.
 *
 * Two properties are asserted: a claim that is not aged is never displaced, and displacing an aged
 * claim moves it aside with an identity check rather than removing whatever is at the path.
 */
function checkClaimReclaimCannotDeleteSuccessor() {
  // 0. BEHAVIOURAL, and the load-bearing assertion: the claim the MODULE creates must be
  //    non-empty, so no other process's path-based removal can delete it. Asserted from inside the
  //    decision, where the claim is held — this measures the module's own claim, not a fixture's.
  {
    const dir = freshDir();
    const lock = join(dir, "gate.lock");
    const claim = `${lock}.recovery`;
    let claimWasNonEmpty = false;
    let entryCount = 0;
    let pathRemovable = false;
    const outcome = withRecoveryClaim(lock, 60_000, () => {
      try {
        entryCount = readdirSync(claim).length;
        claimWasNonEmpty = entryCount > 0;
      } catch {
        claimWasNonEmpty = false;
      }
      try {
        rmdirSync(claim);
        pathRemovable = true;
      } catch {
        pathRemovable = false;
      }
      return "decided";
    });
    if (outcome !== "decided") {
      fail(
        `the caller could not decide under its own claim (outcome=${outcome})`,
      );
    }
    if (!claimWasNonEmpty) {
      fail(
        `the recovery claim is empty while held (${entryCount} entries), so a successor's claim can be deleted by rmdir`,
      );
    }
    if (pathRemovable) {
      fail(
        "the held recovery claim was removable by rmdir, so a successor claim can be deleted",
      );
    }
  }

  // The identity-checked reclaim is the fix under test: an object without it can only do the
  // path-based removal, so its absence is a finding rather than a reason to crash.
  if (typeof reclaimAgedClaim !== "function") {
    fail(
      "the lock exposes no identity-checked claim reclamation, so aged-claim cleanup must be path-based and can delete a successor's claim",
    );
    return;
  }

  const dir = freshDir();
  const claim = join(dir, "gate.lock.recovery");
  const mkClaim = (token) => {
    mkdirSync(claim);
    writeFileSync(
      join(claim, "owner"),
      `${JSON.stringify({ token, pid: process.pid })}\n`,
    );
  };

  // 1. A FRESH claim belongs to a live reclaimer: it must not be displaced.
  mkClaim("fresh-successor");
  if (reclaimAgedClaim(claim, 60_000)) {
    fail(
      "a fresh recovery claim was displaced; another reclaimer may still be deciding",
    );
  }
  if (!existsSync(join(claim, "owner"))) {
    fail("a fresh recovery claim lost its owner file");
  }

  // 2. A valid claim must not be removable by path at all, so no age race can delete it.
  let removedByPath = false;
  try {
    rmdirSync(claim);
    removedByPath = true;
  } catch (error) {
    if (error?.code !== "ENOTEMPTY") removedByPath = true;
  }
  if (removedByPath) {
    fail(
      "a valid recovery claim was removable by rmdir, so a successor claim can be deleted",
    );
  }

  // 3. An AGED claim is displaced by moving it aside and verifying the identity, and the path is
  //    freed for the caller — but the check happens against what was measured, not the path.
  //    A path-based implementation may already have removed the claim above, so recreate it
  //    rather than crashing: the assertion below still has to hold.
  if (!existsSync(claim)) {
    fail(
      "the claim was removed before the aged-reclaim step, which only a path-based removal does",
    );
    mkClaim("aged-reclaimer");
  }
  const aged = Date.now() / 1000 - 3600;
  utimesSync(claim, aged, aged);
  if (!reclaimAgedClaim(claim, 60_000)) {
    fail(
      "an aged recovery claim was not displaced, so a dead reclaimer would wedge recovery",
    );
  }
  if (existsSync(claim)) {
    fail("the aged claim still occupies the path after reclamation");
  }
}

// ------------- a successor claim in the reclaim window survives, one decision runs (review F5b)

/**
 * The claim's aged-claim cleanup must not be path-based. This case installs a SUCCESSOR claim in
 * the exact window between the age measurement and the displacement — the interleaving a
 * compare-and-swap-free removal loses — and asserts two things: the successor's OWN directory
 * (matched by inode) still occupies the path, and no second recovery decision ran.
 *
 * A parking test cannot express this, and neither can a fixture-based one: the successor has to
 * appear inside the window and be the shape the module itself publishes. Both shapes are run,
 * because an EMPTY successor is protected only by the window being closed, whereas a non-empty
 * one is also protected by `rmdir` refusing it — so testing only the non-empty shape would pass
 * against a path-based implementation for the wrong reason.
 */
async function checkSuccessorClaimInReclaimWindow() {
  for (const shape of ["empty", "nonempty"]) {
    const dir = freshDir();
    const lock = join(dir, "gate.lock");
    const claim = `${lock}.recovery`;
    const injectLog = join(dir, "inject.log");
    mkdirSync(claim);
    writeFileSync(
      join(claim, "owner"),
      `${JSON.stringify({ token: "dead-Q", pid: 2 ** 30 })}\n`,
    );
    const agedEpoch = Date.now() / 1000 - 3600;
    utimesSync(claim, agedEpoch, agedEpoch);
    writeFileSync(injectLog, "");

    const driver = `
      import { withRecoveryClaim } from ${JSON.stringify(SCRIPT)};
      let decisions = 0;
      const outcome = withRecoveryClaim(${JSON.stringify(lock)}, 60000, () => {
        decisions += 1;
        return "decided";
      });
      process.stdout.write(JSON.stringify({ outcome, decisions }));
    `;
    const result = await new Promise((resolveRun) => {
      const child = spawn(
        process.execPath,
        ["--require", INJECT_PRELOAD, "--input-type=module", "-e", driver],
        {
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            GATE_CLAIM_PATH: claim,
            GATE_INJECT_LOG: injectLog,
            GATE_SUCCESSOR_SHAPE: shape,
          },
        },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("close", (code) => resolveRun({ code, stdout, stderr }));
    });
    if (result.code !== 0) {
      fail(
        `the reclaim-window driver failed (shape=${shape}): ${result.stderr.trim() || `exit ${result.code}`}`,
      );
      continue;
    }

    const injected = /ino=(\d+)/.exec(readFileSync(injectLog, "utf8"));
    if (!injected) {
      fail(
        `no successor claim was injected in the reclaim window (shape=${shape})`,
      );
      continue;
    }
    let finalIno;
    try {
      finalIno = statSync(claim).ino;
    } catch {
      finalIno = undefined;
    }
    if (finalIno === undefined || Number(injected[1]) !== finalIno) {
      fail(
        `the successor's claim was deleted from the path during aged-claim reclaim (shape=${shape})`,
      );
    }
    let parsed;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      parsed = undefined;
    }
    if (parsed?.decisions !== 0) {
      fail(
        `a competing recovery decision ran while a successor owned the claim (shape=${shape}, decisions=${parsed?.decisions})`,
      );
    }
  }
}

// --------------------------------- stale recovery is serialized against a live successor (F4)

/**
 * Stale recovery observes a lock and then displaces it. If those two steps are not serialized
 * against other reclaimers, a second process can reclaim the stale lock, publish, and START
 * RUNNING during the first process's decision — which then renames that live holder aside and
 * frees the path for a third holder. Two commands then run at once.
 *
 * The reclaimer is parked at the rename boundary, and the assertion is that NO other holder
 * starts while it is parked. That is the property, not the bytes: the post-rename inode check
 * restores a successor's file only after mutual exclusion is already lost.
 */
async function checkStaleRecoveryIsSerialized() {
  const dir = freshDir();
  const path = join(dir, "gate.lock");
  const execLog = join(dir, "exec.log");
  const parkSignal = join(dir, "PARKED");
  writeFileSync(execLog, "");
  // A genuinely stale lock: a dead pid, so it is reclaimable on sight.
  writeFileSync(
    path,
    `${JSON.stringify({ token: "stale-A", pid: 2 ** 30 })}\n`,
  );

  const marker = (tag, holdMs) => [
    process.execPath,
    "-e",
    `const{appendFileSync}=require("fs");appendFileSync(process.env.LOCK_LOG,"${tag}_START\\n");const t=Date.now();while(Date.now()-t<${holdMs}){};appendFileSync(process.env.LOCK_LOG,"${tag}_END\\n");`,
  ];

  const reclaimer = spawn(
    process.execPath,
    [
      "--require",
      PARK_PRELOAD,
      SCRIPT,
      "--lock-file",
      path,
      "--timeout-ms",
      "20000",
      "--poll-ms",
      "15",
      "--",
      ...marker("R", 100),
    ],
    {
      stdio: ["ignore", "ignore", "ignore"],
      env: {
        ...process.env,
        LOCK_LOG: execLog,
        GATE_LOCK_PATH: path,
        GATE_PARK_SIGNAL: parkSignal,
        GATE_PARK_MS: "20000",
      },
    },
  );

  const parked = await waitFor(() => existsSync(parkSignal), 7000);
  if (!parked) {
    fail("the reclaimer never reached the displacement boundary");
    reclaimer.kill("SIGKILL");
    return;
  }

  const second = spawn(
    process.execPath,
    [
      SCRIPT,
      "--lock-file",
      path,
      "--timeout-ms",
      "20000",
      "--poll-ms",
      "15",
      "--",
      ...marker("S", 300),
    ],
    {
      stdio: ["ignore", "ignore", "ignore"],
      env: { ...process.env, LOCK_LOG: execLog },
    },
  );

  await delay(2500);
  const secondStarted = readFileSync(execLog, "utf8").includes("S_START");

  // Release the park either way, then reap, so a failing run cannot wedge the suite.
  writeFileSync(`${parkSignal}.go`, "");
  reclaimer.kill("SIGKILL");
  second.kill("SIGKILL");
  await delay(300);

  if (secondStarted) {
    fail(
      "a second holder started while the reclaimer was deciding a stale displacement, so the reclaimer could rename a live holder aside",
    );
  }
}

// ------------------------------------------------ release cannot delete a successor (review F1)

/**
 * Release measures the held descriptor, then removes the lock. If the path is replaced between
 * the measurement and the removal, a check-then-unlink release deletes the SUCCESSOR. The
 * preload injects a successor at exactly that boundary, and the assertion reads the mutation log
 * rather than the surviving bytes: the shared path must never be unlinked at all, because the
 * holder claims the entry by renaming it aside and verifies the moved inode.
 */
async function checkReleaseDoesNotDeleteSuccessor() {
  const dir = freshDir();
  const path = join(dir, "gate.lock");
  const successor = join(dir, "successor-content");
  writeFileSync(successor, "");

  // A legitimate successor, published the way the module publishes (staging + exclusive link).
  const successorToken = "successor-token";
  const successorBody = JSON.stringify({
    token: successorToken,
    pid: process.pid,
  });
  writeFileSync(successor, `${successorBody}\n`);

  // Hold the lock with our token, then let release run with the boundary injection armed.
  // The wrapper acquires its own token, so instead drive release directly: acquire via the CLI
  // is not needed to test the window, and the preload intercepts `unlinkSync(path)`.
  writeFileSync(
    path,
    `${JSON.stringify({ token: "holder-token", pid: process.pid })}\n`,
  );

  const result = await new Promise((resolveRun) => {
    const driver = `
      import { release } from ${JSON.stringify(SCRIPT)};
      release(${JSON.stringify(path)}, "holder-token");
    `;
    const child = spawn(
      process.execPath,
      ["--require", SWAP_PRELOAD, "--input-type=module", "-e", driver],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          GATE_LOG: join(dir, "boundary.log"),
          GATE_LOCK_PATH: path,
          GATE_BOUNDARY: "before-shared-unlink",
          GATE_SUCCESSOR: `${successorBody}\n`,
        },
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolveRun({ code, stderr }));
  });

  if (result.code !== 0) {
    fail(
      `release driver failed: ${result.stderr.trim() || `exit ${result.code}`}`,
    );
    return;
  }
  let events;
  try {
    events = readFileSync(join(dir, "boundary.log"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    events = [];
  }
  const unlinked = events.filter((line) => line.startsWith("UNLINK-SHARED"));
  if (unlinked.length > 0) {
    fail(
      `release unlinked the shared lock path (${unlinked.join(", ")}), so a successor published in that window is destroyed`,
    );
  }
  const claimed = events.filter((line) =>
    line.startsWith("RENAME-FROM-SHARED"),
  );
  if (claimed.length === 0) {
    fail(
      `release did not claim the entry by renaming it aside; log: ${events.join(" | ") || "(empty)"}`,
    );
  }
  // After a correct release the lock we owned is gone and no successor data was deleted.
  if (existsSync(path)) {
    let token;
    try {
      token = JSON.parse(readFileSync(path, "utf8"))?.token;
    } catch {
      token = undefined;
    }
    if (token === undefined) {
      fail("release left an unparseable file at the lock path");
    }
  }
}

// ------------------------------------------- quarantine restore cannot clobber a successor (F2)

/**
 * Quarantine moves the lock aside, then discovers it is not the inode it measured. If a third
 * successor wins the path while the lock is aside, a restore-by-rename CLOBBERS that successor.
 * The preload injects the third successor at the claim boundary, and the assertions are:
 * the successor keeps the path, and the displaced lock's data still exists somewhere.
 */
async function checkQuarantineRestoreDoesNotClobberSuccessor() {
  const dir = freshDir();
  const path = join(dir, "gate.lock");
  // Stale A is measured, then a legitimate successor B takes the path on a NEW inode. When
  // quarantine runs against A's measurement, it moves B aside and must restore B without
  // clobbering a third successor C that wins the path in the meantime.
  writeFileSync(
    path,
    `${JSON.stringify({ token: "stale-A", pid: 2 ** 30 })}\n`,
  );
  const measured = observeLock(path);
  const successorB = JSON.stringify({ token: "successor-B", pid: process.pid });
  writeFileSync(join(dir, "b"), `${successorB}\n`);
  renameSync(join(dir, "b"), path);

  const third = JSON.stringify({ token: "successor-C", pid: process.pid });
  const driver = `
    import { quarantine } from ${JSON.stringify(SCRIPT)};
    quarantine(${JSON.stringify(path)}, ${JSON.stringify({ identity: measured.identity })});
  `;
  const result = await new Promise((resolveRun) => {
    const child = spawn(
      process.execPath,
      ["--require", SWAP_PRELOAD, "--input-type=module", "-e", driver],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          GATE_LOG: join(dir, "boundary.log"),
          GATE_LOCK_PATH: path,
          GATE_BOUNDARY: "after-claim-rename",
          GATE_SUCCESSOR: `${third}\n`,
        },
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolveRun({ code, stderr }));
  });
  if (result.code !== 0) {
    fail(
      `quarantine driver failed: ${result.stderr.trim() || `exit ${result.code}`}`,
    );
    return;
  }

  let token;
  try {
    token = JSON.parse(readFileSync(path, "utf8"))?.token;
  } catch {
    token = undefined;
  }
  if (token !== "successor-C") {
    fail(
      `a third successor that won the path was ${token === undefined ? "dropped" : `overwritten (token=${token})`}; it must survive`,
    );
  }
  // The displaced successor B must not be destroyed: when the restore cannot take the path, B's
  // data stays linked under an inert tombstone name rather than being unlinked.
  const bodies = readdirSync(dir)
    .map((name) => {
      try {
        return readFileSync(join(dir, name), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
  if (!bodies.includes("successor-B")) {
    fail(
      `the displaced successor was destroyed during restore; dir=${readdirSync(dir).join(",")}`,
    );
  }
}

// ------------------------------------- parseable-but-schema-invalid locks wait (review F3)

/**
 * A parseable JSON value that is not a lock this module writes carries no evidence about a live
 * holder, so it must be honoured until the age threshold instead of being reclaimed on sight.
 * The malformed-lock case covers non-JSON text; this covers the shapes that JSON.parse accepts.
 */
async function checkSchemaInvalidLocksWait() {
  const shapes = [
    {},
    { pid: "not-a-pid" },
    { token: "x" },
    { pid: 0 },
    { pid: -1 },
    { pid: 1.5 },
    { token: 5, pid: process.pid },
    [],
  ];
  for (const shape of shapes) {
    const dir = freshDir();
    const path = join(dir, "gate.lock");
    const body = JSON.stringify(shape);
    writeFileSync(path, body);
    const observed = observeLock(path);
    if (observed.state !== LOCK_STATE.unparseable) {
      fail(
        `schema-invalid lock ${body} observed as '${observed.state}'; it must not be treated as a valid live lock`,
      );
      continue;
    }
    if (lockIsReclaimable(observed, 60_000)) {
      fail(
        `fresh schema-invalid lock ${body} was reclaimable before its age threshold`,
      );
    }
    if (!lockIsReclaimable(observed, 60_000, Date.now() + 61_000)) {
      fail(
        `aged schema-invalid lock ${body} never becomes reclaimable, so the gate can wedge`,
      );
    }
  }
}

checkClassification();
await checkNoEmptyPublishWindow();
await checkMalformedLockWaits();
checkQuarantineIdentity();
checkReleaseOwnership();
await checkMissingLockAcquires();
await checkSerialization();
await checkReleaseDoesNotDeleteSuccessor();
await checkQuarantineRestoreDoesNotClobberSuccessor();
await checkSchemaInvalidLocksWait();
await checkStaleRecoveryIsSerialized();
await checkSuccessorClaimInReclaimWindow();
checkClaimReclaimCannotDeleteSuccessor();

if (failures.length) {
  console.error(`check-lock: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  "check-lock: ok (state classification, no observable empty window, malformed-lock wait, quarantine identity, release ownership, release-vs-successor, quarantine-restore, schema-invalid wait, stale-recovery serialization, claim-reclaim protection, reclaim-window successor, missing-lock acquire, serialization)",
);
