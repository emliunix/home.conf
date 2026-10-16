#!/usr/bin/env node
// run-admitted-check -- run home.conf's heavy gate under a fixed loopback admission slot (#329).
//
// WHY THIS FILE EXISTS. home.conf's heavy gate is invoked BY HAND (`npm run check`), and it runs a
// COMPOUND: `npm run build && node doc-verify/dist/cli.js check …`. Nothing serialized it. Two
// hand-started gates -- or one here and one in `agent-substrate` -- could run at once, and the
// measured cost of that overlap is a FALSE RED: the suite reports a failure about the machine
// rather than the tree, which is the "instrument answers a different question" defect.
//
// The previous guard was `skills/worktree-sop/scripts/gate-lock.mjs`, a PATH-KEYED lock FILE whose
// default path was `tmpdir()/home-conf-heavy-gate.lock`. `os.tmpdir()` honours `TMPDIR`, so two
// runs with different temp roots computed DIFFERENT paths, each acquired "the" lock, and BOTH ran.
// It also carried a liveness-blind staleness arm that could displace an ALIVE holder, plus the
// holder classification, tombstones and quarantine machinery that only exist because the guard was
// a file. Removed here (see the card's deletion list): the file lock, its classification, and the
// cases that pinned that machinery.
//
// ---------------------------------------------------------------------------------------
// WHERE THE BIND SITS, AND THE LIFETIME THIS MAY AND MAY NOT CLAIM
// ---------------------------------------------------------------------------------------
// The admitted unit is THIS WRAPPER around the COMPOUND. Start point: immediately below, before the
// compound is spawned. Release point: on every exit path, plus the kernel's own cleanup.
//
// ⚠⚠ THIS DOES NOT HAVE `agent-substrate`'s DEEPER PROPERTY, AND MUST NOT BE DESCRIBED AS HAVING
// IT. There (task #328) the bind sits in the process that RUNS THE WORK, so killing the wrapper
// leaves admission REFUSED while the work continues. Here the binder IS the wrapper, so a wrapper
// `SIGKILL` RELEASES the slot (the kernel drops it with the process) while the compound, if it was
// reparented rather than killed, may still be running.
//
// That is **equal-to-or-better than the incumbent**, not equal to the sibling. The incumbent's lock
// outlived its holder as a stale FILE that the next waiter had to classify, reclaim and tombstone;
// this slot simply disappears. The claim is therefore exactly: **the wrapper covers the compound,
// not an individual child, and not arbitrary descendants that outlive it.**
//
// ⚠ AND THE COST IS THE MIRROR OF #328's, STATED SO NOBODY READS ONE AS THE OTHER:
//   - this wrapper: a SIGKILL'd wrapper frees the slot (may admit a second gate over a surviving
//     compound);
//   - sandbox-deploy: a SIGKILL'd wrapper keeps the slot (refuses new gates until the work dies).
// Same primitive, opposite availability failure. Neither is a defect; they are different seats.
//
// ---------------------------------------------------------------------------------------
// ⚠ THE PORT IS SHARED WITH `agent-substrate` BY DUPLICATION, NOT BY A COMMON SOURCE
// ---------------------------------------------------------------------------------------
// For a gate here to exclude a gate there, both must bind the SAME port. That pairing has no shared
// source of truth: this repository cannot read the other one, so the constant is duplicated and
// each side pins its own copy. **A drift is SILENT** -- each repository keeps serializing its own
// gates and only the cross-repository exclusion vanishes. See `gate-admission.mjs`'s header.
//
// ---------------------------------------------------------------------------------------
// EXIT CODES
// ---------------------------------------------------------------------------------------
//   the compound's own code   passed through unchanged
//   EXIT 75                   the gate never ran: admission was held past the budget.
//                             **A caller must read 75 as "the gate did not run", NOT as a red
//                             about the tree.** 75 is chosen so it cannot be confused with the
//                             compound's own failure code (1).
//   EXIT 64                   usage error (EX_USAGE): this wrapper takes no argument. It is a
//                             fixed entry point, and accepting one would let a caller run something
//                             the admission does not describe.
//
// Usage:  npm run check          (the human-facing seat; `check` is wired to this file)
//         node skills/worktree-sop/scripts/run-admitted-check.mjs
//
//         There is no admission argument here. The only test seam is `GATE_ADMISSION_PORT`, read by
//         `gate-admission.mjs`; see its bypass bound.

import { spawnSync } from "node:child_process";

import {
  acquireAdmission,
  releaseAdmission,
  resolveAdmissionPort,
  ADMISSION_TIMEOUT_MS,
  EXIT_ADMISSION_DENIED,
} from "./gate-admission.mjs";

const EXIT_USAGE = 64;

// ⚠ NO ARGUMENTS, ON PURPOSE. This is a fixed seat, and an argument would let a caller run an
// arbitrary command while the admission block still describes the compound. (The sibling repo
// learned the adjacent lesson the hard way: a wrapper whose DEFAULT is an expensive population
// started two accidental full gates. The rule is the same -- the wrapper runs what it names, and
// nothing the caller supplies changes that.)
const extraArgs = process.argv.slice(2);
if (extraArgs.length > 0) {
  console.error(`run-admitted-check: FAIL: unexpected argument(s): ${extraArgs.join(" ")}`);
  console.error("");
  console.error("  This wrapper takes NO arguments: it is the fixed seat for the repository's");
  console.error("  heavy gate, and it runs the compound named below. An argument would let a");
  console.error("  caller run something the admission block does not describe.");
  console.error("");
  console.error("  Usage: npm run check");
  process.exit(EXIT_USAGE);
}

const port = resolveAdmissionPort();
const admission = await acquireAdmission({ port });

if (!admission.ok) {
  // ⚠ THE DECLINE IS LOUD AND NAMED, AND IT IS THE IMPROVEMENT OVER THE INCUMBENT. `gate-lock.mjs`
  // could displace a live holder and print NOTHING (it contains no `console.*` call at all), and
  // its quarantine unlinked its own tombstone, so the defect left no trace by construction. This
  // binder cannot displace, and when it withholds it says so with the port, the code, and the wait.
  const waited = admission.waitedMs ?? 0;
  console.error("");
  console.error(
    `FAIL: heavy-gate admission was refused on 127.0.0.1:${port} (${admission.code}) after ` +
      `${Math.round(waited / 1000)}s of a ${Math.round(ADMISSION_TIMEOUT_MS / 1000)}s budget.`,
  );
  console.error("");
  console.error("  Another gate holds the slot. This process did NOT run any build or check, so a");
  console.error("  caller must read this as 'the gate did not run' -- NOT as a red about the tree.");
  console.error("  Exit 75 is reserved for exactly this and matches the retired lock's contract.");
  process.exit(EXIT_ADMISSION_DENIED);
}

// Release on every exit path, so a finished gate frees admission immediately rather than at
// process teardown. Registered before the compound so an unexpected throw still releases.
process.on("exit", () => releaseAdmission(admission.server));

// ⚠ `spawnSync`, NOT `spawn`: the whole of this wrapper's contribution is that the caller does not
// return until the COMPOUND has finished. An async spawn would return while `npm run build` or the
// CLI check were still running, which would make the admitted lifetime shorter than the work and
// re-admit the overlap this exists to remove.
//
// The compound is `package.json`'s `check:compound`, so the argument list lives in exactly ONE
// place. Repeating it here would be a second copy to drift -- the same shape as the shared port.
const result = spawnSync("npm", ["run", "--silent", "check:compound"], { stdio: "inherit" });

// Explicit release, in addition to the `exit` handler: a finished gate should free the slot the
// moment the compound returns, not when the runtime gets around to tearing the process down.
releaseAdmission(admission.server);
process.exit(result.status ?? 1);
