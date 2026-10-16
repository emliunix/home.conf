#!/usr/bin/env node
// admitted-fixture -- a cheap payload that runs UNDER the heavy-gate admission slot.
//
// WHY THIS EXISTS. `tests/check-dispatch.mjs` proves the serialization property with a RED/GREEN
// pair: two runs under the guard must NOT overlap, and the same two runs with the guard removed
// MUST overlap. Without the control the first arm could pass on a machine that merely ran them
// slowly, and the control is what shows the guard is doing the work.
//
// The old pair drove the retired lock's CLI (`gate-lock.mjs --lock-file … -- <fixture>`). The lock
// is gone, so the pair now drives the replacement: this file ACQUIRES the slot with the real
// `gate-admission.mjs`, records its own start/end events, and releases.
//
// ⚠ THIS IS A FIXTURE, NOT A GATE. Its payload is two lines appended to a log and a bounded sleep --
// milliseconds. It does not build, check, or read a document. An arm that ran the real compound here
// would put a minutes-long population inside a hook that fires on every `skills/` commit.
//
// ⚠⚠ THE CONTROL POLLS FOR ITS PEER, AND THAT IS NOT AN OPTIMISATION -- IT IS THE FIX FOR A
// MEASURED FLAKE. The unlocked control needs the two children to be RUNNING AT THE SAME TIME, and a
// fixed sleep only hopes they were launched close enough together for that. MEASURED here: with a
// 120 ms hold and two `spawn`s issued together, the children still ran strictly one after the other
// -- `D start … D end … C start … C end` -- because process startup jitter exceeds a short window.
// The control then FAILED with "did not overlap, so the fixture cannot prove serialization", which
// is the arm correctly refusing to pass vacuously... and also, on a loaded host, refusing to pass at
// all. The sibling repository measured the same thing under a real push at load ~130 and replaced a
// fixed sleep with polling for the same reason. So: each run publishes its start, then WAITS for its
// peer's start (bounded). Under the guard the peer cannot start, so the wait expires and the events
// stay sequential; unguarded, both are live together and the overlap is a fact rather than a hope.

import { appendFileSync, readFileSync } from "node:fs";

import {
  acquireAdmission,
  releaseAdmission,
  resolveAdmissionPort,
  EXIT_ADMISSION_DENIED,
} from "../scripts/gate-admission.mjs";

const args = process.argv.slice(2);
const valueOf = (flag) => args[args.indexOf(flag) + 1];
const statePath = valueOf("--state");
const holdMs = Number(valueOf("--hold-ms"));
const tag = valueOf("--tag");
// How long to wait for the peer's start line before concluding it is not coming. Bounded, and
// generous relative to process startup, so a slow host reports the truth rather than a flake.
const peerWaitMs = Number(valueOf("--peer-wait-ms") ?? 900);

if (!statePath || !tag || !Number.isFinite(holdMs)) {
  console.error("admitted-fixture: --state, --hold-ms and --tag are required");
  process.exit(64);
}

// ⚠ THE PORT COMES FROM THE TEST SEAM, NOT THE CONSTANT. `check-dispatch.mjs` runs on every
// `skills/` commit, and a real heavy gate may be holding the DEFAULT port on this host at that
// moment -- the fixture would then be refused and the arm would redden about the host rather than
// about serialization. That is the false-red mode this whole card removes, reproduced inside its
// own suite. The caller sets `GATE_ADMISSION_PORT` for both children (the seam's stated use); the
// CONSTANT itself is pinned separately by the anchor-invariance case.
const admission = await acquireAdmission({ port: resolveAdmissionPort() });
if (!admission.ok) {
  // Reported rather than thrown: the arms treat a refusal as a distinct outcome, and a stack trace
  // would hide which code it was.
  process.exit(EXIT_ADMISSION_DENIED);
}

appendFileSync(statePath, `${tag} start ${Date.now()} ${process.pid}\n`);

// Wait for the peer's start. If it arrives, we are provably concurrent with it.
const peerSeen = (() => {
  const deadline = Date.now() + peerWaitMs;
  while (Date.now() < deadline) {
    let lines = "";
    try {
      lines = readFileSync(statePath, "utf8");
    } catch {
      /* the peer may not have created the file yet */
    }
    const peerStarted = lines
      .split("\n")
      .some((line) => line.trim() && !line.startsWith(tag) && line.includes(" start "));
    if (peerStarted) return true;
    // A bounded busy-wait, in-process: this fixture must not pull in timers, and the window is small.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
  return false;
})();

if (peerSeen) appendFileSync(statePath, `${tag} peer-seen ${Date.now()} ${process.pid}\n`);

Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs);
appendFileSync(statePath, `${tag} end ${Date.now()} ${process.pid}\n`);

releaseAdmission(admission.server);
process.exit(0);
