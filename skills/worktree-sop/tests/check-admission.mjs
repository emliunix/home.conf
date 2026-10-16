#!/usr/bin/env node
// Seeded cases for the heavy-gate admission (#329):
//   `skills/worktree-sop/scripts/gate-admission.mjs` (the primitive)
//   `skills/worktree-sop/scripts/run-admitted-check.mjs` (the wrapper seat)
//
// WHY THIS FILE EXISTS. The guard is a REFUSAL, and a refusal that has never been observed to fire
// is indistinguishable from one that cannot. The incumbent was a path-keyed lock FILE whose whole
// defect was that two runs with different `TMPDIR`s computed DIFFERENT paths and both proceeded --
// so the cases here vary the environment deliberately rather than assuming a constant.
//
// ⚠⚠ EVERY ARM THAT NEEDS A PROCESS USES A STUB, NEVER THE REAL COMPOUND.
// The card's own rule, and it is not fastidiousness: an arm whose subject is "a refusal happens and
// the payload did not run" RUNS THE PAYLOAD the moment the guard is bypassed. The sibling repository
// measured exactly that -- a polarity arm whose holder died before acquiring, so the real gate
// acquired freely and ran the whole population while a peer was landing. **Testing a guard by
// invoking its real payload runs the payload when the guard fails.** The stubs below import the
// REAL admission module; only their payload is a marker file.
//
// ⚠ AND EVERY WAIT IS EXPLICITLY BOUNDED. `acquireAdmission`'s default budget is 20 MINUTES
// (`ADMISSION_TIMEOUT_MS`, kept for parity with the retired lock). A stub that omitted `timeoutMs`
// would BLOCK FOR TWENTY MINUTES when refused -- measured in the sibling repository, where that
// mistake hung the case file until it was killed. Each arm sets its own bound.
//
// ⚠ AND THE SAME FACT DECIDES THE HOLD: for "exactly one acquires" to mean anything, the winner
// must hold LONGER than the losers' wait budget. Otherwise the losers retry into the winner's freed
// slot and the arm measures queueing, not exclusion.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

import {
  ADMISSION_PORT,
  ADMISSION_HOST,
  ADMISSION_TIMEOUT_MS,
  EXIT_ADMISSION_DENIED,
  tryAcquireOnce,
  acquireAdmission,
  releaseAdmission,
  resolveAdmissionPort,
  ADMISSION_PORT_ENV,
} from "../scripts/gate-admission.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ADMISSION = join(ROOT, "scripts", "gate-admission.mjs");
const WRAPPER = join(ROOT, "scripts", "run-admitted-check.mjs");

const failures = [];
function fail(message) {
  failures.push(message);
}
function check(condition, message) {
  if (!condition) fail(message);
}

/** Every temp root this file mints, removed by ONE teardown at the end.
 *
 *  ⚠ THE PREFIX IS A LITERAL AT EACH CALL SITE, NOT A PARAMETER OF A SHARED HELPER, and that is
 *  deliberate: this repository's instrument conventions attribute a leaked root to its producer by
 *  scanning sources for the mint call with a static prefix. A prefix arriving as a PARAMETER is
 *  invisible to that scan -- measured in the sibling repository, where `staticPrefixes` returned
 *  `[]` for a file minting five prefixes at runtime. (LAW 857 recorded there; the same trap.) */
const created = [];
function register(dir) {
  created.push(dir);
  return dir;
}

let nextPort = 47400;
/** A HIGH port per stub, so arms never contend with each other or with a real gate. ⚠ The DEFAULT
 *  port is asserted separately; using it here would let an arm exclude a real gate. */
const freshPort = () => nextPort++;

/** A stub gate process: acquire the REAL module's slot, then run a payload that touches a marker.
 *
 * Why a written file rather than `-e`: the arms need several RUNNING AT ONCE, and a file is
 * inspectable when an arm fails. `GATE_ADMISSION_PORT` is the module's own test seam -- exactly the
 * use its bound permits (both processes are told the same port). */
function stubGate(port) {
  const dir = register(mkdtempSync(join(tmpdir(), "home-admission-stub-")));
  const marker = join(dir, "payload-ran");
  const script = join(dir, "stub-gate.mjs");
  writeFileSync(
    script,
    [
      `import { acquireAdmission, releaseAdmission, EXIT_ADMISSION_DENIED, ADMISSION_TIMEOUT_MS } from ${JSON.stringify(ADMISSION)};`,
      `import { writeFileSync } from "node:fs";`,
      `const port = Number(process.env.${ADMISSION_PORT_ENV});`,
      `const holdMs = Number(process.env.STUB_HOLD_MS ?? 0);`,
      `const waitMs = Number(process.env.STUB_WAIT_MS ?? 1200);`,
      // ⚠ CHECKED BEFORE ACQUIRING: after a refusal this line is unreachable, and a stub that
      // waited the module default would hang its arm for 20 minutes.
      `if (!(waitMs > 0) || waitMs >= ADMISSION_TIMEOUT_MS) {`,
      `  console.error("stub must bound its wait; got " + waitMs);`,
      `  process.exit(2);`,
      `}`,
      `const a = await acquireAdmission({ port, timeoutMs: waitMs });`,
      `if (!a.ok) process.exit(EXIT_ADMISSION_DENIED);`,
      `writeFileSync(${JSON.stringify(marker)}, String(process.pid));`,
      `if (holdMs > 0) await new Promise((r) => setTimeout(r, holdMs));`,
      `releaseAdmission(a.server);`,
      `process.exit(0);`,
    ].join("\n"),
  );
  return { dir, script, marker, port };
}

function runStub(stub, extra = {}) {
  const result = spawnSync(process.execPath, [stub.script], {
    encoding: "utf8",
    env: { ...process.env, [ADMISSION_PORT_ENV]: String(stub.port), ...extra },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

function spawnStub(stub, extra = {}) {
  const child = spawn(process.execPath, [stub.script], {
    env: { ...process.env, [ADMISSION_PORT_ENV]: String(stub.port), ...extra },
  });
  return new Promise((res) => child.on("close", (code) => res(code)));
}

/** Hold a port IN THIS PROCESS, so nothing can die and free it. */
function holdPort(port) {
  return new Promise((resolveHold, rejectHold) => {
    const server = net.createServer();
    server.once("error", rejectHold);
    server.listen({ port, host: ADMISSION_HOST, exclusive: true }, () => resolveHold(server));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(path, budgetMs = 5000) {
  const deadline = Date.now() + budgetMs;
  while (!existsSync(path) && Date.now() < deadline) await sleep(20);
  return existsSync(path);
}

const cases = [];

// ── A2 FIRST: it is the mechanism every other arm assumes ────────────────────────────────────────

cases.push([
  "A2 atomicity: N >= 5 true-concurrent racers -> exactly one acquires",
  async () => {
    const port = freshPort();
    const N = 5;
    // ⚠ HOLD > WAIT with margin. Winner holds 8 s; losers give up at 700 ms.
    const stubs = Array.from({ length: N }, () => stubGate(port));
    const codes = await Promise.all(
      stubs.map((s) => spawnStub(s, { STUB_HOLD_MS: "8000", STUB_WAIT_MS: "700" })),
    );
    const acquired = codes.filter((c) => c === 0).length;
    const refused = codes.filter((c) => c === EXIT_ADMISSION_DENIED).length;
    check(acquired === 1, `A2: expected EXACTLY ONE acquirer, got ${acquired} (codes ${codes.join(",")})`);
    check(refused === N - 1, `A2: expected ${N - 1} refusals, got ${refused}`);
    // The payload ran exactly once -- admission's purpose is that the WORK is exclusive.
    check(
      stubs.filter((s) => existsSync(s.marker)).length === 1,
      "A2: the payload ran more than once, so the slot did not exclude the work",
    );
  },
]);

cases.push([
  "A1 regression: differing TMPDIR and HOME do not divert admission",
  async () => {
    const port = freshPort();
    // The incumbent's defect in one line: a PATH-KEYED lock whose path followed `TMPDIR`, so two
    // runs with different temp roots took different paths and BOTH proceeded.
    const holder = stubGate(port);
    const holding = spawnStub(holder, {
      TMPDIR: "/private/tmp/admission-a",
      HOME: "/tmp/home-a",
      STUB_HOLD_MS: "5000",
      STUB_WAIT_MS: "2000",
    });
    check(await waitFor(holder.marker), "A1: the holder never acquired, so the arm has no subject");

    const contender = stubGate(port);
    const { status, output } = runStub(contender, {
      TMPDIR: "/private/tmp/admission-b",
      HOME: "/tmp/home-b",
      STUB_WAIT_MS: "700",
    });
    check(
      status === EXIT_ADMISSION_DENIED,
      `A1: a run with a different TMPDIR/HOME was NOT excluded (${status}: ${output}) -- admission ` +
        "followed the environment again, which is the incumbent's path-keyed defect",
    );
    check(!existsSync(contender.marker), "A1: the contender's payload ran despite the refusal");
    await holding;
  },
]);

cases.push([
  "A5 anchor invariance: the default port is a constant, and TMPDIR/HOME do not move it",
  () => {
    for (const env of [
      {},
      { TMPDIR: "/private/tmp/x" },
      { HOME: "/somewhere-else" },
      { TMPDIR: "/private/tmp/x", HOME: "/somewhere-else" },
      { TMPDIR: "/private/tmp/a", HOME: "/tmp/b", XDG_RUNTIME_DIR: "/tmp/c" },
    ]) {
      check(
        resolveAdmissionPort(env) === ADMISSION_PORT,
        `A5: the default port moved under ${JSON.stringify(env)}: admission must not follow the ` +
          "environment, because that is the defect being removed",
      );
    }
    // ⚠ AND THE CONSTANT IS BOUNDED, not merely stable: below the macOS ephemeral floor
    // (`net.inet.ip.portrange.first = 49152`), or the kernel could hand the port to an unrelated
    // outbound connection and admission would fail for a reason that is not another gate.
    check(
      ADMISSION_PORT < 49152,
      `A5: port ${ADMISSION_PORT} is at or above the macOS ephemeral floor (49152)`,
    );
    check(
      ADMISSION_PORT > 1024 && ADMISSION_PORT !== 5000 && ADMISSION_PORT !== 7000,
      "A5: a privileged port needs root, and 5000/7000 are bound by macOS AirPlay Receiver",
    );
  },
]);

cases.push([
  "CROSS-REPO: the port constant equals the sibling repository's literal",
  () => {
    // ⚠⚠ THIS ARM PINS A DUPLICATED VALUE, AND IT CANNOT DO MORE THAN THAT.
    // For a gate here to exclude a gate in `agent-substrate`, both must bind the SAME port. There is
    // no shared source of truth -- this repository cannot read the other one -- so the value is
    // duplicated and each side pins its own copy. **A drift is SILENT: each repository keeps
    // serializing its own gates and only the CROSS-REPOSITORY exclusion vanishes.**
    //
    // So the pinned literal below is the coordination point, and it is asserted as a LITERAL rather
    // than read from the other tree, which would make this arm depend on a checkout that may not
    // exist. Measured for this change: two binders on DIFFERENT ports do not contend -- the second
    // acquires immediately -- which is exactly the pre-change state the "one heavy gate per host"
    // rule compensates for.
    const SIBLING_PORT_LITERAL = 47123;
    check(
      ADMISSION_PORT === SIBLING_PORT_LITERAL,
      `CROSS-REPO: ADMISSION_PORT is ${ADMISSION_PORT} but agent-substrate's ` +
        `scripts/gate-admission.mjs pins ${SIBLING_PORT_LITERAL}. The two gates no longer exclude ` +
        "each other, and NOTHING ELSE REPORTS IT -- each repository still serializes its own gates.",
    );
  },
]);

cases.push([
  "A3 crash release: kill -9 the binder, then a fresh attempt acquires immediately",
  async () => {
    const port = freshPort();
    const holder = stubGate(port);
    const child = spawn(process.execPath, [holder.script], {
      env: {
        ...process.env,
        [ADMISSION_PORT_ENV]: String(port),
        STUB_HOLD_MS: "30000",
        STUB_WAIT_MS: "2000",
      },
    });
    check(await waitFor(holder.marker), "A3: the holder never acquired, so the arm has no subject");
    child.kill("SIGKILL");
    await new Promise((r) => child.on("close", r));

    const started = Date.now();
    const next = runStub(stubGate(port), { STUB_WAIT_MS: "1500" });
    const elapsed = Date.now() - started;
    check(next.status === 0, `A3: a fresh attempt was refused after SIGKILL: ${next.output}`);
    // The kernel owns the release, so this is immediate rather than a staleness timeout. 5 s is
    // generous against a 20-minute wait.
    check(elapsed < 5000, `A3: release took ${elapsed}ms: the slot did not free on binder death`);
  },
]);

cases.push([
  "A4 polarity: a held slot -> exit 75, and the payload did NOT execute",
  async () => {
    const port = freshPort();
    const holder = await holdPort(port); // in-process: nothing can die and free it mid-arm
    try {
      const refused = stubGate(port);
      const { status, output } = runStub(refused, { STUB_WAIT_MS: "700" });
      check(
        status === EXIT_ADMISSION_DENIED,
        `A4: expected the refusal code (${EXIT_ADMISSION_DENIED}); got ${status}: ${output}`,
      );
      check(
        !existsSync(refused.marker),
        "A4: the payload RAN despite the refusal: the slot did not exclude the work",
      );

      // ⚠ THE CONTROL, WITHOUT WHICH THIS ARM PROVES NOTHING. A stub that always failed would
      // satisfy every assertion above. NOTE the stub object is kept: `runStub` returns only
      // `{status, output}`, so reading a marker off that would be `undefined` and the assertion
      // would be vacuous. (Measured in the sibling repository as a false green.)
      const control = stubGate(freshPort());
      const allowed = runStub(control, { STUB_WAIT_MS: "1500" });
      check(allowed.status === 0, `A4 control: refused on a free port: ${allowed.output}`);
      check(existsSync(control.marker), "A4 control: acquired but did not run its payload");
    } finally {
      releaseAdmission(holder);
    }
  },
]);

cases.push([
  "A4b a REAL fault is not retried as contention (EACCES returns immediately)",
  async () => {
    // ⚠ THE SIBLING REPOSITORY'S SEEDED DEFECT WENT GREEN WITHOUT AN ARM LIKE THIS. Deleting the
    // `if (attempt.code !== "EADDRINUSE") return …` guard -- so every bind failure is retried to
    // the budget -- left every arm passing there. The property matters because retrying a
    // misconfiguration is not harmless: a caller who waits the budget and is then told "admission
    // denied" learns to read a CONFIGURATION FAULT as another gate holding the port.
    //
    // Port 80 on a non-root process is the cheapest dependable fault here and it is IMMEDIATE.
    const started = Date.now();
    const result = await acquireAdmission({ port: 80, timeoutMs: 3000 });
    const elapsed = Date.now() - started;
    check(result.ok === false, "A4b: binding port 80 as a non-root user should not succeed");
    check(
      result.code !== "ADMISSION_TIMEOUT",
      "A4b: a bind fault was retried until the budget expired and then reported as " +
        "ADMISSION_TIMEOUT -- that makes a misconfiguration read as contention",
    );
    check(elapsed < 1500, `A4b: a real fault took ${elapsed}ms to surface; it must return at once`);
  },
]);

cases.push([
  "A6 reusePort: the source pins false, and true is ENOTSUP on this platform",
  async () => {
    // ⚠ THE EXECUTED HALF CANNOT FAIL HERE, AND THAT IS THE BOUND. `reusePort: true` returns
    // `ENOTSUP` on this platform, so an executed arm shows the PLATFORM refusing the flag rather
    // than showing admission failing. Hence a STATIC assertion plus an executed probe that records
    // the platform fact instead of pretending to test the branch.
    const source = readFileSync(ADMISSION, "utf8");
    check(
      /reusePort:\s*false/.test(source),
      "A6: gate-admission.mjs no longer pins reusePort:false -- with true the kernel would let N " +
        "listeners share the port and every racer would 'acquire'",
    );
    const attempt = await new Promise((res) => {
      const server = net.createServer();
      server.once("error", (e) => res({ code: e.code ?? "UNKNOWN" }));
      server.listen(
        { port: freshPort(), host: ADMISSION_HOST, exclusive: true, reusePort: true },
        () => res({ code: "LISTENED" }),
      );
    });
    check(
      attempt.code === "ENOTSUP",
      `A6: reusePort:true returned ${attempt.code}; if it LISTENS the executed arm becomes ` +
        "meaningful and this static-only bound must be revisited",
    );
  },
]);

cases.push([
  "A7 the WRAPPER takes no argument and refuses one (a fixed seat)",
  () => {
    // The wrapper is the seat a human invokes. Accepting an argument would let a caller run
    // something the admission block does not describe -- and the sibling repository measured the
    // cost of exactly that class of convenience: a wrapper whose no-argument DEFAULT was an
    // expensive population started two accidental full gates in one day.
    const result = spawnSync(process.execPath, [WRAPPER, "echo", "should-not-run"], {
      encoding: "utf8",
      env: { ...process.env },
    });
    check(result.status === 64, `A7: expected EX_USAGE (64), got ${result.status}`);
    // ⚠ THE REFUSAL NAMES THE ARGUMENT, SO "THE OUTPUT DOES NOT CONTAIN IT" IS THE WRONG
    // ASSERTION -- the refusal echoes the argument back as part of explaining what it rejected.
    // (Written the naive way first, this arm reddened against a CORRECT wrapper.) The honest pair
    // is: the argument is NAMED in the refusal, and the exit code is the usage code rather than
    // the compound's. Had the wrapper not refused, it would have run `npm run check:compound`
    // (minutes, and exit 0/1), never 64.
    check(
      /unexpected argument/.test(`${result.stdout}${result.stderr}`),
      "A7: the refusal does not name the unexpected argument",
    );
    check(
      /should-not-run/.test(`${result.stdout}${result.stderr}`),
      "A7: the refusal does not report WHICH argument it rejected",
    );
  },
]);

cases.push([
  "A8 the wrapper BINDS the slot and names the seat in package.json",
  async () => {
    // ⚠ THIS ARM DOES NOT RUN THE WRAPPER, BECAUSE RUNNING IT RUNS THE COMPOUND. The card's testing
    // rule: an arm whose subject is the wrapper's admission must not invoke its payload. So the
    // wrapper's wiring is asserted STATICALLY, and its admission behaviour is measured through the
    // module (A1-A4b above), which is the same primitive the wrapper calls.
    const wrapper = readFileSync(WRAPPER, "utf8");
    check(
      /acquireAdmission\(/.test(wrapper),
      "A8: the wrapper does not acquire admission, so it is not the admitted seat",
    );
    check(
      /releaseAdmission\(admission\.server\)/.test(wrapper),
      "A8: the wrapper never releases, so a finished gate would hold the slot until teardown",
    );
    // ⚠ `spawnSync`, NOT `spawn`: the wrapper's whole contribution is that the caller does not
    // return until the COMPOUND finishes. An async spawn would return while the build or the CLI
    // check were still running, making the admitted lifetime shorter than the work.
    check(
      /spawnSync\(/.test(wrapper) && !/\bspawn\(/.test(wrapper),
      "A8: the wrapper must use spawnSync (blocking); an async spawn would outlive the admission",
    );
    // The compound lives in ONE place, so there is no second copy to drift.
    check(
      /check:compound/.test(wrapper),
      "A8: the wrapper does not invoke the named compound script",
    );

    const pkg = JSON.parse(readFileSync(join(resolve(ROOT, "..", ".."), "package.json"), "utf8"));
    check(
      pkg.scripts.check === "node skills/worktree-sop/scripts/run-admitted-check.mjs",
      `A8: package.json's "check" is ${JSON.stringify(pkg.scripts.check)}, not the admitted seat`,
    );
    check(
      typeof pkg.scripts["check:compound"] === "string" &&
        pkg.scripts["check:compound"].includes("doc-verify/dist/cli.js check"),
      "A8: the compound script does not run the doc-verify CLI check",
    );
    // ⚠ AND NO RECURSION: the compound must not call back into `npm run check`, which would
    // re-enter the wrapper and deadlock against its own slot.
    check(
      !/npm run check\b/.test(pkg.scripts["check:compound"]),
      "A8: the compound re-enters `npm run check`, which would deadlock against the wrapper's own slot",
    );
  },
]);

cases.push([
  "A9 the retired lock machinery is gone (the card's deletion list)",
  () => {
    // The card's deletion list, asserted rather than assumed: while the lock FILE is present it is
    // a second mechanism, and two mechanisms that disagree about the anchor are strictly worse than
    // either alone.
    for (const gone of [
      "scripts/gate-lock.mjs",
      "tests/check-lock.mjs",
      "tests/check-lock-mutations.mjs",
      "references/gate-lock.md",
      // `gate-fixture.mjs` went with the pair: its only consumers were the lock's own cases. A
      // fixture with no consumer is a file that looks like coverage and provides none.
      "tests/gate-fixture.mjs",
    ]) {
      check(!existsSync(join(ROOT, gone)), `A9: ${gone} still exists; the card's list removes it`);
    }
    const skill = readFileSync(join(ROOT, "SKILL.md"), "utf8");
    check(
      !skill.includes("scripts/gate-lock.mjs"),
      "A9: SKILL.md still names the retired lock COMMAND (the seat a reader would type)",
    );
    check(
      skill.includes("run-admitted-check.mjs"),
      "A9: SKILL.md does not name the admitted seat, so the dispatcher points at nothing",
    );

    // ⚠⚠ THE REMAINING ASSERTIONS CHECK THE RETIRED MECHANISM'S *SHAPE*, NOT ITS NAME, AND THAT
    // IS A DELIBERATE CORRECTION. A name denylist over source PASSES AGAINST THE DEFECT IT NAMES
    // and REDDENS AGAINST THE CORRECT FILE, because the surviving mention is a COMMENT explaining
    // the deletion. MEASURED HERE: the name-based version reddened on `check-dispatch.mjs` for the
    // two lines that document WHY the lock pair was deleted -- the documentation is not a surviving
    // hop. The sibling repository recorded the same finding (a name denylist is not a pin on the
    // property); this repository has no comment stripper, so the property is checked instead.
    //
    // The deleted mechanism had exactly two shapes: a PATH-KEYED anchor derived from the
    // environment, and a DELEGATION to a separate lock script. Neither may exist.
    const dispatch = readFileSync(join(ROOT, "tests", "check-dispatch.mjs"), "utf8");
    // ⚠ THE FLAGS ARE MATCHED IN QUOTED-LITERAL FORM, WHICH IS WHAT DISTINGUISHES A DRIVEN
    // ARGUMENT FROM PROSE. The surviving mention is a comment reading ``… `gate-lock.mjs
    // --lock-file` …`` -- UNQUOTED, inside a code span. The deleted mechanism passed them as
    // QUOTED argv elements. MEASURED: the bare-flag regex reddened on that comment; requiring the
    // quotes does not, and still catches the real shape (a runner driving the retired CLI).
    check(
      !/["']--lock-file["']|["']--stale-ms["']/.test(dispatch),
      "A9: tests/check-dispatch.mjs still passes the retired lock's CLI flags as argv -- that is the" +
        " deleted mechanism being driven, not described",
    );

    // ⚠⚠ AND THE ANCHOR PROPERTY IS NOT RE-ASSERTED HERE, BECAUSE A LEXICAL CHECK CANNOT DO IT
    // HONESTLY. `gate-admission.mjs`'s own header EXPLAINS the incumbent's defect and therefore
    // writes the words `tmpdir()` and the lock filename; a name-match over that file reddens on its
    // documentation. This repository has no comment stripper, so there is no version of this
    // assertion that distinguishes the prose from a real call -- and a check that reddens on
    // correct input is worse than no check.
    //
    // The property is pinned BY EXECUTION instead, in A5: `resolveAdmissionPort` is called with
    // DIFFERENT `TMPDIR`/`HOME` values and must return the same constant every time. Execution is
    // stronger evidence than reading source, and it fails exactly when the defect returns.
  },
]);

cases.push([
  "the cheapest mechanism check: N in-process acquirers -> exactly one (no processes)",
  async () => {
    // A direct, millisecond falsifier with NO child processes. When A2 fails, this tells you
    // whether the MECHANISM or the process plumbing broke.
    const port = freshPort();
    const attempts = await Promise.all(Array.from({ length: 5 }, () => tryAcquireOnce({ port })));
    const winners = attempts.filter((a) => a.ok);
    check(winners.length === 1, `cheap: expected exactly one in-process winner, got ${winners.length}`);
    for (const a of attempts) if (a.ok) releaseAdmission(a.server);
  },
]);

// ── runner ───────────────────────────────────────────────────────────────────────────────────────

/** Remove every registered root. Called at the end of the run AND from an `exit` handler. */
function teardown() {
  for (const dir of created) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* a leftover temp dir is not a case failure */
    }
  }
}

// ⚠⚠ THE `exit` HANDLER IS NOT DECORATION, AND IT WAS ADDED AFTER MEASURING A REAL LEAK.
// The teardown used to run only at the END of the script body, so any abnormal exit skipped it.
// MEASURED: a run whose stdout was piped to `head -4` died on EPIPE before reaching the teardown and
// left **11 stub roots** behind, while the SAME run with its output captured to a file left **0**.
// That is the sibling repository's `check-response-schemas.mjs` defect reproduced in a new place:
// there, a `process.exit()` inside a `try` made `finally` unreachable and every run leaked a root.
// A reader will reach for `| head` on a long output, so this is not a hypothetical path.
process.on("exit", teardown);

// ⚠ AND A CLOSED STDOUT PIPE MUST NOT ABORT THE RUNNER. `node … | head` is ordinary; the default
// EPIPE behaviour is an uncaught exception, which terminates before any cleanup.
process.stdout.on("error", (error) => {
  if (error && error.code === "EPIPE") process.exit(0);
});

let passed = 0;
for (const [name, run] of cases) {
  // ⚠ COUNT A CASE AS PASSED ONLY IF IT ADDED NO FAILURE. `fail()` does not stop a case, so a case
  // that records a failure still completes normally -- and the first version of this runner counted
  // it as BOTH passed and failed, printing "8 failure(s), 12/12 passed". A summary that cannot
  // distinguish those is worse than no summary.
  const before = failures.length;
  let threw = false;
  try {
    await run();
  } catch (error) {
    threw = true;
    fail(`${name}: threw ${error && error.stack ? error.stack.split("\n")[0] : error}`);
  }
  if (failures.length === before && !threw) {
    passed += 1;
    if (!process.env.QUIET) console.log(`  ok   ${name}`);
  } else if (!process.env.QUIET) {
    console.log(`  FAIL ${name}`);
  }
}

for (const dir of created) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* a leftover temp dir is not a case failure */
  }
}

teardown();

if (failures.length > 0) {
  console.error("");
  for (const f of failures) console.error(`  FAIL ${f}`);
  console.error(`admission: ${failures.length} failure(s), ${passed}/${cases.length} passed`);
  process.exit(1);
}
console.log(`admission: ok (${passed} cases)`);
