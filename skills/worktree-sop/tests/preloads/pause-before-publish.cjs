// Preload that pauses a holder at its publish boundary, so a test can inspect the lock path
// exactly while a holder is between "created" and "complete".
//
// WHY THIS EXISTS. The corrected lock publishes atomically: a complete staging file is linked
// into place, so the lock path is only ever ABSENT or COMPLETE. This preload exposes the moment
// immediately before that publish, letting a waiter run while the holder is mid-acquisition.
// The case then asserts that no waiter can observe a present-but-empty lock — the state the
// landed lock exposed and the reason it could evict a live holder.
//
// It hooks BOTH publish primitives so it still reaches its pause under a mutated (non-atomic)
// script, which is what lets the seeded defect redden:
//   - `linkSync(staging, lockPath)`  -> pause BEFORE delegating: path still absent.
//   - `openSync(lockPath, "wx")`     -> pause AFTER delegating: path present and empty, which is
//                                       precisely the defect state the case must catch.
//
// Activated only by env, so it is inert for every other invocation.

const fs = require("node:fs");
const path = require("node:path");

const log = process.env.GATE_LOCK_PAUSE_LOG;
const lockPath = process.env.GATE_LOCK_PAUSE_PATH;
const releaseFile = process.env.GATE_LOCK_PAUSE_RELEASE;
const pauseMs = Number(process.env.GATE_LOCK_PAUSE_MS || "15000");

if (log && lockPath) {
  const target = path.resolve(lockPath);
  const resolveTarget = (candidate) => {
    try {
      return path.resolve(String(candidate));
    } catch {
      return undefined;
    }
  };

  const pauseForRelease = (marker) => {
    fs.appendFileSync(log, `${marker}\n`);
    const deadline = Date.now() + pauseMs;
    while (!fs.existsSync(releaseFile) && Date.now() < deadline) {
      // The parent releases this holder by creating `releaseFile`.
    }
  };

  const realLink = fs.linkSync;
  let pausedBeforePublish = false;
  fs.linkSync = function (source, destination) {
    if (!pausedBeforePublish && resolveTarget(destination) === target) {
      pausedBeforePublish = true;
      pauseForRelease("STAGING_WRITTEN");
    }
    return Reflect.apply(realLink, this, arguments);
  };

  const realOpen = fs.openSync;
  let pausedAfterCreate = false;
  fs.openSync = function (file, flags, mode) {
    const result = Reflect.apply(realOpen, this, arguments);
    if (
      !pausedAfterCreate &&
      flags === "wx" &&
      resolveTarget(file) === target
    ) {
      pausedAfterCreate = true;
      pauseForRelease("CREATED_THEN_EMPTY");
    }
    return result;
  };
}
