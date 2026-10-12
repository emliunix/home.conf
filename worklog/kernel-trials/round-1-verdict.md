# Round 1 verdict — SWI-Prolog WFS as the kernel, host swipl-wasm (2026-10-12)

## Predicate

```sh
node worklog/kernel-trials/probe/run-probes.mjs     # exit 0; prints K1..K4 complete: true
```

Run by the probe author three times and by the lead once more; all four runs agree. Wall time
0.37–0.57 s for the whole process.

## What measured

| Condition | Result | Observed |
| --- | --- | --- |
| K1 undefined + delays | pass, under the amended wording | `ok(a)`, `violated(c1)` undefined; prefix demand `[o1(a)]` excludes `o2(a)`; disjunct-already-true demands nothing; holds / fails / unknown and a three-label choose behave as expected in positive and negated position |
| K2 incremental tabling | pass, with the oracle wrapper untabled | undefined→true and undefined→false after `assertz`, no `abolish_all_tables`; the no-`incremental` control stays stale |
| K3 proof tree + missing literal | pass | `node(Goal, Children)` with `fact/1` and `oracle/2` leaves; `missing(goal_section(d2,_))`, `missing(heading(d2,intro,'Goal'))`, `missing(purpose(d3,goal,goal))` |
| K4 corpus scale | pass | 24 documents, 1509 facts, 14 constraints: evaluate 2–5 ms, consult 16 ms, startup 28 ms warm / 65–82 ms cold, total 46–105 ms; re-evaluation round ~1 ms |

Engine: the npm package `swipl-wasm@8.2.2` embeds SWI-Prolog **10.1.15**.

K4 comparison with the current checker (`check --all --profile draft`, structural constraints,
the four design documents): populations and statuses agree; `paths-resolve` has population 32,
violated in design/02 only (3 bindings). Promotion constraints come back undefined (4 and 3
bindings), as they should with no judge answers.

## Which candidate it selects

C1 (swipl-wasm) is **feasible**. C2 (native) did not run and was not needed. Per the amended
plan, round 1 is feasibility only and **does not select the kernel**; round 2 (verdict
equivalence) decides that.

## Expectations the run contradicted

- **Startup.** Predicted 300–900 ms; measured 28 ms warm, 65–82 ms cold. The prediction was
  wrong by an order of magnitude in the favourable direction. Corrected in place here.
- **"The delay list is the demand set."** False, as the reviewer predicted. `call_delays/2`
  returns the goal itself for a tabled goal and `tnot(G)` for a negated one. The demand set needs
  a transitive walk of the residual program (`delays_residual_program/2`) to the `u/1` leaves.
  The engine gives the *full* leaf set; the left-to-right prefix rule the current evaluator
  applies is **not** in WFS and is implemented by our walk, which takes the first delayed literal
  in source order. That relies on SWI listing delays most-recent-first, which was observed, not
  documented. This is the round's main finding: the demand policy stays ours.
- **"No rule transformation."** Already corrected before the run; the encoding used is
  `:- table u/1. u(A) :- tnot(u(A)).` with an untabled wrapper
  `oracle(A) :- answered(A, holds). oracle(A) :- \+ answered(A, holds), \+ answered(A, fails), u(A).`
- **K2 with a tabled wrapper.** With the oracle wrapper itself tabled `as incremental`,
  `call_delays/2` keeps reporting a stale conditional answer after `assertz`, while `tnot` and the
  residual program are correct, and the outcome depended on query order within one instance.
  Possible engine defect; avoided by keeping the wrapper untabled. Recorded, not diagnosed.

## New facts the plan did not anticipate

- A goal that already has an unconditional answer can still carry a conditional one
  (`[true, u(o3(a))]`), so the demand walk must stop when an unconditional answer exists.
- `tnot/1` on a non-ground goal raises no error and acts as existential negation. The groundness
  check (invariant 5) is ours.
- The choose encoding, one undefined atom per label, does not state that labels are mutually
  exclusive. Harmless while labels are only read, a gap if a rule ever reasons about "some label".
- `library(sandbox)` ships in the build (as `.qlf`); not exercised.

## Left unmeasured (carried to round 2)

1. Verdict equivalence with `evaluate.ts` over the 24 documents and seeded cases: count intervals,
   `present`, `matches` on unbound or interval operands, `forbid`, prefix-settled demand across
   rounds.
2. Constructs with no WFS counterpart: `count` as a `[certain, possible]` interval (`aggregate_all`
   ignores delays), `matches`, `present`.
3. Trust boundary: `library(sandbox)` under WASM, bundle size, the groundness check.
4. The tabled-wrapper staleness above, reproduced minimally and reported upstream if real.

## Files

`preregistration.md` (plan, review, amendments), `probe/` (programs and runner),
`results/round-1-swipl-wasm.md` (per-condition values, three runs, friction list, full output),
`decisions.md`.
