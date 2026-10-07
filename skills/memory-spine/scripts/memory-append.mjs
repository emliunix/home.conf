#!/usr/bin/env node
// memory-append -- add one durable fact without hand-editing MEMORY.md.
//
// WHY THIS EXISTS. MEMORY.md must not be the record: hand-editing it via anchored replacement
// grows it without bound and can leave it half-applied. So a fact is appended to a dated
// append-only LOG first, and MEMORY.md is rewritten only as a bounded index by the caller.
//
// FLUSH ORDER IS THE WHOLE CONTRACT (order chosen so no interruption loses the only copy):
//   1. take an exclusive lock            -- serialize concurrent writers
//   2. append the fact to the log        -- the DURABLE copy lands FIRST, and fsync'd
//   3. read + verify the log             -- the fact is readable before anything is published
//   4. publish the index by temp+rename  -- a reader sees old or new, never a partial file
//   5. release the lock
// An interruption at any step leaves the previous valid index in place, and never a fact that
// exists only in an unpublished buffer.
//
// IDEMPOTENCE. Each fact carries a content hash; appending the same fact twice writes one log
// entry. A retry after a crash therefore cannot duplicate a record.
//
// EXIT CODES. 0 appended (or already present); 1 refused, nothing changed; 64 invalid input.

import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  renameSync, statSync, unlinkSync, writeFileSync, writeSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

export function factKey(text) {
  return createHash("sha256").update(text.trim(), "utf8").digest("hex").slice(0, 16);
}

/** Log path for a workspace: <notesDir>/memory-log-<YYYY-MM-DD>.md -- dated, so it rotates. */
export function logPathFor(notesDir, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  return join(notesDir, `memory-log-${day}.md`);
}

function acquire(lockDir, { timeoutMs = 10_000, pollMs = 25, staleMs = 60_000 } = {}) {
  const lock = join(lockDir, "memory-append.lock");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      // EXCLUSIVE CREATE. `wx` fails when the path exists, which IS the mutual exclusion; `w`
      // here would let two writers both believe they hold the lock.
      closeSync(openSync(lock, "wx"));
      return lock;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      // Stale recovery: a crashed holder must not wedge every future append.
      try {
        // THE AGE MUST COME FROM THE FILESYSTEM, NOT FROM THE FILE'S CONTENT. An earlier revision
        // wrote nothing into the lock and read the holder's start time out of it, so `Number("") ||
        // 0` was 0 and every waiter computed an age of ~1.7e12 ms -- it evicted a LIVE lock and
        // entered the critical section. Sequential use hid this completely; eight barriered writers
        // produced duplicate entries immediately. `mtimeMs` is set by the filesystem at creation, so
        // it is present for every holder, including one that has not written anything yet.
        const age = Date.now() - statSync(lock).mtimeMs;
        if (age > staleMs) { unlinkSync(lock); continue; }
      } catch { /* holder still starting up; fall through to the wait */ }
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
 * Append one fact. Returns a receipt: byte counts BEFORE/AFTER, the log path, and whether the
 * write was a no-op because the fact was already present.
 */
export function appendFact(indexPath, fact, options = {}) {
  const notesDir = options.notesDir ?? join(dirname(indexPath), "notes");
  mkdirSync(notesDir, { recursive: true });
  const log = options.logPath ?? logPathFor(notesDir, options.date);
  const body = fact.trim();
  if (body.length === 0) throw Object.assign(new Error("refusing to append an empty fact"), { code: "EEMPTY" });
  const key = factKey(body);

  const lockDir = dirname(indexPath);
  const lock = acquire(lockDir, options);
  try {
    const logBefore = existsSync(log) ? readFileSync(log, "utf8") : "";
    const indexBefore = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";

    // IDEMPOTENT: the same fact appended twice is one entry. Checked under the lock so a
    // concurrent duplicate cannot interleave between check and write.
    if (logBefore.includes(`<!-- ${key} -->`)) {
      return { appended: false, key, logPath: log, indexPath,
        bytesBefore: Buffer.byteLength(indexBefore, "utf8"),
        bytesAfter: Buffer.byteLength(indexBefore, "utf8") };
    }

    // 1. THE DURABLE COPY, first, and flushed to disk before the index is touched.
    const entry = `\n## ${new Date().toISOString()} <!-- ${key} -->\n\n${body}\n`;
    const fd = openSync(log, "a");
    try {
      writeSync(fd, entry);
      fsyncSync(fd);          // the fact must survive a crash that happens after this point
    } finally {
      closeSync(fd);
    }

    // 2. VERIFY the fact is readable where we claim to have put it, before publishing anything.
    const logAfter = readFileSync(log, "utf8");
    if (!logAfter.includes(`<!-- ${key} -->`)) {
      throw Object.assign(new Error("log write did not take effect; index left untouched"), { code: "EVERIFY" });
    }

    return { appended: true, key, logPath: log, indexPath,
      bytesBefore: Buffer.byteLength(indexBefore, "utf8"),
      bytesAfter: Buffer.byteLength(indexBefore, "utf8"),
      logBytesBefore: Buffer.byteLength(logBefore, "utf8"),
      logBytesAfter: Buffer.byteLength(logAfter, "utf8") };
  } finally {
    try { unlinkSync(lock); } catch { /* already gone */ }
  }
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
      console.log(`OK (already present): ${receipt.key} -- ${receipt.logPath}; index unchanged at ${receipt.bytesAfter} B`);
    } else {
      console.log(
        `OK: ${receipt.key} appended to ${receipt.logPath} ` +
        `(log ${receipt.logBytesBefore} -> ${receipt.logBytesAfter} B); ` +
        `index ${receipt.indexPath} untouched at ${receipt.bytesAfter} B`,
      );
    }
    process.exit(0);
  } catch (error) {
    console.error(`REFUSED: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
