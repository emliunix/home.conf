// Heavy-gate ADMISSION via a fixed non-ephemeral loopback slot (task #329).
//
// WHAT THIS IS. The home.conf half of the admission change whose sibling is
// `agent-substrate`'s `scripts/gate-admission.mjs` (task #328). This repository's heavy gate is
// invoked BY HAND (`npm run check`), so the seat is a wrapper around the compound command rather
// than a bind inside a runner. See `run-admitted-check.mjs`.
//
// WHAT IT REPLACES. The gate was serialized by `scripts/gate-lock.mjs`, a PATH-KEYED lock file
// whose default path was `tmpdir()/home-conf-heavy-gate.lock`. `os.tmpdir()` honours `TMPDIR`, so
// two invocations with different temp roots computed DIFFERENT paths, each acquired "the" lock, and
// BOTH ran the population the lock exists to serialize. It also carried a liveness-blind staleness
// arm (`!pidIsAlive(pid) || age >= staleMs`) that could displace an ALIVE holder, plus the holder
// classification, tombstones, and quarantine machinery that existed to cope with a file.
//
// THE MECHANISM. One fixed loopback listener on `127.0.0.1`, `reusePort: false`, budget 1. The
// kernel bind IS the atomic test-and-set: no file, no path, no pid classification, no reclamation
// heuristic. A second binder gets `EADDRINUSE`, and the kernel frees the slot when the holder dies
// -- including on SIGKILL.
//
// ---------------------------------------------------------------------------------------
// ⚠⚠ THE PORT IS A SHARED VALUE ACROSS TWO REPOSITORIES, AND THERE IS NO SHARED SOURCE OF TRUTH
// ---------------------------------------------------------------------------------------
// For a home.conf gate and a sandbox-deploy gate to EXCLUDE EACH OTHER they must bind the SAME
// port. This file's constant and `agent-substrate`'s `scripts/gate-admission.mjs` are therefore a
// **duplicated pair**, and each repository pins its own copy in its own case file.
//
// ⚠ THE FAILURE MODE IS SILENT AND THAT IS WHY IT IS WRITTEN DOWN. If either copy drifts, each
// repository still works perfectly *within itself* -- its own gates still serialize, its own tests
// still pass -- and only the CROSS-REPOSITORY exclusion disappears. Nothing reports it. Measured
// for this change: two binders with different ports do not contend (the second acquires
// immediately), which is exactly the pre-change state that the "one heavy gate per host" rule
// exists to compensate for.
//
// ⇒ If you change this constant, change `agent-substrate`'s in the same breath. The pairing is
// asserted here only as an equality with the literal below; a test in this repository cannot
// observe the other repository, and pretending otherwise would be a check that cannot fail.
//
// ⚠ THE PORT LIVES BELOW THE macOS EPHEMERAL RANGE (`net.inet.ip.portrange.first = 49152`), because
// a port the kernel may hand to an unrelated outbound connection would make admission fail for a
// reason that has nothing to do with another gate. `5000`/`7000` are avoided: macOS AirPlay
// Receiver binds them.

import net from "node:net";

/** The admission port. A CONSTANT -- never derived from `TMPDIR`, `HOME`, or any path.
 *
 *  ⚠⚠ SHARED WITH `agent-substrate`'s `scripts/gate-admission.mjs`. See the header: the pairing has
 *  no shared source of truth, and a drift is silent. */
export const ADMISSION_PORT = 47123;

/** The admission host. Loopback only: this serializes one machine, which is what a gate needs. */
export const ADMISSION_HOST = "127.0.0.1";

/** The bounded wait, in ms. PARITY WITH THE INCUMBENT: `gate-lock.mjs` waited 20 minutes then
 *  returned 75. A silent instant-fail would be a behaviour change where the incumbent waited, so
 *  the wait is kept and named rather than dropped (the card asks for exactly this). */
export const ADMISSION_TIMEOUT_MS = 20 * 60 * 1000;

/** Exit code for "the gate never got to run because admission was held". Chosen to match the
 *  incumbent so a caller cannot tell the two mechanisms apart, and chosen because it collides with
 *  neither the gate's own 0/1 nor the shell's usual codes. */
export const EXIT_ADMISSION_DENIED = 75;

/** Poll interval while waiting. Short enough that a holder's exit releases promptly. */
const RETRY_MS = 250;

/**
 * Try ONCE to acquire the slot. Never waits, never throws for the expected contention case.
 * @returns {Promise<{ok: true, server: import("node:net").Server} | {ok: false, code: string}>}
 */
export function tryAcquireOnce({ port = ADMISSION_PORT, host = ADMISSION_HOST } = {}) {
  return new Promise((resolve) => {
    const server = net.createServer();
    // ⚠ `reusePort: false` IS THE MECHANISM, NOT A DEFAULT BEING RESTATED. With `reusePort: true`
    // the kernel would let N listeners share the port and every racer would "acquire" -- so the
    // atomic test-and-set would silently stop excluding anything.
    server.listen({ port, host, exclusive: true, reusePort: false });
    const settle = (result) => {
      server.removeListener("listening", onListening);
      server.removeListener("error", onError);
      resolve(result);
    };
    const onListening = () => settle({ ok: true, server });
    const onError = (error) => {
      server.close();
      settle({ ok: false, code: error.code ?? "UNKNOWN" });
    };
    server.once("listening", onListening);
    server.once("error", onError);
  });
}

/**
 * Acquire the slot, waiting up to `timeoutMs` for a holder to exit.
 *
 * The wait exists for PARITY: a gate that must serialize should queue, not refuse, when the wait is
 * bounded and the holder is expected to finish. `EADDRINUSE` is the contention signal; any other
 * bind failure is a REAL fault and is returned immediately rather than retried, because retrying a
 * misconfiguration for 20 minutes would misreport it as contention.
 *
 * @returns {Promise<{ok: true, server: import("node:net").Server} | {ok: false, code: string, waitedMs: number}>}
 */
export async function acquireAdmission({
  port = ADMISSION_PORT,
  host = ADMISSION_HOST,
  timeoutMs = ADMISSION_TIMEOUT_MS,
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const startedAt = now();
  for (;;) {
    const attempt = await tryAcquireOnce({ port, host });
    if (attempt.ok) return attempt;
    if (attempt.code !== "EADDRINUSE") return { ...attempt, waitedMs: now() - startedAt };
    if (now() - startedAt >= timeoutMs) return { ...attempt, code: "ADMISSION_TIMEOUT", waitedMs: now() - startedAt };
    await sleep(RETRY_MS);
  }
}

/**
 * Release the slot. Called on every exit path, so a gate that finishes frees admission immediately
 * rather than waiting for process teardown.
 */
export function releaseAdmission(server) {
  if (!server) return;
  try {
    server.close();
  } catch {
    // A close that throws is not a reason to fail a gate that already ran.
  }
}

/**
 * The ONE test-only override. Wrapper/self-test arms need two processes to contend deliberately,
 * and a test that cannot vary the port cannot observe admission at all.
 *
 * ⚠ THE BYPASS BOUND, STATED SO THE DEFAULT IS NOT PRESENTED AS UNOVERRIDEABLE: setting this
 * environment variable makes admission bind somewhere else, which means two processes that
 * DISAGREE about it do not serialize. That is intended for a test that sets it for BOTH processes;
 * it is not a supported way to run a gate, and anything other than a test overriding it is outside
 * this seam.
 */
export const ADMISSION_PORT_ENV = "GATE_ADMISSION_PORT";

/** Resolve the port: the CONSTANT by default, or the explicit test override. */
export function resolveAdmissionPort(env = process.env) {
  const override = env[ADMISSION_PORT_ENV];
  if (override === undefined || override === "") return ADMISSION_PORT;
  const n = Number(override);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`${ADMISSION_PORT_ENV}=${JSON.stringify(override)} is not a TCP port`);
  }
  return n;
}
