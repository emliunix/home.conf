# Round 9 verdict — witness relevance to its property (2026-10-13)

## Predicate

```sh
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_relevant            --request-shape per-atom --repeat 2 --no-spans --ledger round9-R1  --cap 336   # complete: true, 224 of 336
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_relevant_in_table   --request-shape per-atom --repeat 2 --no-spans --ledger round9-R2  --cap 336   # complete: true, 224 of 336
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_relevant_paraphrase --request-shape per-atom            --no-spans --ledger round9-R1p --cap 42    # complete: true, 28 of 42
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels relevance-labels.yaml   --request-shape per-atom --repeat 2 --no-spans --ledger round9-real          --cap 90   # complete: true, 60 of 90, 30/30 labels found
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels relevance-deranged.yaml --request-shape per-atom --repeat 2 --no-spans --ledger round9-real-deranged --cap 57   # complete: true, 38 of 57, 19/19 labels found
```

Run by the lead 11:02–11:09, live judge, per-atom, cache off, two repeats (one for the
paraphrase arm), 574 questions, no cap tripped. Counted rows are read from the sidecars' per-leaf
expectations (`holds`/`fails`; `ambiguous` and `neutral` rows reported apart), as the build
review asked, not from the runner's k/n column. p is the minimum of the two repeats' peaks; a row
counts as caught only when both repeats agree on `fails` at p ≥ 0.6; a disagreement is a flip.
The build (an Opus subagent) was reviewed by the `reviewer` seat with no blocking findings; the
lead applied the engine wiring for `core.row_with_column` (15 lines in the checker and the
oracle resolver, with the renderer and three tests from the builder), relabelled round 4c's
swapped fixture for its real direction (row i carries row i−1's witness; four ambiguous rows,
bar 8 of 10, unchanged) and pinned its permutation base to that set's own `good.md`.

## What measured (wrong-row rows caught as `fails` at p ≥ 0.6, both repeats; the bar in brackets)

| Arm (counted rows) | R1, row only | R2, row + property list | R1', paraphrase |
| --- | --- | --- | --- |
| `defective-swapped` (10) [8] | 0 (one `fails` below 0.6; nine `holds` at 0.51–0.80) | 0 (two below 0.6, one `unknown`; seven `holds` at 0.56–0.87) | 0 (nine `holds` at 0.56–0.92, one `unknown`) |
| `derangement-s1` (12) [11] | 1 (+1 weak, 1 flip, 2 `unknown`; 7 `holds` at 0.50–0.84) | 2 (+3 flips, 1 `unknown`; 6 `holds` at 0.55–0.86) | — |
| `derangement-s2` (13) [11] | 0 (+1 weak, 1 flip, 1 `unknown`; 10 `holds` at 0.51–0.86) | 0 (+1 weak, 2 flips, 2 `unknown`; 8 `holds` at 0.54–0.93) | — |
| `adjacent-swap` wrong rows (2) [2] | 0 (1 flip, 1 `holds` at 0.76) | 1 (row 13; row 14 `holds` at 0.67) | — |
| controls, decoys (5) [4] | 0 (3 `holds` at 0.87–0.91, 2 `unknown`) | 0 (+1 weak, 1 flip; 3 `holds` at 0.53–0.62) | 0 (5 `holds` at 0.69–0.93) |
| real derangement, designs 03 and 05 (15) [11] | 1 (+1 weak, 1 `unknown`; 12 `holds` at 0.53–0.92) | — | — |

Genuine rows hold under every candidate: `good` 14/14 (R1 and R2), `shared-1-11` 14/14 (both
rows of the legitimate overlap `holds`), the four genuine controls 4/4 (all three candidates),
the 30 real witness rows 29/30 (one flip on one repeat, 0.47 then 0.60; no row `fails`). The
five relevance-neutral controls read `holds` or `unknown` (never `fails`) under every candidate.
R1' sits within 2 rows of R1 on both of its fixtures. Cost: 224 questions per full candidate.

## Expectations against the run

| Expectation | Outcome |
| --- | --- |
| R1 `good` 13/14 | met: 14/14 |
| R1 swapped 6–8 of 10 | **refuted: 0** (the pre-registered "repeats 4c" cell: ≤ 3 of 14) |
| R2 swapped ≥ 8 of 10, derangements ≥ 11 | **refuted: 0, 2 and 0** |
| derangements R1 ≥ 9 of ~12 | **refuted: 1 and 0** |
| adjacent-swap wrong rows: R1 1 of 2, R2 2 of 2 | refuted: 0 and 1 |
| shared-1-11 both `holds` | met under both |
| decoys: R1 ≥ 3, R2 ≥ 4 | **refuted: 0 and 0** |
| real designs ≤ 2 rows flagged | met: 0 flagged (one near-threshold flip) |
| real derangement ≥ 11 of 15 | **refuted: 1** |
| R1' within 2 rows of R1 | met |

## Decision (the table's fourth row)

**No candidate meets the hypothesis; nothing ships** (the two relevance questions and the paraphrase in the first run, the two extraction forms E1 and E2 after the pre-run amendments; see the section below). The judge, handed a property name and
a witness cell and asked only whether the cell is a failure of *this* property, answers `holds`
for nearly any plausible failure description, whether the row's own or a distant row's (0.5–0.93),
and listing the table's other properties beside the row (R2) moves at most two rows. The
paraphrase arm shows the wording is not the cause. The round's numbers are the bar the extraction
form (design 05 §Oracle toolkit: name the property the cell is a failure of, then compare that
name to the row's, structurally) must beat: **≥ 8 of 10 on the swapped fixture, ≥ 11 of 12 and
of 13 on the derangements, ≥ 4 of 5 decoys, ≥ 11 of 15 on the real derangement, with `good`,
`shared-1-11` and the real rows still ≥ 13 of 14 `holds`**, against this round's best of 0, 2, 0,
0 and 1. Gate-ledger item 4's wrong-row half stays open with that bar; `witness_observable_in_row`
ships unchanged and its calibration note names the gap (round 10's wording already does).

No `design-witness-relevant` constraint lands; `core.row_with_column` stays in the engine as an
evidence form (tested, unused by any shipped module) because the extraction form will need the
same rendering.

Decision rows recorded (`decisions.md`): nothing ships; the extraction-form bar; the builder's
accepted decisions (round 4c's files unchanged with their own base; new fixtures from HEAD;
`expect_cells` as the expectation key; decoy capitalisation verbatim; a per-fixture invariant;
`source:` documents in the real track; the engine form).

## The extraction form, measured (E1, pre-run amendment of 12:50; run 11:24–11:29 by the lead's clock, 322 questions, every track complete)

E1 asks a 15-way `choose` over the table's property names ("name the one property whose failure
the Failure witness cell describes") with the row's Property and Failure witness cells and the
property list as evidence. Result: the judge names the row's **own** property on every wrong-row
witness, at 0.80–1.00 (`defective-swapped` 0 of 10 caught, `derangement-s1` 0 of 12 with one
weak catch at 0.56/0.61, `derangement-s2` 0 of 13, `adjacent-swap` 0 of 2, decoys 0 of 5, the
real derangement of designs 03 and 05 1 of 15), while every genuine row is held (`good` 14/14,
`shared-1-11` 14/14, controls 4/4, the real rows 30/30, the neutral controls 5/5 answered with
the row's own property rather than `none`). The sidecars show the mechanism: with the Property
cell beside the witness, a choose over that same list echoes the cell; E1 measures echo, not
extraction. Against the bar: every wrong-row bar missed by the full width, every held bar met.

**E2** (pre-run amendment of 13:15; run 11:37–11:42 by the lead's clock, 322 questions, every
track complete): the same labels, key and expectations with the row's own property hidden (the
witness cell alone as evidence, the property list in the question's key). With the echo removed
the judge extracts: when it decides at p ≥ 0.6 it names the **source** row's property, never the
row's own, on the wrong-row fixtures (`defective-swapped` 4 of 10 precise catches, 0 misses;
`derangement-s1` 6 of 12; `derangement-s2` 7 of 13; decoys 3 of 5 with one miss; the real
derangement 4 of 15 precise, 1 miss) and the neutral controls `none` 5 of 5. But a fifteen-way
`choose` spreads its mass: about half of every fixture's rows sit below 0.6 (`unknown` at
0.22–0.49, or a label at 0.50–0.59), so the held bars fail as well (`good` 7 of 14,
`shared-1-11` 7 of 14, `near-miss-2-3` 6 of 13, the real rows 13 of 30) and the wrong-row bars
are missed by the undecided rows, not by wrong answers. Repeat flips 1–2 per fixture. Against the
bar: neither the wrong-row bars nor the held bars are met, and the amendment's third decision row
applies.

**Decision on the extraction form.** E1 measures echo (the row's own property beside the
witness wins a choose over the same list) and E2 measures extraction with too little mass per
label to clear a 0.6 threshold on a 15-way answer. Neither ships. The record for the next
instrument is specific: the witness-only evidence is the right input (no echo; precise names
when decided; `none` on neutral text), and the answer form has to be binary per candidate
property (or a ranked extraction read by a rule) rather than one 15-way choose, so that a 0.6
decision is reachable; its bar is this round's, unchanged. Relevance is left to that instrument
(gate-ledger item 11, rewritten).

## Left unmeasured

The extraction form itself (next); verification sections written as lists; judge variation
beyond two repeats; relevance and observability asked together; whether a two-step ask (name,
then compare) inside one question behaves like extraction.

## Records

`round-9-preregistration.md` (plan, review), `results/round-9-review.md` (plan review),
`results/round-9-{R1,R2,R1p,real,real-deranged}.txt`, `probe/oracle-fixtures/witness_relevant{,_in_table,_paraphrase}/`
(the candidate sets), `probe/oracle-fixtures/verification_falsifies/{derangement-s1,derangement-s2,adjacent-swap,near-miss-2-3,shared-1-11,relevance-controls}.md`
and `relevance-row-labels.yaml` (fixtures and the lead's labels), `probe/oracle-fixtures/real-cells/{relevance-labels,relevance-deranged}.yaml`
and `real-cells/deranged/` (the real tracks), `doc-verify/src/engine/{facts,checker,oracles}.ts` and
`doc-verify/tests/language/row-with-column.test.ts` (the engine form), `decisions.md`, `gate-ledger.md`.
