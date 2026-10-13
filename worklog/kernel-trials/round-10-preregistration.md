# Round 10 — the evidence-cell and witness-cell thresholds from real cells

Written 2026-10-13 before any live call; amended the same day after the independent review
(`results/round-10-review.md`, verbatim) and before the run. Gate-ledger item 4: the two
cell-grain oracles (`evidence_reasons` in `doc-verify/lib/goal.yaml`, `witness_observable_in_row`
in `doc-verify/modules/design.yaml`) ship at threshold 0.5. Rounds 4, 4c and 6 saw real cells of
middling quality land at 0.51–0.66 and the judge's reading of them move with wording and shape,
while seeded cells sit at ≥ 0.78. The threshold was never set from real cells. task.md item 4.

## What a threshold can and cannot do (the review's finding 1)

The runner's p is the peak of the judge's two-option distribution (`peak(leaf)` in
`oracle-test.mjs`), the confidence of the decided side, so p ≥ 0.5 always. A threshold t demotes
a decided label with p < t to `unknown` on **either** side (demotion is symmetric: a `holds` at
0.55 and a `fails` at 0.55 both become `unknown`). Under the model (`docs/doc-verify-model.md`
§verdict) an `unknown` leaf under an `error` constraint makes its binding undetermined and the
document **NEEDS-REVIEW**, never PASS and never NO-GO. So raising t never adds an agreeing cell;
it trades two demotions: a **wrong-side decided cell** (the lead's label and the judge's decided
label differ) demoted is an error turned into a review, a gain; a **right-side decided cell**
demoted is a correct answer turned into a review, a cost (a false review on a good document, a
missed NO-GO on a bad one). The round measures that trade at t ∈ {0.5, 0.6, 0.7} per oracle.

## Hypothesis

Per oracle, with the lead's pre-registered labels on every real cell at HEAD and per-atom
answers with two repeats (p per cell = the minimum of the two repeats' peaks; decided iff
p ≥ t), a threshold t > 0.5 exists at which the wrong-side decided cells fall by at least 2 and
the right-side decided cells fall by at most 1 on the evidence-bearing real cells, and no
genuine seeded cell of rounds 4 and 4c drops to `unknown`. **Refuting cells:** at every t > 0.5
the right-side demotions are at least the wrong-side ones (the middling band is the judge's,
not the threshold's; 0.5 stays); a genuine seeded cell drops to `unknown` at the t that best
trades on real cells (the two goals conflict; 0.5 stays and the conflict is recorded); the
wrong-side decided cells at 0.5 exceed 30% of the evidence-bearing real cells of an oracle (the
oracle's reading of real cells is not the lead's: a finding about the question, not the
threshold; recorded as a decision row, no threshold change).

## Axis

The threshold alone: 0.5, 0.6, 0.7, read off one per-atom run per track (the label and p per
cell do not change with t; only which side of t p falls on). No new judge calls per candidate;
`threshold-sweep.mjs` never calls the judge.

## Material (every document at commit f991877 or later; the ledger names the commit)

Real cells, the lead's labels in **new** files written before the run (the 4c files
`real-cells/labels.yaml` and `witness-labels.yaml` stay as the baseline they are):

| Track | File | Documents | Cells | Status |
| --- | --- | --- | --- | --- |
| goal evidence | `real-cells/labels-r10.yaml` | goals/01 (8 evidence-bearing cells: R1–R6, A7, A8); goals/02, 03 (13 "Evidence required" controls, all `fails`, asked through the fixture-local rule, never by the shipped constraint: **reported apart, not counted**); goals/04 (new: 5 evidence cells, R1–R5) | 13 counted, 13 controls | goals 01–03 landed; goal 04 landed |
| design witnesses | `real-cells/witness-labels-r10.yaml` | designs 02 (9), 03 (8), 05 (13) as in 4c; design 04 (14 rows; the 4c `good` fixture, labelled as a real document here); design 06 (8 rows, frozen at f991877, **held out**: its author is the lead, so its labels are the author's and are reported as a separate line) | 44 counted + 8 held out | 02, 03, 05 landed; 04 landed; 06 draft, frozen |

The labels are **pre-registered, judge-exposed, not blind**: the lead saw the judge's p on these
cells in rounds 4, 4c and 6, and thirteen cells were rewritten after the judge flagged them (goals/01's rows 1–6 in
round 4 and R5 again in round 6; design/02 rows 10–11, design/03 row 9, design/04 row 7, design/05
rows 1, 2, 7 in rounds 4c and 6). Each label carries `since: round-N` (unchanged since it
was first labelled) or `rewritten: round-N` (rewritten after judge exposure; reported as its own
line). Goal 04's and design 06's labels are the only never-exposed ones and are reported as such.

Seeded cells, by file: `oracle-fixtures/evidence_reasons/*.md` (11 fixtures of round 4, listed in
its `fixtures.yaml`; `defective-wrongrow.md` is a known miss, the judge never sees the
requirement text, and its expected side is recorded as "miss, reported apart") and
`oracle-fixtures/witness_observable_in_row/fixtures.yaml` (round 4c's 6 fixtures on design/04,
14 rows each). Re-run per-atom with `--repeat 2`; the per-atom run **replaces** the batched
baseline of rounds 4 and 4c, and the verdict tabulates the old batched p beside the new per-atom
p per cell so the shape change reads apart from the threshold change.

## Measurements

Per oracle and per t: wrong-side decided cells, right-side decided cells, `unknown` cells
(coverage), and the document verdict each `unknown` produces (NEEDS-REVIEW on which document);
the sorted p values of the counted real cells (no deciles: n < 20); the share in [0.5, 0.7);
per seeded cell, its side at each t (`holds` / `fails` / `unknown`), with a genuine cell moving
to `unknown` a loss, a defective cell moving from a wrong `holds` to `unknown` a gain, and a
cell moving on one repeat only reported as a flip; repeat flips; batched (rounds 4, 4c) against
per-atom p per seeded cell.

## Expected outcomes (recorded before the run), per oracle

| Oracle | Measure | Expectation | Refuting cell | Confidence |
| --- | --- | --- | --- | --- |
| `evidence_reasons` | wrong-side at 0.5 (13 counted cells) | ≤ 2 | ≥ 4 (30%) | medium |
| `evidence_reasons` | best t | 0.6 trades 1–2 wrong-side for ≤ 1 right-side | 0.6 demotes more right-side than wrong-side | low |
| `evidence_reasons` | seeded cells at 0.6 | 0 genuine cells to `unknown` | any | medium |
| `witness_observable_in_row` | wrong-side at 0.5 (44 counted rows) | ≤ 4 | > 13 (30%) | medium |
| `witness_observable_in_row` | best t | 0.5 (the witness band is thin) | 0.6 trades ≥ 2 wrong-side for ≤ 1 right-side | medium-low |
| `witness_observable_in_row` | seeded cells at 0.6 | gross row 13 (`holds` 0.51 in 4c, a defective cell) moves to `unknown`: a gain, and the only move | a genuine row to `unknown` | medium |
| both | share of counted real cells in [0.5, 0.7) | 10–25% | > 40% (the judge is undecided on real text) | medium |
| both | repeat flips across t | ≤ 2 cells per oracle | > 4 | medium |
| design 06, held out | ≤ 2 rows wrong-side at 0.5 | — reported, not a refuter — | low |

## Decision table (recorded before the run), per oracle

| Outcome | Action | Recorded in |
| --- | --- | --- |
| a t > 0.5 cuts wrong-side by ≥ 2, right-side by ≤ 1, and no genuine seeded cell drops to `unknown` | that t ships in the oracle's `threshold:` line (the one-line mechanism every oracle threshold uses), with the round cited in the oracle's comment; the oracle's fixture tests re-run at the new t in the same commit | the verdict; `decisions.md`; `gate-ledger.md` item 4 |
| two such t tie | the lower one ships | the same |
| the best t differs by oracle | each oracle by its own evidence | the same |
| no t > 0.5 meets the bar | 0.5 stays; the measured band is written as a calibration note in the oracle's comment block (`doc-verify/lib/goal.yaml`, `doc-verify/modules/design.yaml`) | the verdict; a decision row |
| the best t drops a genuine seeded cell to `unknown` | 0.5 stays; the conflict is a decision row and a candidate for a finer grid | `decisions.md` |
| a seeded cell moves on one repeat only | reported as a flip; it neither blocks nor supports the move | the verdict |
| wrong-side at 0.5 above 30% of counted cells | the question, not the threshold, is at fault: no threshold change; a decision row naming the oracle for a question round | `decisions.md` |
| any real-track run not `complete` (a cap trip, a missing repeat) | no verdict; the run is repeated under a raised cap | the verdict's run log |

## Predicate (mock first, then live; caps = 1.5 × the mock projection × repeats)

```sh
DOC_VERIFY_MOCK_JUDGE=1 node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels labels-r10.yaml --request-shape per-atom --repeat 2 --no-spans --ledger round10-goal
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels labels-r10.yaml         --request-shape per-atom --repeat 2 --no-spans --ledger round10-goal        --cap 90
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels witness-labels-r10.yaml --request-shape per-atom --repeat 2 --no-spans --ledger round10-design      --cap 160
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_reasons          --request-shape per-atom --repeat 2 --invariant-base c632a91 --no-spans --ledger round10-seed-goal   --cap 198
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable_in_row --request-shape per-atom --repeat 2 --no-spans --ledger round10-seed-design --cap 260
node worklog/kernel-trials/probe/threshold-sweep.mjs --self-test && node worklog/kernel-trials/probe/threshold-sweep.mjs round10-goal round10-design round10-seed-goal round10-seed-design --batched-ledger round6-B --batched-ledger round6-C2
```

Projection (per-atom, `--no-spans`, two repeats, the mock runs of 2026-10-13 06:17 on the two
label files): goal real 30 × 2 = 60 (26 labelled cells plus the library's other atoms); design
real 52 × 2 = 104; evidence seeded 66 × 2 = 132 (the mock run; the cap is 198); witness seeded 84 × 2 = 168; about 464 questions, no
follow-ups. The mock run first proves the cell counts per labels file against the tables. A cap
trip is `complete: false`, never a verdict. `--invariant-base c632a91` is on the evidence set
only because that set's tables are checked unchanged against the commit that authored them
(commit `c632a91` exists; the goal fixtures were untouched from round 4c to 9); the witness set
declares its `evidence-column-only` invariant in its own `fixtures.yaml`.

`threshold-sweep.mjs` (the builder's deliverable): reads `oracle-fixtures/.leaves-<ledger>.json`
sidecars (written by every promotion run), joins them to the labels files and `fixtures.yaml`
expectations, aggregates two repeats by the minimum peak, classifies each cell at each t ∈ {0.5,
0.6, 0.7} with `p ≥ t` as decided, and prints the tables above. It never calls the judge. `--self-
test` runs on a synthetic sidecar and must flip on four seeded defects: a cell with p exactly
0.6 (must be decided at 0.6, `unknown` at 0.7), a cell whose repeats disagree (must print as a
flip and take the minimum), a cell missing one repeat (must set `complete: false`), a cell with
no label (must set `complete: false` and name it). `complete: false` prints the offending cells
and exits 1.

## Left unmeasured

The wrong-row and swapped-witness relevance gap (ledger item 4's other half and the 4c verdict):
a threshold cannot touch it; round 9 measures it, and 0.5 staying here does not close it. The
four `module-*` libraries pinned `batched` (round 8 decides; their thresholds are not set here).
A threshold between the candidates (a finer grid is the next pass if 0.6 wins by little). Judge
variance beyond two repeats; a second judge. Whether the lead's labels are the right ground
truth (one reader's, judge-exposed on most cells). Seeded cells in [0.5, 0.6) are the real test
of a threshold and there are almost none.

**Pre-run amendment, 2026-10-13 08:20 (lead, after the builder's mock run):** the evidence seeded
cap is 198 (132 projected); the rewritten cells are 13 (goals/01 rows 1–6; design/02 rows 10–11, 03 row 9, 04 row 7,
05 rows 1, 2, 7), reported as their own line beside `counted` and `counted+rewritten` (the plan's
n is `counted+rewritten`, which the 30% rule, the sorted p, the band share and the bar use); the
batched column comes from round 6's live sidecars (`--batched-ledger round6-B`, `round6-C2`)
because rounds 4 and 4c left none; the sweep's decisions, recorded as decision rows at the
verdict: a repeat disagreement takes the side of the minimum-peak repeat and is classed `flip` at
any t where the sides differ; `p ≥ t` with 1e-9 slack; a judge `unknown` or an empty distribution
is unknown at every t; the oracle-local document verdict per t is NO-GO if a cell is decided
`fails`, else NEEDS-REVIEW if a cell is unknown, else PASS; `defective-wrongrow` is the known miss,
printed apart; a right-side defective cell dropping to unknown counts as a loss too.

## Review

`results/round-10-review.md`, fourteen findings, "run after amendments". Taken before the run:
1 (p's semantics; symmetric demotion; `unknown` → NEEDS-REVIEW; the trade replaces agreement),
2 (material by file and count; goal 04 added; design 04 as a real document; design 06 frozen and
held out), 3 (new label files; `since`/`rewritten` per cell; "pre-registered, judge-exposed"),
4 (controls reported apart; sorted p, no deciles; the goal oracle's small n stated), 5 (minimum
of two peaks; `p ≥ t`; `--repeat 2` on the seeded sets), 6 (per-atom replaces the batched
baseline, tabulated side by side; `--request-shape per-atom` explicit), 7 (a refuter per row;
per oracle; "side" defined with gain/loss/flip), 8 (the 30% rule stated once, with its decision
row), 9 (the decision table; the `threshold:` line; the comment block named), 10 (the sweep's
inputs, self-test defects, exit code, no judge calls), 11 (projection and caps; mock first; cap
trip is incomplete), 12 (`--invariant-base` explained; fixtures by file; `defective-wrongrow`
reported apart), 13 (left unmeasured extended), 14 (this disposition table).
