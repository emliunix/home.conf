# Round 6 verdict — request shape: batched against per-atom (2026-10-13)

## Predicate

```sh
node worklog/kernel-trials/probe/compare-shapes.mjs --self-test                                                                         # pass (planted flip, discordant, trend found; clean pair clean)
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_reasons          --request-shape both --repeat 2 --reversed --reversed-only good,defective-pointers,defective-restatement,mixed-one-pointer --invariant-base c632a91 --positions --ledger round6-B --cap 450   # complete: true, 312 questions
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable_in_row --request-shape both --repeat 2 --reversed --positions --ledger round6-C2 --cap 756       # complete: true, 504
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels labels.yaml         --request-shape both --repeat 2 --ledger round6-real-goal   --cap 144                           # complete: true, 96
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels witness-labels.yaml --request-shape both --repeat 2 --ledger round6-real-design --cap 180                           # complete: true, 120
node worklog/kernel-trials/probe/compare-shapes.mjs round6-B round6-C2 round6-real                                                      # complete (all prefixes): true
```

Outputs: `results/round-6-{B,C2,real-goal,real-design}-live.txt`, `results/round-6-compare.txt`.
Arms interleaved ABBA per fixture, cache off, span follow-ups off, judge `jev-1.13.0`, 1032
questions in all. No batched run split; no per-atom run was non-atomic.

## What measured

**Evidence cells (goals/04 fixtures, 47 units, every batch mixed-oracle).** 0 confident flips;
correctness identical (36 both right, 0 discordant); per-atom resolves the terse row2 seeded cell
at ≥ 0.6 where batched sits below the margin. Signed shift of P(expected side), per-atom minus
batched: −0.020 over all cells (interval [−0.040, 0.000]; the ceiling cells lose a little
confidence under per-atom), +0.097 on the 3 near-threshold cells (interval [−0.027, 0.220]).
Noise floors 0.001 and −0.002. No repeat flips either shape. No position trend under the
reversed arm (β = 0.001).

**Witness cells (design/04 fixtures, 57 units, single-oracle batches).** 2 confident flips,
both reproduced on every repeat pair: controls row13 ("A known-bad document passes", a short
genuine witness: batched `holds` 0.93, per-atom `fails` 0.75, **per-atom wrong**) and swapped
row4 (a genuine witness on the wrong row: batched `holds` 0.97, per-atom `fails` 0.62/0.59,
**per-atom right**, at the margin). Discordant cells 3: per-atom right on gross row13 (the cell
batched left at 0.51 in round 4c; per-atom `fails` 0.94) and swapped row4, batched right on
controls row13; exact McNemar p = 1. One reverse seeded miss: per-atom misses subtle3 row12
that batched catches. **Near-threshold stratum (5 cells): +0.220, interval [0.110, 0.336],**
clear of ±0.05 and of the noise floor (−0.002): per-atom moves the hard cells toward the expected
side. Over all cells +0.015 (interval [−0.023, 0.056]). Per-atom had one `tie-or-malformed` leaf
and one repeat flip (subtle row3); batched none. Position: β = −0.039 with interval [−0.069,
−0.013] under the reversed arm, below the pre-registered |β| ≥ 0.05, so no trend by the rule,
though later positions read slightly lower.

**Real cells (54, no expected labels; the lead's blind labels informational).** Goals (mixed
batches): 0 flips, shift +0.029, shapes agree on 19/19 labelled cells. Designs (single-oracle
batches): 3 confident flips, all `holds` under batched and `fails` under per-atom, reproduced:
design/02 "Live judge answers are recorded", design/05 "Model conformance" and "Open
vocabulary"; shift of P(holds) −0.107, interval [−0.158, −0.059]. Per-atom is **stricter** on
real witness cells; agreement with the lead's labels is 26/30 under both shapes, with different
cells disagreeing.

**Cost.** Per-atom: 14× the requests on a 14-row design, 2.2× the wall time (102 s against
47 s on the witness track), 11× the judge time; state bytes 1.35× (the shared evidence is sent
once per batch but the instruction overhead is per request).

## Expectations the run contradicted

- **Confident flips reproduce.** Predicted 1–3 under noise and none reproducing; 2 (fixtures) +
  3 (real designs) reproduce on every repeat pair. These are not noise; they are the two shapes
  reading borderline cells differently, with per-atom on the `fails` side each time but one.
- **The stratum shift is large**, +0.22 on the witness fixtures against a predicted ±0.03 band.
- **Per-atom is stricter on genuine cells**: predicted none; one control and three real cells.
- **Noise floors are smaller than predicted** (≤ 0.006 against ≈ 0.02): the judge is near
  deterministic on repeat under both shapes, so every reproduced flip is a shape effect.
- Position slope on design/04 is non-zero but under the pre-registered threshold.

## Which shape it selects, and why that is not a clean win

The pre-registered rule: per-atom becomes the default if the McNemar rule fires (it does not:
k = 2, m = 1), **or the stratum shift favours per-atom beyond the floor and ±0.05 (it does)**, or a
position effect is identified (not by the rule). The trigger fired, so **per-atom is the
default.** What the verdict adds: the trigger rests on 5 near-threshold cells; per-atom's gain
is decisiveness on hard cells, not plain accuracy (it is right on two of three discordant
fixture cells and wrong on one, and it fails three real cells the lead reads as witnesses).
Under the owner's priority, decisiveness on the cells that decide a document is worth the cost,
and a stricter reading of real witness cells is the direction the goal-evidence and witness
rounds already took. The mirror branch (batched stays) is one line away in `module.ts`, and the
batched measurement band is recorded for the day that line is wanted back.

## Changes this verdict makes

1. `doc-verify/src/engine/module.ts`: the library default is `per-atom`; `batched` is the opt-in
   for cost. `doc-verify/lib/goal.yaml` and `doc-verify/modules/design.yaml` declare `per-atom`
   explicitly.
2. `doc-verify/src/engine/oracles.ts`: the cache key carries the request shape, so a batched
   answer never serves a per-atom request or the reverse.
3. The real cells that flip to `fails` under per-atom are rewritten as concrete observables:
   the three the comparison found (design/02 "Live judge answers are recorded", design/05 "Model
   conformance" and "Open vocabulary") and two more the live promotion check found under the new
   default (design/02 "The actual repository contract passes", goals/01 R5). Designs 02–05 and
   goals 01–04 pass at promotion under per-atom, cache off.
   A gap closed on the way: the per-atom partition skipped the single-atom budget check, so an
   over-budget atom was reported by the outbound policy's message instead of the named
   "effective budget" one; both shapes now share the check.
4. design/04's verification row "Requests shaped as declared" is amended: the default is the
   declared one, `per-atom` since this round. Design 05 §Oracle toolkit records the measurement.
5. Gate ledger: a round 6 row with the comparer's self-test as its seeded defect; the request-shape
   tests updated to the new default.

## Left unmeasured

The module-page oracles (`doc-verify:module-*`, calibrated batched in round 3): under per-atom
the hook's full-corpus run demoted one atom (`module-model-is-current` on
`docs/modules/oracles/model.md`, `unknown` at 0.49 against threshold 0.5) that batched passes,
so those four libraries pin `request_shape: batched` until their own shape round; the default
and the measured modules are per-atom. Batch sizes above 14 (measured at ≤ 14); judge variation; the follow-ups' own shape; the
known-unknown label under either shape; whether the ceiling cells' small confidence loss under
per-atom (−0.02) matters anywhere a threshold sits above 0.5.

## Files

`round-6-preregistration.md` (amended; thirteen review items taken), `results/round-6-review.md`,
`results/round-6-*-live.txt`, `results/round-6-compare.txt`, `probe/compare-shapes.mjs`,
`probe/oracle-test.mjs` (`--request-shape`, `--no-spans`, `--reversed`, `--positions`,
`--invariant-base`, sidecars), `probe/oracle-fixtures/.reversed/`.
