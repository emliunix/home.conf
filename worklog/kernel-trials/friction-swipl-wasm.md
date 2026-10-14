# Friction: the swipl-wasm kernel probe

## Status

draft

Opened 2026-10-12: every inconvenience met while experimenting with a mature logic engine as
doc-verify's kernel is tracked in one record per engine (round 1: feasibility of SWI-Prolog's
well-founded semantics under `swipl-wasm`). This record owns the issues, not the kernel decision.

Moved here 2026-10-15 from visflow `design/20-swipl-wasm-kernel-friction` (commit eb36c07), where it had
been filed by a misreading of the owner's direction: the subject is home.conf's kernel trials, so the
record lives beside them. F-numbers are unchanged, so earlier citations ("F12", "F15") still resolve.

## Goal

Keep every defect, gap and undocumented behaviour met in `swipl-wasm` (and in SWI-Prolog's
tabling as the build exposes it) in one place, each with the workaround the probe used and what
would close it, so that the kernel decision (home.conf kernel-trials round 2) can weigh them and so
that the ones worth reporting upstream are reported once.

## Problem statement

The round-1 probe passed all four feasibility conditions, but only after fourteen detours. None is
recorded anywhere a later author would look: they sat only in round 1's results file. A second author porting the engine would hit each again. Two of them are
candidates for upstream defects and must not be lost.

## Scope

In scope: issues in `swipl-wasm@8.2.2` (embedding SWI-Prolog 10.1.15) as a Node host, and
behaviours of SWI tabling and the well-founded semantics that the kernel design depends on. Out of
scope: the kernel decision, the module language, the judge integration.

## Design

Each issue has an id, a severity for the kernel design (blocks / workaround / cosmetic), the
workaround used, and what closes it.

### Package and loading (host)

- **F1 — undocumented Node entry.** the package `main` is dist/index.js (the single-file bundle); the Node
  wrapper that locates `swipl-web.data` is dist/swipl-node.js, named nowhere in the README.
  Workaround: require it by path. Closes: a README line, or an `exports` map. *workaround*
- **F2 — CommonJS only.** No `exports` field; an ESM caller needs `createRequire`. *workaround*
- **F3 — version skew.** npm `8.2.2` embeds SWI-Prolog `10.1.15`; the README does not say which
  SWI it ships. Record `current_prolog_flag(version, V)` in every result. *cosmetic*
- **F4 — no documented "load source text" API.** `load_string` exists on the Prolog object but is
  untyped. Workaround: `swipl.FS.writeFile` then `consult/1`. *workaround*
- **F5 — answer shape.** `query(...).once()` returns `{success:false}` for failure and JS objects
  for compound terms. Workaround: format every result with `~q` into an atom. *workaround*
- **F6 — libraries ship as `.qlf` only** (e.g. `library(wfs)`), so `call_delays/2` cannot be read
  in the build. *cosmetic*
- **F7 — consult warnings go to the Node console**, not to the caller. *cosmetic*

### Tabling and the well-founded semantics (engine)

- **F8 — `call_delays/2` is not the demand set.** It returns the tabled goal itself, or `tnot(G)`,
  never the undefined leaves. Workaround: walk `delays_residual_program/2` transitively to the
  `u/1` leaves. Closes: nothing upstream; the kernel owns the walk. *workaround, design-relevant*
- **F9 — delay ordering is undocumented.** Delayed literals are listed most-recent-first. The
  prefix demand rule relies on taking the first literal in source order, which is the last list
  element. Observed, not documented; a build could change it silently. Closes: a test that pins
  the order, and a question upstream. *workaround, design-relevant*
- **F10 — an unconditional answer can coexist with a conditional one** (`[true, u(o3(a))]`); the
  demand walk must stop when an unconditional answer exists. *workaround*
- **F11 — residual program shape differs by history.** `call_residual_program/2` returns `[]` for
  a plain unconditional answer but `[(G :- true)]` for one made unconditional by incremental
  re-evaluation. *workaround*
- **F12 — stale `call_delays/2` after incremental re-evaluation with a tabled wrapper.** With the
  oracle wrapper tabled `as incremental`, `call_delays/2` keeps reporting the old conditional
  answer after `assertz`, while `tnot` and the residual program are correct; the outcome depended
  on query order in one instance. Workaround: keep the wrapper untabled. Closes: a minimal
  reproduction and an upstream report if it reproduces natively. *possible engine defect*
- **F13 — `tnot/1` accepts a non-ground goal silently** and reads as existential negation; there is
  no floundering error. The groundness check is the kernel's. *design-relevant*
- **F14 — `current_table/2` with a partially bound pattern returns nothing**; `current_table(V, T),
  V = u(A)` works. *workaround*

### Added in kernel-trials round 2 (2026-10-12)

- **F9 pinned.** The conformance runner prints the delay order on every run and confirms
  most-recent-first; a change in a later build fails the run. *closed as a risk, open upstream*
- **F15 — incremental tabling leaves stale `call_delays/2` answers (F12 generalised).** After
  `assertz` on an incremental dynamic, `call_delays/2` reports a stale conditional answer on a
  two-level tabled chain with no tabled wrapper, while `call_residual_program/2` is correct; a
  tabled `findall` over an incremental table is never invalidated. Six witnesses fail under
  `--incremental`. Workaround: abolish all tables at every step (about 1 ms on the corpus), so the
  kernel does not rely on incremental tabling at all. Closes: a minimal native reproduction and an
  upstream report. *possible engine defect, design-relevant*
- **F16 — a residual program merges several derivations into one clause with a `;` body.**
  Undocumented; the demand walk splits on it. *workaround*
- **F17 — doc-verify's own `compileModule` cannot serve as a syntax-only parser.** Its checker
  refuses unstratified programs, oracles deeper than `rounds`, and statically unsafe negation or
  `matches`, so a kernel that allows those must use `loadModule` plus its own resolver. A
  doc-verify issue, not an engine one. *workaround*
- **F18 — `aggregate_all/3` and `findall/3` count conditional answers as true.** A three-valued
  count needs the two-query encoding. *design-relevant*
- **F19 — probe hygiene:** the brute-force generator exported nothing and was extracted from
  source text. *cosmetic, probe-only*
- **F20 — witness format:** an unquoted `evidence: core.own(D, S)` inside a YAML flow mapping
  splits at the comma. Fixed in the format. *cosmetic, probe-only*

## Rationale

A standing record beside the rounds, not a results section, because the items are open and some change
the kernel design (F8, F9, F12, F13): the demand policy, the groundness check and the wrapper shape are
decisions this list forces, and they must be visible when the kernel is selected.

## Verification

Each `workaround` item is closed when the probe runner (`worklog/kernel-trials/probe/
run-probes.mjs`) no longer needs its workaround and still exits 0. F9 is closed by a test that pins
the delay order and fails if a build changes it. F12 is closed by a minimal reproduction that either
fails natively (then reported upstream) or passes natively (then recorded as WASM-only).

## Open questions

- Does F12 reproduce under native SWI-Prolog 10.1.15? Not run: native swipl is not installed.
- Is the delay order (F9) stable across SWI releases, or should the kernel sort delays by its own
  source order instead of trusting the list?

## Review

None yet.

## Decision

None yet. The list is open; the kernel decision is home.conf kernel-trials round 2.
