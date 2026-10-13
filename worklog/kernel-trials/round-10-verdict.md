# Round 10 verdict — the cell-grain thresholds from real cells (2026-10-13)

## Predicate

```sh
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels labels-r10.yaml         --request-shape per-atom --repeat 2 --no-spans --ledger round10-goal        --cap 90    # complete: true, 60 of 90
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels witness-labels-r10.yaml --request-shape per-atom --repeat 2 --no-spans --ledger round10-design      --cap 160   # complete: true, 104 of 160
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_reasons          --request-shape per-atom --repeat 2 --invariant-base c632a91 --no-spans --ledger round10-seed-goal   --cap 198   # complete: true, 132 of 198
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable_in_row --request-shape per-atom --repeat 2 --no-spans --ledger round10-seed-design --cap 260   # complete: true, 168 of 260
node worklog/kernel-trials/probe/threshold-sweep.mjs --self-test                                                                                                               # pass (8/8)
node worklog/kernel-trials/probe/threshold-sweep.mjs round10-goal round10-design round10-seed-goal round10-seed-design --batched-ledger round6-B --batched-ledger round6-C2   # complete: true, exit 0
```

Run by the lead 08:24–08:31, live judge, per-atom, cache off, two repeats, 464 questions, no cap
tripped. Outputs: `results/round-10-{goal,design,seed-goal,seed-design,sweep}.txt`; sidecars
`.leaves-round10-*.json`. The sweep was built by an Opus subagent from the plan's specification,
reviewed by the reviewer seat (`/tmp`-only review; its three should-fix findings and one
correction applied before the run: expected repeats fixed at 2, mock-tagged entries refused
without `--mock`, a missing expectation a named problem, the float slack dropped for a 6-decimal
compare), and its eight self-test defects each turn red under their own mutation.

## What measured

p is the minimum of the two repeats' peaks; decided iff p ≥ t; `unknown` otherwise.

| Oracle, population | n | wrong-side at 0.5 | right-side at 0.5 | at 0.6: wrong / right / unknown | at 0.7: wrong / right / unknown |
| --- | --- | --- | --- | --- | --- |
| `evidence_reasons`, real counted+rewritten (goals 01, 04) | 13 | 0 | 13 | 0 / 13 / 0 | 0 / 12 / 1 (goals/01 row 8, 0.63) |
| `evidence_reasons`, controls (goals 02–03, reported apart) | 13 | 0 | 13 | 0 / 13 / 0 | 0 / 10 / 3 |
| `evidence_reasons`, seeded (round 4's 11 fixtures) | 50 (+5 known-miss) | 0 | 50 | 0 / 50 / 0 | 0 / 48 / 2 (one genuine: `good-nopath` row 3, 0.67) |
| `witness_observable_in_row`, real counted+rewritten (designs 02–05) | 44 | 0 | 43 | 0 / 42 / 2 | 0 / 41 / 3 |
| `witness_observable_in_row`, held out (design 06, the lead's own) | 8 | 0 | 8 | 0 / 8 / 0 | 0 / 7 / 1 (row 7, 0.60) |
| `witness_observable_in_row`, seeded (round 4c's 6 fixtures) | 84 | 15 | 69 | 14 / 64 / 6 (2 genuine lost) | 14 / 64 / 6 (3 genuine lost, 1 gain) |

- **No real cell is on the wrong side at 0.5 on either oracle.** The judge and the lead's
  pre-registered labels agree on 13/13 evidence cells and 43/44 witness rows; the one exception is
  design/03 row 2 ("Malformed strategy YAML silently falls back", labelled `holds` at low
  confidence), which the judge leaves `unknown` at 0.48 on one repeat and 0.58 on the other: not
  a wrong side, an undecided cell, and the shipped check reads design/03 NEEDS-REVIEW at 0.5
  today.
- **Raising t buys nothing and costs coverage.** With zero wrong-side cells there is nothing for a
  higher threshold to demote; every move is a right-side cell to `unknown` (a NEEDS-REVIEW on a
  good document): at 0.6, design/04 row 3 (0.57); at 0.7, goals/01 row 8, design/05 row 5,
  design/06 row 7 and the seeded `good-nopath` row 3 besides.
- **The seeded wrong-side cells are the relevance class, not a threshold matter.** The 15
  wrong-side witness cells at 0.5 are 13 of `defective-swapped`'s 14 rows (round 4c's known
  relevance gap: a genuine witness on the wrong row reads `holds` at 0.57–0.97; row 4 alone reads
  `fails`, at 0.52) and two rows of the `controls` fixture (row 1, a defective control read
  `holds` at 0.75; row 13, a genuine control read `fails` at 0.83). At 0.6 one of them demotes
  (swapped row 6, a gain) while two genuine rows of the subtle fixtures (0.57, 0.58) are lost; the
  trade is 1 for 2 and the gap stays. Round 9 measures it.
- **Band and stability.** Counted real cells in [0.5, 0.7): 1 of 13 (8%) on evidence, 4 of 44
  (9%) on witnesses, below the predicted 10–25%; no label flips between repeats; the sides differ
  between repeats on 1 real cell at 0.5 (design/03 row 2) and on 2 seeded cells at 0.6.
- **Per-atom against batched on the seeded cells.** The round 6 batched p sits beside the
  per-atom p in `results/round-10-sweep.txt`: the genuine cells that the per-atom shape leaves
  thin (`good` row 3 at 0.55 against 0.98 batched; `defective-subtle` row 3 at 0.57 against 0.97)
  are the cost side of round 6's accuracy gain, recorded there and not re-decided here.
- **Rewritten cells.** All 13 cells rewritten after judge exposure (goals/01 rows 1–6; design/02
  rows 10–11, 03 row 9, 04 row 7, 05 rows 1, 2, 7) hold at ≥ 0.76; the rewrites reached the
  judge's bar.
- **Controls.** The 13 "Evidence required" cells of goals 02–03 all read `fails` at ≥ 0.63 under
  the fixture-local rule, the opposite of round 4's batched prediction ("the judge says holds on
  at least half"): per-atom, the judge does tell planned from taken.

## Expectations against the run

| Expectation | Outcome |
| --- | --- |
| `evidence_reasons` wrong-side at 0.5 ≤ 2 | 0: met |
| `evidence_reasons` best t = 0.6, trading 1–2 wrong for ≤ 1 right | **wrong**: there is nothing to trade; 0.5 is best |
| `evidence_reasons` seeded at 0.6: 0 genuine to unknown | met (1 at 0.7) |
| `witness_observable_in_row` wrong-side at 0.5 ≤ 4 | 0: met |
| `witness_observable_in_row` best t = 0.5 | met |
| gross row 13 moves to unknown at 0.6, the only move | **wrong**: gross row 13 reads `fails` at ≥ 0.9 per-atom; the moves are two genuine subtle-fixture rows lost |
| band share 10–25% | 8% and 9%: below, not refuting (> 40%) |
| repeat flips ≤ 2 per oracle | 0 label flips: met |
| design 06 held out ≤ 2 wrong-side | 0: met; row 7 is the thinnest at 0.60 |

The two wrong predictions are the finding: the middling band seen in rounds 4, 4c and 6 was the
batched shape's and the pre-rewrite cells'; under per-atom on the rewritten corpus the real cells
sit at 0.63–0.99 on the right side and a threshold has no error to catch.

## Decision (the table's fourth row)

**0.5 stays on both oracles.** No t > 0.5 cuts wrong-side cells by 2 (there are none to cut) and
every candidate loses right-side cells. The measured band is written as a calibration note in
each oracle's comment block (`doc-verify/lib/goal.yaml`, `doc-verify/modules/design.yaml`),
citing this round. The 30% rule does not fire (0% on both). Gate-ledger item 4 closes on the
threshold half; its wrong-row half stays open and is round 9's.

Decision rows recorded (`decisions.md`): the thresholds; the sweep's rules (minimum of repeat
peaks, `p ≥ t` on six decimals, symmetric demotion, a repeat disagreement classed `flip`, a judge
`unknown` unknown at every t, the oracle-local document verdict per t, `defective-wrongrow` the
known miss, a right-side defective cell dropping to unknown a loss); expected repeats fixed at 2.

## What changes after the verdict

1. Calibration notes on both oracles (this commit).
2. design/03 row 2, the one undecided real cell, is rewritten as a printed observable (this
   commit): "A malformed strategy YAML file loads without a warning naming it, and the run
   reports the default strategy's result as if the file were absent." Re-measured in the next
   real-cell track, not here.
3. `threshold-sweep.mjs` lands as the programme's reader for any later threshold pass; its
   `--batched-ledger` flag is the bridge to the round 6 sidecars.

## Left unmeasured

A finer grid is moot while wrong-side is zero. The relevance gap (round 9). The four `module-*`
libraries' thresholds (round 8 decides their shape first). Judge variance beyond two repeats and
a second judge. The labels are one reader's, judge-exposed on 13 of 57 counted cells and marked
so; goal 04 and design 06 are the never-exposed check and agree 13/13.

## Records

`round-10-preregistration.md` (plan, review, two pre-run amendments), `results/round-10-review.md`
(the plan's independent review), `results/round-10-*.txt` (the five outputs),
`probe/oracle-fixtures/real-cells/{labels-r10,witness-labels-r10}.yaml` (the labels),
`probe/threshold-sweep.mjs` (the reader), `decisions.md`, `gate-ledger.md`.
