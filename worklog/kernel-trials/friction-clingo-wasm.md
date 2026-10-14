# Friction: the clingo-wasm kernel probe

## Status

draft

Opened 2026-10-13: every inconvenience met while experimenting with a mature logic engine as
doc-verify's kernel is tracked in one record per engine (round 4b: clingo with free `#external` atoms
as a third conformance subject beside the SWI well-founded-semantics kernel, whose record is
`friction-swipl-wasm.md`). This record
owns the issues, not the kernel decision, which that round made (the SWI kernel stays; clingo is
kept as a differential reference).

Moved here 2026-10-15 from visflow `design/21-clingo-wasm-kernel-friction` (commit fa43b85), where it had
been filed by a misreading of the owner's direction: the subject is home.conf's kernel trials, so the
record lives beside them. F-numbers are unchanged, so earlier citations still resolve.

## Goal

Keep every defect, gap and undocumented behaviour met in `clingo-wasm` as a Node host in one
place, each with the workaround the probe used and what would close it, so that a later author
porting an answer-set engine does not meet them again and so that the ones worth reporting
upstream are reported once.

## Problem statement

The round-4b subject passed its witness, corpus and random tracks, but only after nine detours in
the host package, none of which is recorded anywhere a later author would look. One of them
(no multi-shot API) sets the cost of every demand probe; another (forced JSON output) closes off
derivations, which is the one thing the kernel decision turned on.

## Scope

In scope: issues in `clingo-wasm@0.6.0` (clingo 5.8.1, Emscripten) as a Node host, and clingo
behaviours the subject depends on. Out of scope: the kernel decision, the module language, the
judge integration, the SWI kernel (`friction-swipl-wasm.md`).

## Design

Each issue has an id, a severity for the kernel design (blocks / workaround / cosmetic), the
workaround used, and what closes it.

### Package and loading (host)

- **G1 — async-only worker entry; the process does not exit.** The Node entry runs clingo in a
  `worker_thread` and exposes only an async `run`; a script that uses it does not exit on its own.
  Workaround: the undocumented in-thread runner `dist/run.js` with `init({ singleThreaded: true })`,
  which is synchronous. Closes: a documented synchronous entry, or `exports` for `run.js`.
  *workaround*
- **G2 — options are joined into one command line without escaping.** `run(program, models,
  options)` joins `options` with spaces and wraps `--outf=2 … <models>` around it; an option with a
  space or a quote cannot be passed. *cosmetic*
- **G3 — `--outf=2` is forced, so non-JSON output is unreachable.** `--version` returns "not valid
  JSON"; `--text` and reification output cannot be obtained, which is why no derivation or proof
  tree can be read from this package. Closes: a raw-output mode. *blocks derivations,
  design-relevant*
- **G4 — Node 22 or later is required.** Not stated beside the install line. *cosmetic*

### Solving and results (engine as the build exposes it)

- **G5 — no multi-shot API.** No `assign_external`, `release_external` or ground-program reuse:
  every demand probe re-grounds and re-solves the whole program. Measured: 6602 solves over 500
  random programs, 4.7 s; 2 to 12 solves per step on the witnesses. Closes: a multi-shot
  binding. *workaround, design-relevant*
- **G6 — cautious and brave consequences arrive as the last entry of `Call[0].Witnesses`**, with
  every intermediate approximation listed before it; an UNSAT program gives no witnesses at all.
  Workaround: take the last witness; treat an empty list as UNSAT explicitly. *workaround*
- **G7 — output atoms are plain strings with no symbol API.** A nested-term parser had to be
  written, and clingo's quoting (uppercase is a variable) forced an own encoding table for
  constants, functors and predicates. *workaround*
- **G8 — `Warnings` is `[""]` when there are none**, built by splitting stderr on blank lines.
  *cosmetic*
- **G9 — errors come back as `Result: "ERROR"` with free text**; unsafe variables and syntax
  errors are told apart only by reading the text, and detection depends on clasp exit statuses.
  *workaround*

## Rationale

A record per engine, as `friction-swipl-wasm.md` is for swipl-wasm, so the kernel-trials verdicts can cite the
cost of each host without carrying it. The two design-relevant items (G3, G5) are what the
round 4b verdict weighed against adopting clingo: without derivations the constitution's
invariant 4 cannot be met natively, and without multi-shot solving the demand computation costs
2E + 2 full solves per step.

## Verification

Each `workaround` item is closed when the S3 subject in home.conf
(`worklog/kernel-trials/probe/kernel3/subject-clingo.mjs`) no longer needs its workaround and
`node worklog/kernel-trials/probe/run-conformance.mjs --s3 --random 500` still reports 500/500
equal to enumeration. G3 is closed when a derivation (reified or textual) can be read from the
package for one witness program. G5 is closed when the random track's solve count drops below
one per external per step.

## Open questions

- Does native clingo's `--text` or reification give a derivation usable as the model's missing
  literal? Not run: native clingo is not installed.
- Is the last-witness convention (G6) stable across clingo-wasm releases?

## Review

Opened by the home.conf kernel-trials lead from the round 4b implementation report; not yet
reviewed.

## Decision

None taken here. The kernel decision is home.conf kernel-trials round 4b (the SWI kernel stays;
clingo is a differential reference).
