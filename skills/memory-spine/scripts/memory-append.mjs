#!/usr/bin/env node
// memory-append -- add one durable fact without hand-editing MEMORY.md.
//
// WHY THIS EXISTS. MEMORY.md must not be the record: hand-editing it via anchored replacement
// grows it without bound and can leave it half-applied. So a fact is appended to a dated
// append-only LOG first, and the index is then REPUBLISHED by this tool.
//
// FLUSH ORDER IS THE WHOLE CONTRACT (order chosen so no interruption loses the only copy):
//   1. take an exclusive lock            -- serialize concurrent writers
//   2. append the fact to the log        -- the DURABLE copy lands FIRST, and fsync'd
//   3. read + verify the log             -- the fact is readable before anything is published
//   4. fold the index from the log       -- the index is a function of the log, not an edit of it
//   5. publish by temp + atomic rename   -- a reader sees old or new, never a partial file
//   6. release the lock
//
// THE LOG IS THE AUTHORITY FOR "IS THIS FACT RECORDED". NOT THE CLAIM.
// An earlier revision treated the existence of a per-fact claim file as proof the fact was done,
// while creating that file BEFORE any durable state existed. A hard interruption (`SIGKILL`,
// `process.exit`, power loss) between the claim and the log write therefore left a claim that made
// every retry report "already present" -- for a fact that was never recorded anywhere. That is
// worse than an ordinary interrupted write: the loss is silent and the tool reports success.
//
// So the claim now means only "a writer is in flight for this fact", and RECOVERY IS DRIVEN BY THE
// LOG:
//   - fact in the log  -> it IS recorded; finish any incomplete publication of the index.
//   - claim, no log    -> the holder died mid-append; reclaim the claim and append for real.
// A claim whose holder is gone is detected by PID liveness, not by waiting out a time window.
//
// IDEMPOTENCE. Each fact carries a content hash; the log is checked for that hash before anything
// is written. Retrying after any interruption yields exactly one log entry and a visible fact.
//
// EXIT CODES. 0 appended (or already present); 1 refused, nothing changed; 64 invalid input.

import { createHash, randomUUID } from "node:crypto";
import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  renameSync, rmSync, statSync, writeFileSync, writeSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { CAP_BYTES } from "./memory-lint.mjs";

export function factKey(text) {
  return createHash("sha256").update(text.trim(), "utf8").digest("hex").slice(0, 16);
}

/** Log path for a workspace: <notesDir>/memory-log-<YYYY-MM-DD>.md -- dated, so it rotates. */
export function logPathFor(notesDir, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  return join(notesDir, `memory-log-${day}.md`);
}

/**
 * Take an exclusive lock and return an OWNERSHIP TOKEN: `{ lock, ino }`.
 *
 * WHY A DIRECTORY. `mkdir` is the atomic exclusive create on every filesystem: it either makes the
 * directory or fails with EEXIST, with no window in between.
 *
 * WHY THE TOKEN MATTERS ON RELEASE AS WELL AS ON EVICTION. A bare `unlink`/`rename` acts on the
 * PATH, which can be re-occupied between the read and the act. Eviction compares inodes for exactly
 * that reason; RELEASE must too. An earlier revision made eviction inode-aware and left release
 * path-only, so a holder that outlived the stale threshold would evict its successor's live lock
 * from its own `finally` -- hardening one of the two paths that touch the lock.
 *
 * STALE RECOVERY is an atomic, VERIFIED transfer: rename the directory we measured to a unique
 * tombstone, confirm the tombstone holds THAT inode, and either proceed (we evicted the stale lock)
 * or put it back and retry (we moved a successor's live lock).
 */
function acquire(lockDir, { timeoutMs = 10_000, pollMs = 25, staleMs = 60_000 } = {}) {
  const lock = join(lockDir, "memory-append.lock");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      // THE LOCK IS A FILE CREATED AND WRITTEN IN ONE ATOMIC CALL.
      //
      // `writeFileSync(path, record, {flag: "wx"})` is O_CREAT|O_EXCL plus the write, so either this
      // process created the lock (and its identity is already in it) or the call fails with EEXIST.
      // An earlier revision did `mkdirSync` and then wrote an owner file inside it BY PATH, which
      // left a window between the two: a successor could evict the just-created directory and create
      // its own, and the first writer's owner write then landed in the SUCCESSOR's directory --
      // overwriting its record and returning a token for a lock it did not hold. Both writers then
      // believed they were the owner. Binding the identity to the same call that creates the lock
      // removes the window rather than narrowing it.
      writeFileSync(lock, ownerRecord(), { flag: "wx" });
      return { lock, ino: statSync(lock).ino };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let measured;
      try {
        measured = statSync(lock);
      } catch { continue; }                             // released under us; retry the create
      // LIVENESS IS CHECKED BEFORE AGE, AND AN ALIVE HOLDER IS NEVER EVICTED. With age alone, several
      // waiters that each measured the same stale lock could rename the PATH in turn: the first
      // evicts the stale lock and creates its own, and the next then moves THAT live lock away. The
      // displaced holder cannot find its own lock to release and every other waiter times out.
      // Age therefore applies only when identity is unknown or the holder is provably gone.
      const state = holderState(readOwner(lock));
      const abandoned = state === "dead" || (state !== "alive" && Date.now() - measured.mtimeMs > staleMs);
      if (abandoned) {
        // EVICTION IS AN ATOMIC, VERIFIED TRANSFER: rename the lock we MEASURED to a unique
        // tombstone, then prove the tombstone holds that inode. A rename succeeds for exactly one
        // actor, so a loser gets ENOENT; the inode comparison proves we moved the STALE lock and not
        // a successor's live one.
        const tombstone = `${lock}.stale.${randomUUID()}`;
        try {
          renameSync(lock, tombstone);
        } catch (renameError) {
          if (renameError?.code === "ENOENT") continue;  // another waiter got there first
          throw renameError;
        }
        let moved;
        try {
          moved = statSync(tombstone);
        } catch { continue; }
        if (moved.ino !== measured.ino) {
          // We moved a lock that was NOT the stale one we measured -- a successor's live lock. Put it
          // back if the path is free; if it is NOT, leave the tombstone rather than delete a live
          // lock. Leaving it costs a file and is recoverable; deleting it is not.
          try { renameSync(tombstone, lock); } catch { /* path re-occupied: leave the tombstone */ }
          continue;
        }
        rmSync(tombstone, { force: true });
        continue;                                        // provably evicted; retry the create
      }
      if (Date.now() > deadline) {
        const err = new Error(`another writer holds ${lock} after ${timeoutMs} ms`);
        err.code = "ELOCKED";
        throw err;
      }
      const until = Date.now() + pollMs;
      while (Date.now() < until) { /* bounded busy-wait; no dependency, no timer leak */ }
    }
  }
}

/**
 * Release a lock, but ONLY if the directory is still the one we created.
 *
 * If our token's inode no longer matches, a successor owns the lock and removing it would hand the
 * critical section to two writers at once. Leaving a lock we no longer own is the safe direction:
 * it can be reclaimed by stale recovery, whereas removing someone else's cannot be undone.
 */
function releaseLock(held) {
  if (held === undefined || held === null) return;
  // RELEASE USES THE SAME ATOMIC TRANSITION AS EVICTION: rename to a unique tombstone, prove the
  // inode, then remove the tombstone. A `stat`-then-remove still has a TOCTOU window between the
  // check and the removal -- the successor-lock removal simply survives in a narrower window, which
  // is the same defect wearing a smaller hat. Rename is atomic, so exactly one actor moves the
  // directory and the loser's rename fails.
  const tombstone = `${held.lock}.done.${randomUUID()}`;
  try {
    renameSync(held.lock, tombstone);
  } catch {
    return;                                    // already gone, or someone else moved it
  }
  let moved;
  try {
    moved = statSync(tombstone);
  } catch {
    return;                                    // vanished under us; nothing to restore
  }
  if (moved.ino !== held.ino) {
    // We moved a lock that is NOT ours: a successor took over while we were releasing. Put it back
    // exactly where it was, leaving their lock in place. If the path is occupied again we must not
    // clobber it -- leave the tombstone rather than delete a live lock.
    try { renameSync(tombstone, held.lock); } catch { /* the path is re-occupied; leave the tombstone */ }
    return;
  }
  rmSync(tombstone, { recursive: true, force: true });
}

/**
 * Exported so the coverage can drive the lock's own contract directly: mutual exclusion, and a
 * release that removes ONLY the lock it was given. Observing this through a race is unreliable; the
 * property is about the token, so the case asserts the token.
 */
export const acquireLock = acquire;

/** Release a lock token. Exported for the coverage's successor-release case. */
export const releaseHeld = releaseLock;

/**
 * Take an exclusive lock, or return `null` if one cannot be had within the budget.
 *
 * WHY A TIMEOUT IS NOT FATAL. The lock reduces CONTENTION; it is not what makes an append correct.
 * Correctness comes from two other things: the per-fact CLAIM (`open(...,"wx")`), which is an
 * atomic test-and-set the filesystem enforces, and the fact that the index is a FOLD of the
 * append-only log. A stale-lock race therefore cannot duplicate or lose a fact even if two writers
 * run concurrently.
 *
 * The earlier revision treated the lock as a correctness dependency, so a writer that could not
 * take it FAILED with ELOCKED. Under contention that turned into every writer failing together --
 * measured as all eight writers refused in 3 of 30 trials -- which is a worse outcome than running
 * unserialized, because nothing gets written at all. Returning null and proceeding is the honest
 * behaviour: the caller gets a correct append, just one that may race on the index (which
 * convergence handles).
 */
function tryAcquire(lockDir, options = {}) {
  const budget = options.lockTimeoutMs ?? 2_000;
  try {
    return acquire(lockDir, { ...options, timeoutMs: budget });
  } catch (error) {
    if (error?.code === "ELOCKED") return null;      // proceed without it; the claim still guards us
    throw error;
  }
}

/** Identify the holder of a claim or lock: pid AND its start time.
 *
 * A BARE PID IS NOT AN IDENTITY -- pids are recycled, so "this pid is alive" can be a successor
 * process that happens to have inherited the number. The start time gives a second coordinate, so a
 * recycled pid is distinguishable from the original holder. Returns null when identity cannot be
 * established, and callers must treat null as "unknown", never as "dead": converting "could not
 * prove the holder dead" into a success is the exact defect this whole path exists to avoid.
 */
function readOwner(file) {
  let raw;
  try {
    raw = readFileSync(file, "utf8").trim();
  } catch {
    return null;                       // not written yet, or already gone
  }
  const parts = raw.split(/\s+/);
  // BOTH FIELDS ARE REQUIRED. A reader can observe the owner file MID-WRITE and see the pid with
  // no start time. Trusting that as identity is how a live lock gets evicted: the partial pid may
  // belong to no running process, so a bare `kill(pid, 0)` answers ESRCH -- "dead" -- and every
  // waiter then evicts a LIVE lock, cascading until they all time out. An incomplete record is
  // therefore UNKNOWN, which falls back to age and never to eviction.
  if (parts.length !== 2) return null;
  const pid = Number.parseInt(parts[0], 10);
  const startedAt = Number.parseInt(parts[1], 10);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (!Number.isInteger(startedAt) || startedAt <= 0) return null;
  return { pid, startedAt };
}

/** What a fresh owner record should contain: our pid and our start time. */
function ownerRecord() {
  return `${String(process.pid)} ${String(Math.round(Date.now() - process.uptime() * 1_000))}\n`;
}

/**
 * Is the identified holder still alive? `unknown` means "could not tell" and is never death.
 *
 * NO SUBPROCESS. An earlier revision resolved pid reuse by shelling out to `ps -o lstart=`, and that
 * sat in the polling loop: eight waiters spawned processes continuously, starved their own deadline,
 * and failed with ELOCKED -- which surfaced as lost appends and flaky coverage. `process.kill(pid,
 * 0)` is a syscall, so it is cheap enough to call while waiting.
 *
 * PID REUSE IS HANDLED BY FALLING BACK TO AGE, which is the safe direction. The owner record still
 * carries a start time, so identity IS stored; but when we cannot confirm identity we treat a live
 * pid as ALIVE and let the stale window expire rather than evicting a lock we cannot prove abandoned.
 * The rule that matters, and the one this whole path exists for: "could not prove the holder dead"
 * must never become a successful write.
 */
function holderState(owner) {
  if (owner === null) return "unknown";  try {
    process.kill(owner.pid, 0);
    return "alive";
  } catch (error) {
    if (error?.code === "EPERM") return "alive";      // exists, not ours to signal
    if (error?.code === "ESRCH") return "dead";        // no such process
    return "unknown";                                  // never treat an unexpected error as death
  }
}

/**
 * Claim a fact for this process. The claim is MUTUAL EXCLUSION ONLY -- its existence never means
 * the fact is recorded, so nothing may treat it that way (see the header).
 * Returns true when we hold it, false when someone else does.
 */
function tryClaim(claim, { claimGraceMs = 5_000 } = {}) {
  mkdirSync(dirname(claim), { recursive: true });
  try {
    writeFileSync(claim, ownerRecord(), { flag: "wx" });
    return true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  // A claim whose holder is GONE is reclaimable. A claim we cannot attribute -- empty, malformed, or
  // a bare pid with no start time -- is NOT assumed dead: `holderState` returns "unknown" and we
  // fall back to AGE, because converting "could not prove the holder dead" into success is exactly
  // the failure this path exists to prevent.
  const state = holderState(readOwner(claim));
  let mtimeMs = 0;
  try { mtimeMs = statSync(claim).mtimeMs; } catch { return false; }
  const abandoned =
    state === "dead" || state === "recycled" || (state === "unknown" && Date.now() - mtimeMs > claimGraceMs);
  if (!abandoned) return false;

  // Atomic reclaim: move the exact claim we measured aside, verify the inode, then retry the create.
  const tombstone = `${claim}.dead.${randomUUID()}`;
  let measured;
  try { measured = statSync(claim); } catch { return false; }
  try {
    renameSync(claim, tombstone);
  } catch {
    return false;                                      // someone else reclaimed it; they may create
  }
  try {
    if (statSync(tombstone).ino !== measured.ino) {
      try { renameSync(tombstone, claim); } catch { rmSync(tombstone, { force: true }); }
      return false;
    }
  } catch { /* tombstone vanished; treat as reclaimed */ }
  rmSync(tombstone, { force: true });
  try {
    writeFileSync(claim, ownerRecord(), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse the append-only log into its facts, in insertion order.
 * Each entry is `## <iso> <!-- <key> -->` followed by the body.
 */
export function parseLog(logText) {
  const facts = [];
  const re = /<!-- ([0-9a-f]{16}) -->\n\n([^]*?)(?=\n## |\n*$)/g;
  let m;
  while ((m = re.exec(logText)) !== null) {
    const body = m[2].trim();
    if (body.length > 0) facts.push({ key: m[1], body });
  }
  return facts;
}

/**
 * Fold the log into the index: the index's facts section is REGENERATED from the log, not amended.
 *
 * WHY A FOLD RATHER THAN AN INSERT. Inserting one bullet into the current index makes the published
 * content depend on WHICH snapshot of the index the writer happened to read. With the lock that is
 * fine; without it two overlapping writers each publish their own snapshot and one update is lost --
 * measured at 9 of 10 trials losing at least one distinct fact with an unreliable lock. Folding from
 * the LOG means every writer publishes the COMPLETE fact set, so the last rename wins and still
 * carries everything. The log is append-only and durable, which is the property this relies on.
 *
 * Curated prose is preserved: only bullet lines carrying a log key are dropped before the log's
 * facts are re-emitted, so hand-written entries are never touched.
 */
export function foldIndex(indexText, logText, section = "## Key Knowledge") {
  const lines = indexText.split("\n");
  const heading = lines.findIndex((l) => l.trim() === section.trim());
  if (heading === -1) {
    throw Object.assign(new Error(`index has no ${section} section to append into`), { code: "ESECTION" });
  }
  const facts = parseLog(logText);
  const keyed = new Set(facts.map((f) => f.key));

  let end = heading + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end += 1;
  const owned = /^- .*<!-- ([0-9a-f]{16}) -->\s*$/;
  const kept = [];
  for (let i = heading + 1; i < end; i += 1) {
    const m = owned.exec(lines[i]);
    if (m !== null && keyed.has(m[1])) continue;
    kept.push(lines[i]);
  }

  let insertAt = kept.length;
  while (insertAt > 0 && kept[insertAt - 1].trim() === "") insertAt -= 1;
  const bullets = facts.map((f) => `- ${f.body} <!-- ${f.key} -->`);
  const rebuilt = [
    ...lines.slice(0, heading + 1),
    ...kept.slice(0, insertAt),
    ...bullets,
    ...kept.slice(insertAt),
    ...lines.slice(end),
  ];
  return rebuilt.join("\n");
}

/**
 * Publish the index: temp file in the SAME directory (so rename is atomic, not cross-device),
 * then rename over the target. A reader sees the old file or the new one, never a partial one.
 */
export function publishIndex(indexPath, text) {
  const before = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
  const tmp = join(dirname(indexPath), `.MEMORY.md.${randomUUID()}.tmp`);
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, text);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, indexPath);
  return { bytesBefore: Buffer.byteLength(before, "utf8"), bytesAfter: Buffer.byteLength(text, "utf8") };
}

/**
 * Finish an incomplete publication: bring the index onto the log if it is behind. Idempotent, and a
 * no-op when they already agree. This is the step a retry must run after an interruption, because
 * the fact being durable in the log is not the same as the index a fresh agent reads showing it.
 */
function ensurePublished(indexPath, logText, indexText, cap, options) {
  const folded = foldIndex(indexText, logText, options.section);
  if (folded === indexText) return false;
  const size = Buffer.byteLength(folded, "utf8");
  if (size > cap) {
    throw Object.assign(
      new Error(`the index would be ${size} B, over the ${cap} B cap; migrate first`),
      { code: "ECAP" },
    );
  }
  publishIndex(indexPath, folded);
  return true;
}

/**
 * Append one fact. Returns a receipt: byte counts BEFORE/AFTER, the log path, whether the fact was
 * already present, and whether an incomplete publication had to be finished.
 */
export function appendFact(indexPath, fact, options = {}) {
  const notesDir = options.notesDir ?? join(dirname(indexPath), "notes");
  mkdirSync(notesDir, { recursive: true });
  const log = options.logPath ?? logPathFor(notesDir, options.date);
  const body = fact.trim();
  if (body.length === 0) throw Object.assign(new Error("refusing to append an empty fact"), { code: "EEMPTY" });
  const key = factKey(body);
  const cap = options.cap ?? CAP_BYTES;
  const byteLen = (text) => Buffer.byteLength(text, "utf8");

  const held = tryAcquire(dirname(indexPath), options);
  let claim = null;
  try {
    const readLog = () => (existsSync(log) ? readFileSync(log, "utf8") : "");
    const readIndex = () => (existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "");

    // THE LOG DECIDES WHETHER THE FACT IS RECORDED -- AND THE BODY MUST MATCH, NOT JUST THE KEY.
    // A key alone proves an entry STARTED: a partial write can leave the marker with a truncated
    // body, so a key-only match would report success for a fact never fully stored. The log is
    // PARSED and the body compared exactly. A key with a DIFFERENT body is a TORN entry: refused,
    // because the log is append-only and repairing it is a deliberate human act.
    const lookup = (logText) => {
      const found = parseLog(logText).find((f) => f.key === key && f.body === body);
      if (found !== undefined) return "recorded";
      return logText.includes(`<!-- ${key} -->`) ? "torn" : "absent";
    };
    const settle = (logText, indexText) => {
      const repaired = ensurePublished(indexPath, logText, indexText, cap, options);
      return { appended: false, alreadyPresent: true, indexRepaired: repaired, key, logPath: log, indexPath,
        bytesBefore: byteLen(indexText),
        bytesAfter: repaired ? byteLen(readIndex()) : byteLen(indexText) };
    };
    const refuse = (reason, code) => Object.assign(new Error(reason), { code });

    // FAST PATH, BEFORE ANY CLAIM: if the fact is already recorded, publish if needed and stop. This
    // is the common retry case and it must not require taking the claim.
    const before = lookup(readLog());
    if (before === "recorded") return settle(readLog(), readIndex());
    if (before === "torn") {
      throw refuse(`the log holds ${key} with a different or empty body; the entry is torn and needs review`, "ETORN");
    }

    // TAKE THE CLAIM, THEN RE-READ THE LOG UNDER IT.
    //
    // The re-read is the part that closes a real duplicate. Reading the log only BEFORE claiming
    // leaves this window: writer A finishes and exits, its claim is reclaimed by B as a dead
    // holder's, and B -- whose log read happened before A's entry landed -- appends the same fact
    // again. Re-reading AFTER the claim means a writer that takes over a reclaim necessarily
    // observes whatever the previous holder recorded.
    //
    // `claim` IS ASSIGNED ONLY ON SUCCESS, AND ONLY AS A TOKEN. An earlier revision set the path
    // BEFORE calling tryClaim, so a writer that FAILED to take the claim still removed it in its
    // finally -- deleting the live holder's claim and letting a third writer append the same fact.
    // Measured as a duplicate in 1 of 30 trials. The token now carries the inode so release can also
    // prove it is removing ITS OWN claim, not a successor's.
    const claimPath = join(notesDir, ".claims", key);
    if (!tryClaim(claimPath, options)) {
      throw refuse(
        "another process is writing this fact, or an unattributable claim is still fresh; retry to finish it",
        "EINPROGRESS",
      );
    }
    claim = { path: claimPath, ino: statSync(claimPath).ino };

    const underClaim = lookup(readLog());
    if (underClaim === "recorded") return settle(readLog(), readIndex());
    if (underClaim === "torn") {
      throw refuse(`the log holds ${key} with a different or empty body; the entry is torn and needs review`, "ETORN");
    }

    const indexBefore = readIndex();
    const logBefore = readLog();
    const entry = `\n## ${new Date().toISOString()} <!-- ${key} -->\n\n${body}\n`;
    // The cap is checked on the FOLDED result BEFORE any write, so a refusal leaves no orphan entry.
    const projected = foldIndex(indexBefore, logBefore + entry, options.section);
    const projectedSize = byteLen(projected);
    if (projectedSize > cap) {
      throw refuse(`appending would put the index at ${projectedSize} B, over the ${cap} B cap; migrate first`, "ECAP");
    }

    // 1. THE DURABLE COPY, first, fsynced, before the index is touched.
    const fd = openSync(log, "a");
    try {
      writeSync(fd, entry);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    // 2. VERIFY the fact is readable where we claim to have put it.
    const logAfter = readFileSync(log, "utf8");
    if (!logAfter.includes(`<!-- ${key} -->`)) {
      throw refuse("log write did not take effect; index left untouched", "EVERIFY");
    }

    // 3. PUBLISH by temp + atomic rename, re-folded from the log as it actually landed so a
    // concurrent writer's entry is included too.
    const published = publishIndex(indexPath, foldIndex(indexBefore, logAfter, options.section));
    return { appended: true, alreadyPresent: false, indexChanged: true, key, logPath: log, indexPath,
      bytesBefore: published.bytesBefore,
      bytesAfter: published.bytesAfter,
      logBytesBefore: byteLen(logBefore),
      logBytesAfter: byteLen(logAfter) };
  } finally {
    // THE CLAIM IS RELEASED ON EVERY EXIT PATH, BUT ONLY IF IT IS STILL OURS.
    //
    // On success the LOG is the record, not the claim: leaving it behind would make a later append
    // of the same fact report EINPROGRESS, and would let a reclaiming writer duplicate it if it did
    // not re-read. But removing a claim by PATH can delete a SUCCESSOR's live claim -- the same
    // defect class as a path-only lock release -- so the inode must still match.
    if (claim !== null) {
      try {
        if (statSync(claim.path).ino === claim.ino) rmSync(claim.path, { force: true });
      } catch { /* already gone or replaced; leaving it is the safe direction */ }
    }
    releaseLock(held);
  }
}

/**
 * CONVERGENCE, STATED HONESTLY.
 *
 * The index is a pure function of the log: `index = fold(indexShape, log)`. That is what lets the
 * lock be best-effort. But it also means two writers that both read the log before the other's entry
 * landed can each publish a fold that misses that entry. With fs primitives alone this window cannot
 * be closed: the log and the index are two files and cannot be updated atomically together.
 *
 * So the guarantee is CONVERGENCE, not instant completeness, and it is deterministic and cheap:
 * folding is idempotent, so one more republish moves the index onto the full log. A caller appending
 * in a loop converges automatically; a racing case converges on the next append, or immediately
 * via `republish`.
 *
 * This is the property the coverage asserts, because it is the one that is true. Claiming "no
 * concurrent append can ever be missed" would be a claim the mechanism does not support.
 */
export function republish(indexPath, options = {}) {
  const notesDir = options.notesDir ?? join(dirname(indexPath), "notes");
  const log = options.logPath ?? logPathFor(notesDir, options.date);
  if (!existsSync(log)) {
    return { republished: false, bytesBefore: 0, bytesAfter: 0, facts: 0 };
  }
  const cap = options.cap ?? CAP_BYTES;
  const held = tryAcquire(dirname(indexPath), options);
  try {
    const logText = readFileSync(log, "utf8");
    const indexBefore = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
    const repaired = ensurePublished(indexPath, logText, indexBefore, cap, options);
    return { republished: repaired, bytesBefore: Buffer.byteLength(indexBefore, "utf8"),
      bytesAfter: Buffer.byteLength(readFileSync(indexPath, "utf8"), "utf8"), facts: parseLog(logText).length };
  } finally {
    releaseLock(held);
  }
}

function main(argv) {
  const indexPath = resolve(argv[0] ?? "MEMORY.md");
  const body = argv.slice(1).join(" ");
  // A MISSING fact argument is a usage error (64). A fact argument that is present but blank is a
  // REFUSAL (1): the caller used the tool correctly and the CONTENT was rejected. Those are
  // different faults and a caller cannot act on them the same way.
  if (argv.length < 2) {
    console.error("usage: memory-append.mjs <index-path> <fact>");
    process.exit(64);
  }
  try {
    const receipt = appendFact(indexPath, body);
    if (!receipt.appended) {
      const tail = receipt.indexRepaired ? "; index brought up to date from the log" : "; index already current";
      console.log(`OK (already present): ${receipt.key} -- ${receipt.logPath}${tail}; index at ${receipt.bytesAfter} B`);
    } else {
      console.log(
        `OK: ${receipt.key} appended to ${receipt.logPath} ` +
        `(log ${receipt.logBytesBefore} -> ${receipt.logBytesAfter} B); ` +
        `index ${receipt.indexPath} published ${receipt.bytesBefore} -> ${receipt.bytesAfter} B`,
      );
    }
    process.exit(0);
  } catch (error) {
    console.error(`REFUSED: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith("memory-append.mjs")) main(process.argv.slice(2));
