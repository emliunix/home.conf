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
  const owner = join(lock, "owner");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      mkdirSync(lock);
      // Record the holder by FILE DESCRIPTOR-relative write, and treat any failure as losing the
      // lock: if a concurrent eviction renamed our fresh directory away between the mkdir and this
      // write, the lock is not ours and we must not enter the critical section. Writing by path
      // without this tolerance is what produced an EINVAL crash in an earlier revision.
      try {
        writeFileSync(owner, `${String(process.pid)}\n`);
      } catch {
        continue;
      }
      return { lock, ino: statSync(lock).ino };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      // Age comes from the filesystem, never from the lock's content: an earlier revision read the
      // holder's start time out of an EMPTY lock file, so `Number("") || 0` was 0, every waiter
      // computed an age of ~1.7e12 ms and evicted a LIVE lock.
      let measured;
      try {
        measured = statSync(lock);
      } catch { continue; }                             // released under us; retry the create
      // HOLDER LIVENESS, so a crashed holder is reclaimed IMMEDIATELY instead of blocking every
      // writer for the whole stale window. `mtimeMs` remains the fallback for a lock whose owner
      // file we cannot read. Pid reuse makes us see a live pid and NOT evict, which is the safe
      // direction -- the inode-verified transfer below is what protects the critical section.
      let holderPid = NaN;
      try {
        holderPid = Number.parseInt(readFileSync(owner, "utf8").trim(), 10);
      } catch { /* no owner file yet; fall back to age */ }
      const abandoned = Number.isInteger(holderPid) ? !holderAlive(holderPid) : Date.now() - measured.mtimeMs > staleMs;
      if (abandoned || Date.now() - measured.mtimeMs > staleMs) {
        const tombstone = `${lock}.stale.${randomUUID()}`;
        try {
          renameSync(lock, tombstone);
        } catch (renameError) {
          if (renameError?.code === "ENOENT") continue; // another waiter got there first
          throw renameError;
        }
        let moved;
        try {
          moved = statSync(tombstone);
        } catch { continue; }
        if (moved.ino !== measured.ino) {
          // We moved a lock that was NOT the stale one we measured -- a successor's live lock.
          try { renameSync(tombstone, lock); } catch { rmSync(tombstone, { recursive: true, force: true }); }
          continue;
        }
        rmSync(tombstone, { recursive: true, force: true });
        continue;                                      // provably evicted; retry the create
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
  try {
    if (statSync(held.lock).ino !== held.ino) return;   // not ours any more
  } catch { return; }                                   // already gone
  try { rmSync(held.lock, { recursive: true, force: true }); } catch { /* already gone */ }
}

/**
 * Exported so the coverage can drive the lock's own contract directly: mutual exclusion, and a
 * release that removes ONLY the lock it was given. Observing this through a race is unreliable; the
 * property is about the token, so the case asserts the token.
 */
export const acquireLock = acquire;

/** Release a lock token. Exported for the coverage's successor-release case. */
export const releaseHeld = releaseLock;

/** Is the process that wrote this claim still alive? EPERM means alive but not ours. */
function holderAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
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
    writeFileSync(claim, `${String(process.pid)}\n`, { flag: "wx" });
    return true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  // A claim whose holder is GONE is reclaimable immediately -- the holder cannot be mid-append.
  // A claim we cannot attribute (created but not yet written) is reclaimable only after a grace
  // period, because a live writer may be between the create and the write this instant.
  let pid = NaN;
  let mtimeMs = 0;
  try {
    pid = Number.parseInt(readFileSync(claim, "utf8").trim(), 10);
    mtimeMs = statSync(claim).mtimeMs;
  } catch { return false; }
  const abandoned = holderAlive(pid) ? false : Number.isInteger(pid) || Date.now() - mtimeMs > claimGraceMs;
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
    writeFileSync(claim, `${String(process.pid)}\n`, { flag: "wx" });
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

  const held = acquire(dirname(indexPath), options);
  try {
    const logBefore = existsSync(log) ? readFileSync(log, "utf8") : "";
    const indexBefore = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
    const byteLen = (s) => Buffer.byteLength(s, "utf8");

    // THE LOG DECIDES WHETHER THE FACT IS RECORDED. If it is there, we are done appending -- but we
    // still finish the publication, because an interruption after the log write and before the
    // rename leaves the fact durable and invisible.
    if (logBefore.includes(`<!-- ${key} -->`)) {
      const repaired = ensurePublished(indexPath, logBefore, indexBefore, cap, options);
      return { appended: false, alreadyPresent: true, indexRepaired: repaired, key, logPath: log, indexPath,
        bytesBefore: byteLen(indexBefore),
        bytesAfter: repaired ? byteLen(readFileSync(indexPath, "utf8")) : byteLen(indexBefore) };
    }

    const claim = join(notesDir, ".claims", key);
    if (!tryClaim(claim, options)) {
      // A claim exists and the fact is NOT in the log. Either a live writer is mid-append, or the
      // holder died. tryClaim has already reclaimed it if the holder was gone, so reaching here
      // means a live writer owns it.
      throw Object.assign(
        new Error(`another process is writing this fact; retry to finish it`),
        { code: "EINPROGRESS" },
      );
    }

    try {
      const entry = `\n## ${new Date().toISOString()} <!-- ${key} -->\n\n${body}\n`;
      // Cap is checked on the folded result BEFORE any write, so a refusal leaves no orphan entry.
      const projected = foldIndex(indexBefore, logBefore + entry, options.section);
      const projectedSize = byteLen(projected);
      if (projectedSize > cap) {
        throw Object.assign(
          new Error(`appending would put the index at ${projectedSize} B, over the ${cap} B cap; migrate first`),
          { code: "ECAP" },
        );
      }

      // 1. THE DURABLE COPY, first, and flushed to disk before the index is touched.
      const fd = openSync(log, "a");
      try {
        writeSync(fd, entry);
        fsyncSync(fd);        // the fact must survive a crash that happens after this point
      } finally {
        closeSync(fd);
      }

      // 2. VERIFY the fact is readable where we claim to have put it, before publishing anything.
      const logAfter = readFileSync(log, "utf8");
      if (!logAfter.includes(`<!-- ${key} -->`)) {
        throw Object.assign(new Error("log write did not take effect; index left untouched"), { code: "EVERIFY" });
      }

      // 3. PUBLISH by temp + atomic rename, re-folded from the log as it actually landed so a
      // concurrent writer's entry is included too.
      const published = publishIndex(indexPath, foldIndex(indexBefore, logAfter, options.section));
      return { appended: true, alreadyPresent: false, indexChanged: true, key, logPath: log, indexPath,
        bytesBefore: published.bytesBefore,
        bytesAfter: published.bytesAfter,
        logBytesBefore: byteLen(logBefore),
        logBytesAfter: byteLen(logAfter) };
    } catch (error) {
      // An ordinary failure rolls the claim back so the fact can be retried. A HARD kill cannot run
      // this, which is exactly why recovery is driven by the log and by PID liveness instead.
      try { rmSync(claim, { force: true }); } catch { /* nothing to release */ }
      throw error;
    }
  } finally {
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
  const held = acquire(dirname(indexPath), options);
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
