# Round 9 — witness relevance to its property

Written 2026-10-13 before any live call; amended the same day after the independent review
(`results/round-9-review.md`, verbatim) and before the run. Rounds 4 and 4c found the same gap
twice: the judge, asked whether a cell is an observable failure condition, never checks what it
is a failure *of*. **Baseline (round 4c, the comparison this round is read against):** C2
(`witness_observable_in_row`, the shipped oracle, with `Property:` and `Failure witness:` in the
evidence and the sentence "the witness must be a failure of this row's property") and its
paraphrase C2' both labelled every genuine witness on the wrong row `holds`: 0/14 `fails` on
`defective-swapped`, at 0.64–0.99. What this round changes against that baseline: the question
asks about relevance **only** (the observability task and its criteria are removed), and one
candidate adds the table's property list. The extraction form (a structured-answer kind in the
host) is the next candidate if this fails, and this round's numbers are the bar it must beat.

## Hypothesis

A relevance-only question per row labels a genuine witness on the wrong row `fails` and a
genuine witness on its own row `holds`, at p ≥ 0.6, under at least one candidate: ≥ 11 of the
unambiguous rows of each wrong-row arm `fails`, and at most 1 false `fails` on `good`. Labels in
[0.5, 0.6) and `unknown` are not separating and are reported apart. **Refuting cells:** R1 at or
below 3/14 `fails` on `defective-swapped` (repeats 4c: the wording alone buys nothing); neither
candidate reaches 11/14 on any wrong-row arm (the judge cannot do relevance at this grain; the
extraction form is next); more than 1 false `fails` on `good` under the selected candidate;
the real-design derangement arm below 11/14.

## Axis

What the judge sees when asked about relevance alone: the row (R1: `core.cells(D, R, ['Property',
'Failure witness'])`) against the row plus the table's property list with the sentence that tells
the judge to use it (R2: `core.row_with_column(D, R, C)`, rendering below). The co-variance of
list and sentence is accepted and named: R2 is "list plus the instruction to use it". A paraphrase
arm R1' on the swapped and control fixtures guards against one wording deciding the verdict.
Everything else is held; per-atom requests, cache off, two repeats.

## Candidates and their questions, verbatim

**R1** (`witness_relevant(D, R, L)`, threshold 0.5, separation 0.6, labels `holds` / `fails`):

> This is one row of a design's verification table: a property and the cell that is supposed to
> describe how that property's failure would show. Judge one thing only: is the condition the
> cell describes a failure of this row's property, as opposed to a failure of some other
> property? Hold if the condition, when it occurred, would mean this property is broken. Fail
> if the condition is about a different property. Do not judge whether the cell is observable,
> specific or well written; that is judged elsewhere.

**R2** (`witness_relevant_in_table(D, R, C)`): R1's text plus, after the first sentence: "The
properties of the same table are listed after the row; the cell must fail this property and not
another listed one."

**R1'** (`witness_relevant_paraphrase`, on `defective-swapped` and `relevance-controls` only):

> Read a property and its failure-witness cell from a design's verification table. Would the
> situation the cell describes, if it happened, show that this property had failed? Say holds if
> yes. Say fails if what it describes is really a failure of some other property. Ignore how well
> the cell is written and whether it is observable.

## Fixtures (design/04 at HEAD; the Property and Command columns fixed; files under `probe/oracle-fixtures/verification_falsifies/`, reused by the three candidate sets via `files_from`)

| Fixture | Witness column | Rows counted | Expected under R1 and R2 |
| --- | --- | --- | --- |
| `good` | HEAD's 14 | 14 | `holds`; R1 likely flips: row 11 (shares a clause with row 1); R2 likely flips: rows 4, 6, 7, 14 (bundled witnesses naming other properties' vocabulary); predicted `good` R1 13/14, R2 12–14/14 |
| `defective-swapped` (round 4c's, shift by one) | each row has the next row's witness | 10 unambiguous (rows 1, 5, 7, 13 labelled `ambiguous`: the neighbour's witness is near-related) | `fails` on ≥ 11 of 14 hoped, counted on the 10 unambiguous: ≥ 8 |
| `derangement-s1`, `derangement-s2` (seeded random derangements, seeds 1 and 2, no fixed point) | random wrong rows | per-row labels written before the run; near-related pairs `ambiguous` | `fails` on ≥ 11 of the unambiguous |
| `adjacent-swap` (rows 6↔7 and 13↔14 exchanged; the others HEAD's) | 4 wrong rows, adjacent and related | 4 wrong (2 `ambiguous`), 10 right | the 2 unambiguous wrong rows `fails`; 10 `holds` |
| `near-miss-2-3` (row 2's witness on row 3; the others HEAD's) | 1 wrong row, related | 1 (`ambiguous`) | reported, not counted |
| `shared-1-11` (rows 1 and 11 exchanged) | 2 rows with a shared clause | 2, labelled `holds` | `holds` (a legitimate overlap must not be penalised) |
| `relevance-controls` | 14 rows by class, texts below | 9 (the 5 relevance-neutral rows are reported, not counted) | 4 genuine `holds`; 5 decoy-wrong-failure `fails` |

`relevance-controls`, per row: genuine (HEAD's witness) on rows 1, 5, 9, 13; **relevance-neutral**
generic cells on rows 2, 6, 10, 12, 14 ("the check fails", "a test is red", "the output is
wrong", "behaviour differs from the specification", "a regression appears"; a class the
relevance question is told not to judge, reported for what the judge does with it); **decoy
wrong failure** on rows 3, 4, 7, 8, 11: a distant row's genuine witness pasted verbatim with a
non-failure mention of the row's own property in front ("With three-valued evaluation
unchanged, " + row 12's witness on row 3; "With the static checks unchanged, " + row 10's on row
4; "Under the declared request shape, " + row 2's on row 7; "Under the extends law, " + row 9's
on row 8; "With nested classification unchanged, " + row 13's on row 11), expected `fails`. Every
control text and its class is in `fixtures.yaml` before the run; a hybrid is not counted.

Per-row labels (`fails` / `holds` / `ambiguous`, with confidence) for every fixture are written
by the lead before the run in `verification_falsifies/relevance-row-labels.yaml` (with the fixed
permutations: derangement seeds 1 and 2 by mulberry32 Fisher–Yates with rejection, `from` lists
recorded) and copied by the builder into each set's `fixtures.yaml`; only unambiguous rows
count toward the bars. Counted rows: `defective-swapped` 10, `derangement-s1` 12,
`derangement-s2` 13, `adjacent-swap` 2 wrong + 10 right, `shared-1-11` 2, controls 9. Invariants: `evidence-column-only` for every fixture but the permutations, which use a
`column-permutation` invariant (the witness column is a permutation of HEAD's; every other cell
equal), with the permutation seeds recorded.

## Real designs

`real-cells/relevance-labels.yaml` (4c's shape: `oracle`, per document `column` and `rows:
<section>#rowN: {label, confidence, why, shares_with}`), the lead's labels for every witness
row of designs 02, 03 and 05, written (30 rows, all `holds`, 6 with `shares_with`); expected mostly `holds` (every witness is
on its own row), so this track measures over-strictness. A **derangement arm** on designs 03 and
05 (witness column rotated by 3; labels in `real-cells/relevance-deranged.yaml`, written: 15
unambiguous `fails`, 4 `ambiguous`) gives the real track a positive class on real vocabulary;
expected ≥ 11 of the 15 unambiguous `fails`.

## Measurements

As rounds 4 and 4c: per cell label and p, k/n per fixture over counted rows, document verdict,
false pass first, per-row p on `good`'s rows 4, 6, 7, 11, 14; `--repeat 2`, cache off, flips on
repeat; R1' against R1 on its two fixtures; real agreement with the labels; cost per track.

## Expected outcomes (recorded before the run)

| Measure | R1 | R2 | Confidence |
| --- | --- | --- | --- |
| `good` | 13/14 `holds` | 12–14/14 | medium |
| `defective-swapped`, unambiguous 10 | 6–8 `fails` | ≥ 8 | medium-low on R1, medium on R2 |
| derangements, unambiguous | ≥ 9 of ~12 each | ≥ 11 | medium |
| `adjacent-swap` wrong rows | 1 of 2 | 2 of 2 | low |
| `shared-1-11` | both `holds` | both `holds` | medium |
| controls, decoy 5 | ≥ 3 `fails` | ≥ 4 | medium-low |
| controls, neutral 5 | reported | reported | — |
| real designs | ≤ 2 rows flagged per design | the same | medium |
| real derangement | ≥ 11 of the unambiguous | ≥ 11 | medium |
| R1' | within 2 rows of R1 on both fixtures | — | low |

## Decision table (recorded before the run)

- R2 meets the hypothesis (every wrong-row arm ≥ 11 of its unambiguous rows or the stated share;
  `good` ≥ 13/14), R1 does not: ship R2 with the host form.
- Both meet it: ship R1 (no host change) unless R2 is better by ≥ 3 rows on the union of the
  wrong-row arms with both repeats agreeing.
- R1 meets it, R2 does not: ship R1.
- Neither: nothing ships; the measured numbers are the bar for the extraction form.

## What ships on selection

In `doc-verify/modules/design.yaml`: `design-witness-relevant` (error, promotion) over the same
tables, whose `forall` includes the observability atom as a literal, so a row's relevance is
judged only when its witness is observable and a row gives one reason (the observability finding
suppresses the relevance one). Cost: 9–14 questions more per design. If R2 ships,
`core.row_with_column` with tests (empty Property cell, single-row table, a row's own property
marked) lands in the same commit. Real designs' rows the check flags are rewritten after the
verdict and listed in it.

## Builder notes (the decisions a builder would otherwise guess)

- Sets: `probe/oracle-fixtures/witness_relevant/`, `witness_relevant_in_table/`,
  `witness_relevant_paraphrase/`, each with `module.yaml` and `fixtures.yaml`, files from
  `../verification_falsifies/` (the new files generated there: `derangement-s1.md`,
  `derangement-s2.md`, `adjacent-swap.md`, `near-miss-2-3.md`, `shared-1-11.md`,
  `relevance-controls.md`).
- `column-permutation` invariant in the runner: the named column's cells are a permutation of
  HEAD's (multiset equality), every other cell and line equal.
- `core.row_with_column(D, R, C)` renders: the row's cells under `Property` and `C` as
  `Column: text` lines (as `core.cells`), a blank line, `Properties in this table:` and one line
  per row of the table in table order, ` - <property>`, the row's own suffixed ` (this row)`;
  one piece at the row's line; `max_bytes: 6000`. Rows with an empty Property cell are listed as
  ` - (unnamed)`.
- The real derangement fixtures are generated from designs 03 and 05 at HEAD by rotating the
  witness column by 3, under `real-cells/deranged/`, run through the real-cell track with a
  per-document rule as round 8's labels file does.
- Ledgers: `round9-R1`, `round9-R2`, `round9-R1p`, `round9-real`, `round9-real-deranged`; caps
  from the mock projection at 1.5× worst × repeats; all runs `--no-spans`, cache off.

## Predicate

```sh
DOC_VERIFY_MOCK_JUDGE=1 node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_relevant --repeat 2 --no-spans --ledger round9-R1
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_relevant           --repeat 2 --no-spans --ledger round9-R1  --cap <N>
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_relevant_in_table  --repeat 2 --no-spans --ledger round9-R2  --cap <N>
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_relevant_paraphrase            --no-spans --ledger round9-R1p --cap <N>
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels relevance-labels.yaml   --repeat 2 --no-spans --ledger round9-real --cap <N>
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels relevance-deranged.yaml --repeat 2 --no-spans --ledger round9-real-deranged --cap <N>
```

Projection (14 rows × 8 fixtures = 112 main per candidate per repeat; R1 and R2 ×2 = 448; R1'
28; real 30 × 2 = 60; deranged 19 × 2 = 38): about 575 main, no follow-ups.

## Left unmeasured

The extraction form; verification sections written as lists; judge variation; relevance and
observability asked together (the shipped constraint sequences them, so the verdict cannot claim
they compose).

**Pre-run amendment, 2026-10-13 12:50 (lead, after the round's first run refuted R1, R2 and R1'
and before any E1 call): the extraction form is measured in this round as candidate E1,
against the bar the first run set.** E1 (`witness_property_choose(D, R, L)`) is a `choose`
oracle over the same rows: the judge is shown the row's Property and Failure witness cells and
the table's property list (`core.row_with_column`, the R2 rendering) and asked, verbatim: "This
is one row of a design's verification table and the list of every property in that table. Name
the one property in the list whose failure the Failure witness cell describes. Answer with that
property's label exactly as listed; answer `none` if the cell describes no listed property's
failure." Labels: the table's property names in table order (for design/04's fixtures: the
fourteen of `design/04 §Verification design`, shortened to one token each as the set's
`module.yaml` lists them) plus `none`. The row's expected label is its own property on genuine
rows and the source row's property (`from[i]`) on wrong-row rows (ambiguous rows reported,
`neutral` controls expected `none`, decoys expected the pasted witness's source row). A row is
*caught* when the chosen label is not the row's own property (any other label or `none`) at
p ≥ 0.6 on both repeats, and *held* when the chosen label is the row's own at p ≥ 0.6; a
precise catch names the source row. Bars (from `round-9-verdict.md`): caught ≥ 8 of 10
`defective-swapped`, ≥ 11 of 12 and 13 on the derangements, ≥ 4 of 5 decoys, ≥ 11 of 15 on the
real derangement; held ≥ 13 of 14 on `good` and `shared-1-11`, ≥ 28 of 30 real rows. Expected
(recorded before the run): swapped 7–9, derangements 9–11, decoys 3–4, real derangement 10–12;
`good` 13–14; confidence medium-low (a 15-way choose is the first of its size in the
programme). Decision: E1 meets every bar → ships as the relevance check (a host comparison of
the chosen label to the row's property, a `core.cell_text` fact or a structured answer, in the
same commit, round 9c); E1 meets the wrong-row bars but not the held bars → a precision round
on the ask; neither → relevance is left to a differently shaped instrument and the record says
so. Predicate (per-atom, two repeats, cache off): `--fixtures --oracle witness_property_choose
--ledger round9-E1 --cap 336`; `--real-cells --labels relevance-labels-e1.yaml --ledger
round9-E1-real --cap 90`; `--real-cells --labels relevance-deranged-e1.yaml --ledger
round9-E1-real-deranged --cap 57` (the real designs' property lists as their own fixture-local
modules). Projection as the first run: 224 + 60 + 38. Builder decisions taken before the run (12:58): the
head is `witness_property_choose(D, R, C, L)` (the checker binds `C` from the set's
`witness_header` rule; the rendering is R2's); one line follows the verbatim question, a key
from each label to its full property name, because the judge receives label ids; the constraint
exists only to ask the question (caught and held are read from the sidecar); the real designs
02, 03 and 05 get their own fixture-local modules with their tables' names as labels.

**Pre-run amendment, 2026-10-13 13:15 (lead, after E1's run and before any E2 call): E2, the
extraction form with the row's own property hidden.** E1's run (`results/round-9-E1*.txt`) shows
the judge naming the row's *own* Property cell for every wrong-row witness at 0.8–1.0 (the
cell is in the evidence beside the witness, and a 15-way choose echoes it), so E1 measures
echo, not extraction. E2 (`witness_property_blind(D, R, L)`) keeps E1's labels, key line and
expectations but shows the judge only the Failure witness cell (`core.cells(D, R, ['Failure
witness'])`, or the design's witness header) and the property list in the question's key line;
the row's own property is not in the evidence. Question, verbatim: "This is the failure-witness
cell of one row of a design's verification table. The table's properties are listed below as
labels. Name the one property whose failure this cell describes; answer `none` if it describes
no listed property's failure." Same bars, same catch/held reading, same three predicate commands
with ledgers `round9-E2`, `round9-E2-real`, `round9-E2-real-deranged`, same caps (the builder used `core.cell(D, R, C)`, the checker refusing a literal list; the cell text alone is the evidence). Expected
(recorded before the run): wrong-row rows caught 7–10 of 10 and 9–12 of 12/13 (the witness
alone names its property in most rows), `good` held 11–13 of 14 (rows whose witnesses share
vocabulary, 1 and 11, 6 and 7, 12 and 13, may cross), real rows held 25–28 of 30; confidence
medium. Decision as E1's: every bar met → ships (round 9c); wrong-row bars met but held bars
missed → a precision round; neither → the record says relevance is left to a differently shaped
instrument.

## Review

`results/round-9-review.md`, twelve findings, "run after amendments". Taken before the run: 1
(baseline named; the repeat-4c refuting cell), 2 (generic clause dropped; neutral class reported
not counted; R1' arm; R2's sentence made mechanical), 3 (`mixed-one-swapped` replaced by
derangements and the adjacent pair), 4 (per-row labels with `ambiguous`; near-miss case), 5
(R2's false-fail prediction and the `good` ≥ 13 rule), 6 (the decision table; one bar; [0.5,
0.6) classified), 7 (controls as real distant witnesses with a decoy; texts and classes fixed),
8 (labels file shape; the real derangement arm), 9 (suppression rule; cost; the host form in
the same commit), 10 (projection and caps), 11 (builder notes), 12 (the extraction-form bar;
rows 1 and 11 fixture; cache off).
