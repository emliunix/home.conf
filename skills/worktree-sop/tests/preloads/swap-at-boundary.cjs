// Preload that records every mutating call against the shared lock path, and can inject a
// successor at a chosen boundary so a test can drive the interleaving a "check, then act"
// sequence is vulnerable to.
//
// WHY THIS EXISTS. The module binds its `node:fs` imports at load time, so a test cannot patch
// `fs` from outside and have the module see it. A preload is the only way to observe and
// interleave at a named boundary.
//
// GATE_BOUNDARY selects where a successor may be installed:
//   "before-shared-unlink" — just before `unlinkSync(<lockPath>)`. This is release's old
//     check-then-unlink window: the identity was measured against one inode, the path is then
//     replaced, and `unlinkSync(path)` deletes the SUCCESSOR.
//   "after-claim-rename"   — just after `renameSync(<lockPath>, elsewhere)` succeeds. This is
//     quarantine's restore window: the lock is aside, a third successor wins the free path, and
//     a restore-by-rename would overwrite that successor.
//
// Every mutation of the shared path is appended to GATE_LOG as `<op> <basename>`, so assertions
// read a record of what happened instead of inferring it from the surviving bytes. An assertion
// that the shared path is never unlinked is therefore non-vacuous: it fails if the operation
// occurs, rather than passing because nothing was injected.

const fs = require("node:fs");
const path = require("node:path");

const lockPath = process.env.GATE_LOCK_PATH;
const boundary = process.env.GATE_BOUNDARY;
const successor = process.env.GATE_SUCCESSOR;
const log = process.env.GATE_LOG;

if (lockPath && log) {
  const target = path.resolve(lockPath);
  const asTarget = (candidate) => {
    try {
      return candidate === undefined
        ? undefined
        : path.resolve(String(candidate));
    } catch {
      return undefined;
    }
  };
  const note = (op, file) => {
    try {
      fs.appendFileSync(log, `${op} ${path.basename(String(file))}\n`);
    } catch {
      // Logging is best-effort; the case asserts on the log, so a failure surfaces as a miss.
    }
  };

  let injected = false;
  let injecting = false;
  const injectSuccessor = () => {
    injected = true;
    injecting = true; // the injection's own ops are the harness's, not the module's

    const staging = `${target}.inject.${process.pid}`;
    fs.writeFileSync(staging, successor ?? "", { mode: 0o600 });
    try {
      fs.unlinkSync(target);
    } catch {
      // The path may already be free; the link below is what installs it.
    }
    try {
      fs.linkSync(staging, target);
    } finally {
      injecting = false;
      try {
        fs.unlinkSync(staging);
      } catch {
        // Inert.
      }
      note("INJECTED", target);
    }
  };

  const realUnlink = fs.unlinkSync;
  fs.unlinkSync = function (file) {
    if (!injecting && asTarget(file) === target) {
      note("UNLINK-SHARED", file);
      if (!injected && boundary === "before-shared-unlink") injectSuccessor();
    }
    return Reflect.apply(realUnlink, this, arguments);
  };

  const realRename = fs.renameSync;
  fs.renameSync = function (source, destination) {
    const result = Reflect.apply(realRename, this, arguments);
    if (asTarget(source) === target) {
      note("RENAME-FROM-SHARED", source);
      if (!injected && boundary === "after-claim-rename") injectSuccessor();
    } else if (asTarget(destination) === target) {
      note("RENAME-ONTO-SHARED", destination);
    }
    return result;
  };

  const realLink = fs.linkSync;
  fs.linkSync = function (source, destination) {
    const result = Reflect.apply(realLink, this, arguments);
    if (asTarget(destination) === target) note("LINK-ONTO-SHARED", destination);
    return result;
  };

  const realOpen = fs.openSync;
  fs.openSync = function (file, flags) {
    if (asTarget(file) === target && flags === "wx") note("EXCL-CREATE", file);
    return Reflect.apply(realOpen, this, arguments);
  };
}
