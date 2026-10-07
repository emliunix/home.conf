#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import {
  closeSync,
  fstatSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const EXIT = {
  completed: 0,
  lock_timeout: 75,
  invalid_input: 64,
};

function usage() {
  return [
    "Usage: gate-lock.mjs [options] -- <command> [args...]",
    "",
    "Options:",
    "  --lock-file <path>  Lock path (default: $HOME_CONF_GATE_LOCK or tmp).",
    "  --timeout-ms <n>    Maximum wait for the lock (default: 1200000).",
    "  --stale-ms <n>      Age after which a lock is stale (default: 1800000).",
    "  --poll-ms <n>       Poll interval (default: 250).",
    "  --help              Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    lockFile:
      process.env.HOME_CONF_GATE_LOCK ||
      join(tmpdir(), "home-conf-heavy-gate.lock"),
    timeoutMs: 20 * 60 * 1000,
    staleMs: 30 * 60 * 1000,
    pollMs: 250,
  };
  let i = 0;
  for (; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      i += 1;
      break;
    }
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--lock-file") options.lockFile = argv[++i];
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++i]);
    else if (arg === "--stale-ms") options.staleMs = Number(argv[++i]);
    else if (arg === "--poll-ms") options.pollMs = Number(argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  options.command = argv.slice(i);
  return options;
}

function emit(state, extra, exitCode) {
  process.stdout.write(
    `${JSON.stringify({ wrapper: "gate-lock", state, ...extra })}\n`,
  );
  process.exitCode = exitCode;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * The three states a lock path can be in. Collapsing `missing` into `unparseable` (or either
 * into "stale") is the defect this classification exists to prevent: a waiter that reads the
 * file between a holder's exclusive create and its metadata write sees a live lock as an
 * abandoned one, and displaces it.
 */
const LOCK_STATE = {
  missing: "missing",
  unparseable: "unparseable",
  parsed: "parsed",
};

/**
 * Observe the lock in ONE fd-bound step, so the identity, the age and the parsed content all
 * describe the same inode. Returns the state plus the identity a later quarantine must match.
 * @param {string} path
 */
/**
 * Is this JSON value a lock this module could have written? A parseable object that lacks the
 * fields of a real lock ({token, pid}) is NOT evidence that a live holder is absent — it is a
 * corrupt or foreign file, and it must be honoured until it ages out. Treating any JSON object
 * as a valid lock let `{}` or `{"pid":"x"}` be reclaimed on sight, bypassing the age wait.
 * @param {unknown} lock
 */
function isLockShape(lock) {
  return (
    lock !== null &&
    typeof lock === "object" &&
    !Array.isArray(lock) &&
    typeof lock.token === "string" &&
    lock.token.length > 0 &&
    Number.isInteger(lock.pid) &&
    lock.pid > 0
  );
}

/** True when two `{dev, ino}` identities name the same file. */
function sameIdentity(a, b) {
  return (
    a !== undefined && b !== undefined && a.dev === b.dev && a.ino === b.ino
  );
}

/**
 * Put a displaced lock back at `path` WITHOUT overwriting a newer lock and WITHOUT destroying
 * the file that was moved.
 *
 * POSIX `rename` always clobbers, so a restore-by-rename can overwrite a successor that won the
 * path while the lock was aside. `link` refuses when the target exists, which gives the
 * non-clobbering semantics we need. If the path is genuinely taken, the moved lock's data still
 * has to survive, so the extra link is left in place rather than unlinked.
 * @param {string} tombstone
 * @param {string} path
 * @returns {boolean} true when the lock was restored to `path`
 */
function restoreLock(tombstone, path) {
  try {
    linkSync(tombstone, path);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    // A newer lock legitimately owns the path. Keep our link so the displaced lock is not
    // dropped; the tombstone is inert and never read as the lock.
    return false;
  }
  try {
    unlinkSync(tombstone); // The path now holds it; drop the extra link.
  } catch {
    // A leftover link is inert.
  }
  return true;
}

function observeLock(path) {
  let fd;
  try {
    fd = openSync(path, "r");
  } catch {
    return { state: LOCK_STATE.missing };
  }
  try {
    const stats = fstatSync(fd);
    let lock;
    try {
      lock = JSON.parse(readFileSync(fd, "utf8"));
    } catch {
      lock = undefined;
    }
    const base = {
      identity: { dev: stats.dev, ino: stats.ino },
      mtimeMs: stats.mtimeMs,
    };
    if (!isLockShape(lock)) {
      // Either not JSON at all, or JSON that is not a lock we wrote. Both mean "a file exists
      // here that is not a valid claim of a live holder": honour it until it ages out.
      return { state: LOCK_STATE.unparseable, ...base };
    }
    return { state: LOCK_STATE.parsed, lock, ...base };
  } finally {
    try {
      closeSync(fd);
    } catch {
      // The descriptor is already closed; nothing to release.
    }
  }
}

function pidIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

/**
 * May this observation be displaced?
 *  - `missing`      -> no. There is no holder to displace; the caller retries the create.
 *  - `unparseable`  -> only once it is older than `staleMs`. A holder may be mid-publish, so a
 *                      fresh unparseable lock is honoured; a corrupt one still self-heals.
 *  - `parsed`       -> when the holder is dead, or the lock is older than `staleMs`.
 * @param {{state: string, lock?: object, mtimeMs?: number}} observed
 * @param {number} staleMs
 * @param {number} [now]
 */
function lockIsReclaimable(observed, staleMs, now = Date.now()) {
  switch (observed.state) {
    case LOCK_STATE.parsed:
      return (
        !pidIsAlive(observed.lock.pid) || now - observed.mtimeMs >= staleMs
      );
    case LOCK_STATE.unparseable:
      return now - observed.mtimeMs >= staleMs;
    default:
      return false;
  }
}

/**
 * Displace a lock that was judged reclaimable ONLY IF it is still the identity that was
 * measured. A path-only rename can move a successor's fresh lock; the inode check is what
 * makes displacement an ownership transition rather than a blind rename.
 * @param {string} path
 * @param {{identity?: {dev: number, ino: number}}} measured
 * @returns {boolean} true when the measured lock was displaced
 */
function quarantine(path, measured) {
  const tombstone = `${path}.stale.${process.pid}.${randomUUID()}`;
  try {
    renameSync(path, tombstone);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  let moved;
  try {
    moved = statSync(tombstone);
  } catch {
    return true; // Already gone; the displacement happened either way.
  }
  const measuredIdentity = measured?.identity;
  const isMeasured =
    measuredIdentity !== undefined &&
    moved.dev === measuredIdentity.dev &&
    moved.ino === measuredIdentity.ino;
  if (!isMeasured) {
    // A successor was published between our measurement and our rename. Restore it without
    // clobbering any newer lock that has since won the path, and without dropping it.
    restoreLock(tombstone, path);
    return false;
  }
  try {
    unlinkSync(tombstone);
  } catch {
    // The stale holder has already been displaced; an unlink failure is non-fatal.
  }
  return true;
}

/**
 * Publish a fully written staging file at `path`, refusing when `path` already exists.
 * `linkSync` gives exclusivity AND completeness in one step: the destination never exists in a
 * partially written state, so no waiter can observe an empty lock. Returns true on success,
 * false when another holder won the race.
 * @param {string} staging
 * @param {string} path
 */
function publishLock(staging, path) {
  try {
    linkSync(staging, path);
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}

/**
 * Displace an aged recovery claim, or decline if it is not the one that was measured.
 *
 * A path-based removal is what makes this unsafe: `rmdir(claim)` after an age check can delete a
 * successor's FRESH claim that appeared in between, and then two decisions run. Two properties
 * close that:
 *   - the claim is a directory that always holds an owner file, so it cannot be removed by
 *     `rmdir` at all (ENOTEMPTY) and cannot be clobbered by a rename onto it (also ENOTEMPTY);
 *   - the claim is displaced by MOVING it aside and verifying the moved identity, so a successor
 *     claim that won the path is restored rather than deleted.
 * @param {string} claim
 * @param {number} staleMs
 * @returns {boolean} true when the path is free for the caller to publish into
 */
function reclaimAgedClaim(claim, staleMs) {
  let measured;
  try {
    measured = statSync(claim);
  } catch {
    return true; // Already gone; the caller can retry its publish.
  }
  if (Date.now() - measured.mtimeMs < staleMs) return false; // Fresh: another reclaimer is live.

  const tombstone = `${claim}.aged.${process.pid}.${randomUUID()}`;
  try {
    renameSync(claim, tombstone);
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
  let moved;
  try {
    moved = statSync(tombstone);
  } catch {
    return true;
  }
  if (sameIdentity(moved, measured)) {
    try {
      rmSync(tombstone, { recursive: true, force: true });
    } catch {
      // The aged claim is displaced either way.
    }
    return true;
  }
  // A successor published a FRESH claim while we were deciding. Restore it non-clobberingly;
  // if the path is taken, the tombstone stays inert rather than being deleted.
  try {
    renameSync(tombstone, claim);
  } catch {
    // Path taken by a newer claim; nothing further to do.
  }
  return false;
}

/**
 * Release a claim this process owns, without ever removing a claim it does not own.
 *
 * Mirrors `release`: the entry is moved aside first, so the deletion cannot be raced onto a
 * different claim, and it is removed only when the moved directory is the identity acquired.
 * @param {string} claim
 * @param {{dev: number, ino: number}} identity
 */
function releaseClaim(claim, identity) {
  const tombstone = `${claim}.released.${process.pid}.${randomUUID()}`;
  let moved;
  try {
    renameSync(claim, tombstone);
    moved = statSync(tombstone);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (sameIdentity(moved, identity)) {
    try {
      rmSync(tombstone, { recursive: true, force: true });
    } catch {
      // Another recovering process already displaced this claim.
    }
    return;
  }
  try {
    renameSync(tombstone, claim);
  } catch {
    // Path taken; the tombstone is inert and never read as a claim.
  }
}

/**
 * Serialize the stale-recovery DECISION together with its DISPLACEMENT.
 *
 * A reclaimable observation is a snapshot, and acting on it later is unsafe: between the
 * observation and the rename another reclaimer can legitimately displace the stale lock and
 * publish a live successor, which the first reclaimer then renames aside — freeing the path
 * while a live holder is already running, so a third holder publishes and runs concurrently.
 *
 * The claim makes observe-then-displace atomic with respect to every other reclaimer, and the
 * observation is retaken INSIDE it, so a displacement is always against a measurement taken
 * while this process holds the claim. Only one process can hold it, so no two reclaimers can act
 * on the same snapshot.
 *
 * The claim is published by renaming a staging directory that already contains an owner file.
 * That makes acquisition atomic AND leaves the claim non-empty from the moment it appears, which
 * is what stops any other process's path-based removal from deleting a valid claim.
 *
 * The claim is held across a few syscalls only — observe, rename, stat — never across the child
 * command. A holder that dies with the claim was therefore running nothing, so reclaiming its
 * claim can only DELAY recovery, never double-execute. That asymmetry is why age-based reclaim of
 * the claim is safe here, unlike the lock, where displacement frees a path a live command may use.
 * @param {string} path
 * @param {number} staleMs
 * @param {() => string} decide
 * @returns {string} the decision from `decide`, or "busy" when another reclaimer holds the claim
 */
function withRecoveryClaim(path, staleMs, decide) {
  const claim = `${path}.recovery`;
  const token = randomUUID();
  const staging = `${claim}.staging.${process.pid}.${token}`;
  let acquired;
  try {
    mkdirSync(staging);
    writeFileSync(
      join(staging, "owner"),
      `${JSON.stringify({ token, pid: process.pid })}\n`,
      { mode: 0o600 },
    );
    // Publishing by rename is atomic, and the staging directory is already non-empty, so a
    // visible claim is always a complete one.
    try {
      renameSync(staging, claim);
      acquired = statSync(claim);
    } catch (error) {
      if (error?.code !== "ENOTEMPTY" && error?.code !== "EEXIST") throw error;
      if (!reclaimAgedClaim(claim, staleMs)) return "busy";
      try {
        renameSync(staging, claim);
        acquired = statSync(claim);
      } catch {
        return "busy"; // A successor won the path; wait rather than displace it.
      }
    }
    return decide();
  } finally {
    try {
      rmSync(staging, { recursive: true, force: true });
    } catch {
      // Already published, or never created; nothing to release.
    }
    if (acquired) releaseClaim(claim, acquired);
  }
}

function acquire(options) {
  const deadline = Date.now() + options.timeoutMs;
  const token = randomUUID();
  const metadata = {
    token,
    pid: process.pid,
    command: options.command.join(" "),
    startedAt: new Date().toISOString(),
  };
  // A private staging file in the lock's own directory, so `linkSync` stays on one filesystem.
  // A leftover staging file is inert: it is never the lock, and nothing else reads it.
  const staging = `${options.lockFile}.staging.${process.pid}.${token}`;
  try {
    writeFileSync(staging, `${JSON.stringify(metadata)}\n`, { mode: 0o600 });
    while (true) {
      if (publishLock(staging, options.lockFile)) return { token };

      const observed = observeLock(options.lockFile);
      if (observed.state === LOCK_STATE.missing) continue; // Retry; nothing to displace.

      // Observe and displace under the claim, retaking the observation inside it: a snapshot
      // taken outside could be stale by the time we act on it, and acting on a stale snapshot
      // is what let a live successor be renamed aside.
      const decision = withRecoveryClaim(
        options.lockFile,
        options.staleMs,
        () => {
          const fresh = observeLock(options.lockFile);
          if (fresh.state === LOCK_STATE.missing) return "retry";
          if (!lockIsReclaimable(fresh, options.staleMs)) return "wait";
          return quarantine(options.lockFile, fresh) ? "retry" : "wait";
        },
      );
      if (decision === "retry") continue;
      // "busy" (another reclaimer) and "wait" both mean a holder exists; wait, never displace.
      if (Date.now() >= deadline) return undefined;
      sleep(Math.min(options.pollMs, Math.max(1, deadline - Date.now())));
    }
  } finally {
    try {
      unlinkSync(staging);
    } catch {
      // Already gone, or never created; nothing to release.
    }
  }
}

/**
 * Remove the lock only when the path entry is provably the one this holder created.
 *
 * A token check on the file at `path` is NOT sufficient: between that check and an
 * `unlinkSync(path)` the path can be replaced, and the unlink then removes a SUCCESSOR. So the
 * entry is claimed by renaming it aside first — the moved file is then inspected directly, so
 * the delete cannot be raced onto a different inode — and it is deleted only if it is the inode
 * this holder opened. Otherwise the moved lock is restored without clobbering anything.
 *
 * Renaming aside does leave the path briefly free, which is harmless HERE and only here: release
 * runs at the END of the critical section, when this holder's command has already finished, so a
 * waiter that acquires in that instant is not overlapping anyone's execution.
 * @param {string} path
 * @param {string} token
 */
function release(path, token) {
  let fd;
  try {
    fd = openSync(path, "r");
  } catch {
    return; // Already displaced; nothing of ours remains.
  }
  try {
    let current;
    try {
      current = JSON.parse(readFileSync(fd, "utf8"));
    } catch {
      return; // Unparseable: not provably ours, so leave it alone.
    }
    if (current?.token !== token) return;

    const tombstone = `${path}.released.${process.pid}.${randomUUID()}`;
    let moved;
    try {
      renameSync(path, tombstone);
      moved = statSync(tombstone);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    if (sameIdentity(moved, fstatSync(fd))) {
      try {
        unlinkSync(tombstone);
      } catch {
        // Another recovering process already displaced this lock.
      }
      return;
    }
    // Not ours: a successor replaced the path while we held it. Its lock must survive.
    restoreLock(tombstone, path);
  } finally {
    try {
      closeSync(fd);
    } catch {
      // The descriptor is already closed.
    }
  }
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    emit("invalid_input", { error: error.message }, EXIT.invalid_input);
    return;
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (
    !options.command.length ||
    !Number.isFinite(options.timeoutMs) ||
    options.timeoutMs < 0 ||
    !Number.isFinite(options.staleMs) ||
    options.staleMs < 1 ||
    !Number.isFinite(options.pollMs) ||
    options.pollMs < 1
  ) {
    emit(
      "invalid_input",
      { error: "a command is required and all bounds must be positive" },
      EXIT.invalid_input,
    );
    return;
  }
  options.lockFile = resolve(options.lockFile);

  let acquired;
  try {
    acquired = acquire(options);
  } catch (error) {
    emit("invalid_input", { error: error.message }, EXIT.invalid_input);
    return;
  }
  if (!acquired) {
    emit(
      "lock_timeout",
      { lockFile: options.lockFile, timeoutMs: options.timeoutMs },
      EXIT.lock_timeout,
    );
    return;
  }

  const startedAt = new Date().toISOString();
  const result = spawnSync(options.command[0], options.command.slice(1), {
    stdio: "inherit",
    env: process.env,
  });
  const exitCode = result.status ?? 1;
  release(options.lockFile, acquired.token);
  emit(
    "completed",
    {
      pid: process.pid,
      command: options.command.join(" "),
      exitCode,
      acquiredAt: startedAt,
      releasedAt: new Date().toISOString(),
    },
    exitCode,
  );
}

export {
  EXIT,
  LOCK_STATE,
  acquire,
  isLockShape,
  lockIsReclaimable,
  observeLock,
  publishLock,
  quarantine,
  reclaimAgedClaim,
  release,
  releaseClaim,
  restoreLock,
  sameIdentity,
  withRecoveryClaim,
};

// Run only when invoked as a program, so a focused test can import the internals and drive
// the identity-checked paths deterministically instead of racing them.
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isMain) main();
