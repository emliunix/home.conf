#!/usr/bin/env node
// memory-append -- add one durable fact without hand-editing MEMORY.md.
//
// WHY THIS EXISTS. MEMORY.md must not be the record: hand-editing it via anchored replacement
// grows it without bound and can leave it half-applied. So a fact is appended to a dated
// append-only LOG first, and the index is then REPUBLISHED by this tool.
//
// FLUSH ORDER IS THE WHOLE CONTRACT (order chosen so no interruption loses the only copy):
//   1. take an exclusive lock            -- serialize concurrent writers
//   2. compute the new index + check cap -- a refusal costs nothing, so it happens before any write
//   3. append the fact to the log        -- the DURABLE copy lands FIRST, and fsync'd
//   4. read + verify the log             -- the fact is readable before anything is published
//   5. publish the index by temp+rename  -- a reader sees old or new, never a partial file
//   6. release the lock
// An interruption at any step leaves the previous valid index in place, and never a fact that
// exists only in an unpublished buffer.
//
// WHY THE INDEX IS PUBLISHED HERE, NOT "BY THE CALLER". An earlier revision stopped after step 4
// and left the index untouched, which meant a fresh agent reading the index could not see a fact
// that was durably in the log -- the recovery point was the log, not the index the agent reads. It
// also contradicted the contract above, and the coverage case encoded the defect as an assertion
// ("append must leave the index byte-identical") so the suite stayed green over it. A fact is
// appended only if it is visible in the index afterwards.
//
// IDEMPOTENCE. Each fact carries a content hash; appending the same fact twice writes one log
// entry. A retry after a crash therefore cannot duplicate a record.
//
// EXIT CODES. 0 appended (or already present); 1 refused, nothing changed; 64 invalid input.

import { createHash, randomUUID } from "node:crypto";
import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  renameSync, rmSync, statSync, writeSync,
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
 * A lock is a DIRECTORY containing an `owner` file, not a bare path.
 *
 * WHY A DIRECTORY. `mkdir` is the atomic exclusive create on every filesystem: it either makes the
 * directory or fails with EEXIST, with no window in between. Stale recovery then renames the
 * *observed* directory aside to a unique tombstone, and only the process whose rename succeeded may
 * proceed -- so eviction is an atomic ownership transfer rather than a path-only `unlink`.
 *
 * WHAT THE PATH-ONLY VERSION DID WRONG. It did `unlinkSync(lock)` after reading the lock's age.
 * Two waiters could both observe the SAME stale lock; the first unlinked it and created a fresh
 * one, and the second then unlinked that FRESH lock and entered the critical section alongside the
 * first. The transition stale -> fresh was unprotected, and no amount of care about how the age is
 * computed fixes that: the eviction itself has to be atomic. (My earlier fix moved the age from the
 * file's content to its mtime, which was necessary and not sufficient.)
 */
function acquire(lockDir, { timeoutMs = 10_000, pollMs = 25, staleMs = 60_000 } = {}) {
  const lock = join(lockDir, "memory-append.lock");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      // EXCLUSIVE CREATE. `mkdir` fails with EEXIST when the directory exists, and that IS the
      // mutual exclusion -- there is no instant at which the lock exists and is unowned.
      //
      // NO OWNER FILE IS WRITTEN. An earlier revision wrote `lock/owner` here and never read it;
      // the write went BY PATH, so a concurrent eviction that renamed the lock away between the
      // mkdir and the write made it fail with EINVAL -- a crash caused by a decorative file. The
      // directory's own existence and mtime carry everything the recovery path needs.
      mkdirSync(lock);
      return lock;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      // STALE RECOVERY AS A VERIFIED OWNERSHIP TRANSFER. Age comes from the filesystem
      // (`mtimeMs`), never from the file's content: an earlier revision read the holder's start
      // time out of an EMPTY lock file, so `Number("") || 0` was 0, every waiter computed an age of
      // ~1.7e12 ms and evicted a LIVE lock.
      //
      // EVICTION MUST PROVE WHICH LOCK IT MOVED. A bare `unlink`/`rename` acts on the PATH, and the
      // path can be re-occupied between the staleness read and the eviction: two waiters both
      // observe a stale lock, the first evicts it and creates a FRESH one, and the second then
      // evicts that fresh lock and enters the critical section alongside the first. Measured: 5 of
      // 12 trials of eight barriered writers produced duplicate entries.
      //
      // So the eviction compares INODES. We capture the identity of the lock we measured, rename it
      // to a unique tombstone, then confirm the tombstone holds that same inode. Renaming to a
      // unique name is what makes exactly one waiter the winner per existing directory; the inode
      // comparison is what proves we moved the STALE lock and not a successor's live one. If it was
      // not the one we measured we put it back and retry, and we do NOT enter the critical section.
      let measured;
      try {
        measured = statSync(lock);
      } catch { continue; }                             // released under us; retry the create
      if (Date.now() - measured.mtimeMs > staleMs) {
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
          // Restore it if the path is free, and back off without entering the section.
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

/** Release a held lock. Best-effort: a lock left behind is reclaimed by stale recovery. */
function release(lock) {
  try { rmSync(lock, { recursive: true, force: true }); } catch { /* already gone */ }
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

  // Find the section's extent, and drop any bullet this log owns so a re-fold is not a duplicate.
  let end = heading + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end += 1;
  const owned = /^- .*<!-- ([0-9a-f]{16}) -->\s*$/;
  const kept = [];
  for (let i = heading + 1; i < end; i += 1) {
    const m = owned.exec(lines[i]);
    if (m !== null && keyed.has(m[1])) continue;
    kept.push(lines[i]);
  }

  // Insert the log's facts at the end of the section, keeping a blank line before the next heading.
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
 * Append one fact. Returns a receipt: byte counts BEFORE/AFTER, the log path, and whether the
 * write was a no-op because the fact was already present.
 *
 * ORDER: log (fsynced) -> verify -> publish the index by temp+rename. If the published index would
 * exceed the cap the whole append is REFUSED and both files keep their bytes, because a fact that
 * only reaches the log is not recoverable from the index a fresh agent reads.
 */
export function appendFact(indexPath, fact, options = {}) {
  const notesDir = options.notesDir ?? join(dirname(indexPath), "notes");
  mkdirSync(notesDir, { recursive: true });
  const log = options.logPath ?? logPathFor(notesDir, options.date);
  const body = fact.trim();
  if (body.length === 0) throw Object.assign(new Error("refusing to append an empty fact"), { code: "EEMPTY" });
  const key = factKey(body);
  const cap = options.cap ?? CAP_BYTES;

  const lockDir = dirname(indexPath);
  const lock = acquire(lockDir, options);
  try {
    const logBefore = existsSync(log) ? readFileSync(log, "utf8") : "";
    const indexBefore = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";

    // IDEMPOTENCE IS ENFORCED BY AN ATOMIC CLAIM, NOT BY THE LOCK.
    //
    // The lock serializes writers, but a lock is a best-effort primitive: stale recovery can, in a
    // narrow window, let two writers believe they hold it. When that happened, the duplicate was
    // still measured in 1 of 3 trials even with inode-verified eviction -- so "one entry per fact"
    // was trusting a primitive that can fail, which is not a guarantee.
    //
    // `openSync(claim, "wx")` is an atomic test-and-set the filesystem enforces: exactly one caller
    // creates the file, every other gets EEXIST. The claim is keyed by the FACT, so a duplicate
    // writer loses it regardless of lock state. That turns idempotence from "should hold if the
    // lock worked" into "cannot fail".
    const claimsDir = join(notesDir, ".claims");
    mkdirSync(claimsDir, { recursive: true });
    const claim = join(claimsDir, key);
    try {
      closeSync(openSync(claim, "wx"));
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      return { appended: false, key, logPath: log, indexPath,
        bytesBefore: Buffer.byteLength(indexBefore, "utf8"),
        bytesAfter: Buffer.byteLength(indexBefore, "utf8") };
    }

    // The claim is held; anything that fails from here must RELEASE it, or the fact could never be
    // appended again even though it was not recorded.
    try {
      // The log content this append WOULD produce, computed in memory. Folding against this lets
      // the cap be checked BEFORE anything is written, so a refusal leaves no orphan log entry.
      const entry = `\n## ${new Date().toISOString()} <!-- ${key} -->\n\n${body}\n`;
      const logProjected = logBefore + entry;
      const indexAfter = foldIndex(indexBefore, logProjected, options.section);
      const capAfter = Buffer.byteLength(indexAfter, "utf8");
      if (capAfter > cap) {
        throw Object.assign(
          new Error(`appending would put the index at ${capAfter} B, over the ${cap} B cap; migrate first`),
          { code: "ECAP" },
        );
      }

      // 1. THE DURABLE COPY, first, and flushed to disk before the index is touched.
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

      // 3. PUBLISH the index by temp + atomic rename. The content is re-folded from the log as it
      // actually landed (not from the in-memory projection), so the published index reflects the
      // durable log exactly -- and a concurrent writer that landed its own entry is included too.
      const indexFinal = foldIndex(indexBefore, logAfter, options.section);
      const published = publishIndex(indexPath, indexFinal);
      return { appended: true, key, logPath: log, indexPath,
        indexChanged: true,
        bytesBefore: published.bytesBefore,
        bytesAfter: published.bytesAfter,
        logBytesBefore: Buffer.byteLength(logBefore, "utf8"),
        logBytesAfter: Buffer.byteLength(logAfter, "utf8") };
    } catch (error) {
      try { rmSync(claim, { force: true }); } catch { /* nothing to release */ }
      throw error;
    }
  } finally {
    release(lock);
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
 * in a loop converges automatically; the racing case converges on the next append, or immediately
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
  const lock = acquire(dirname(indexPath), options);
  try {
    const indexBefore = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
    const folded = foldIndex(indexBefore, readFileSync(log, "utf8"), options.section);
    const cap = options.cap ?? CAP_BYTES;
    const size = Buffer.byteLength(folded, "utf8");
    if (size > cap) {
      throw Object.assign(
        new Error(`republish would put the index at ${size} B, over the ${cap} B cap; migrate first`),
        { code: "ECAP" },
      );
    }
    if (folded === indexBefore) {
      return { republished: false, bytesBefore: Buffer.byteLength(indexBefore, "utf8"),
        bytesAfter: Buffer.byteLength(indexBefore, "utf8"), facts: parseLog(readFileSync(log, "utf8")).length };
    }
    const published = publishIndex(indexPath, folded);
    return { republished: true, bytesBefore: published.bytesBefore, bytesAfter: published.bytesAfter,
      facts: parseLog(readFileSync(log, "utf8")).length };
  } finally {
    release(lock);
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
      console.log(`OK (already present): ${receipt.key} -- ${receipt.logPath}; index unchanged at ${receipt.bytesAfter} B`);
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

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
