# Round 4 verdict — the evidence-cell grain (2026-10-13)

## Predicate

```sh
npm test                                                                      # 259 tests, 28 files, pass
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_reasons --repeat 2 --ledger round4-B --cap 400 --show-evidence   # complete: true, 132 + 54
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_column_reason --ledger round4-A2 --cap 40                          # complete: true, 11 + 5
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_cells_reason --ledger round4-A --cap 40                            # complete: true, 11 + 7
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_reasons_paraphrase --ledger round4-Bp --cap 30                     # complete: true, 10 + 5
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --ledger round4-real --cap 70                                                       # complete: true, 24 + 18
```

Run once live by the lead after the mock cost runs; every track `complete: true`, every fixture
`invariant: ok` and PASS under draft with a refusing judge; 188 main questions and 89 span
follow-ups in all. The outputs are `results/round-4-*-live.txt`.

## What measured

**B, the cell grain** (`evidence_reasons`, shipped in `doc-verify:goal`): 55 of 55 cells on their
expected side at p ≥ 0.6 across eleven fixtures; no defective or mixed fixture PASSes; every label
identical on the second run with the cache off (55/55). The lowest margin is the terse row2 at
`fails` 0.62; every other cell is ≥ 0.78 and most are ≥ 0.98. `good-nopath` holds 5/5 (0.98–1.00):
prose with no path is accepted. `good-dangling` holds 5/5 and draws exactly one `paths-resolve`
warning: the two checks are independent, as the owner asked. `defective-wrongrow` holds 5/5: the
known gap (the judge never sees the requirement's text) is real and measured.

**A2, the column grain** (one question over the five cells, one per line): separates every
uniform fixture (good 0.85–0.86, defective 0.83–1.00) and **false-passes both mixed tables**:
`mixed-one-bare` holds 0.51, `mixed-one-pointer` holds 0.83.

**A, the section grain** (one question over the whole table, Design column and all): separates
every fixture including both mixed ones (`fails` 0.97 and 0.80); its narrowest margin is the
restatement fixture at `fails` 0.65, where B is ≥ 0.98.

**B', the paraphrase**: 9 of 10 labels agree with B. The one that moves is the terse row2 ("gates
pass, seeded defects flip them"), B `fails` 0.62, B' `holds` 0.50: the cell the lead called
borderline is wording-sensitive, and nothing else is.

**Real cells** (blind labels, `probe/oracle-fixtures/real-cells/labels.yaml`): goals/02–03's
thirteen `Evidence required` cells are `fails` 13/13 at 0.75–0.99, agreeing with the lead;
goals/01's six `Evidence` cells agree on 3 of 6, the judge failing rows 2, 3 and 6 at 0.55–0.66
where the lead had `holds` at low or medium confidence. Every disagreement sits within 0.16 of
the threshold; every agreement on a planned-evidence cell sits far from it.

## Expectations the run contradicted

- **The terse cells are not the passing fixture.** The lead predicted row2 `holds`; it `fails` at
  0.62 (the fixture author predicted `fails`). goals/04 at HEAD is therefore NO-GO under the
  shipped check, and its cells are rewritten after this verdict (below), not before the run.
- **A was predicted to false-pass `defective-pointers` and both mixed tables.** It separates all
  three. The Design column's paths did not read as evidence; shown the whole table with its row
  ids, the judge finds one bad cell among four. The column-only form A2, which the review asked
  for to isolate grain, is the one that misses it. So the axis the mixed fixtures turned on is
  **grain plus context**, not grain alone: A2 lacks the row ids and the surrounding structure that
  let a single-question judge locate the bad cell.
- **goals/02–03 were predicted to read as evidence** (`holds` on ≥ 7/13). The judge says `fails`
  on all 13: it tells planned checks from taken evidence more sharply than the lead expected.
- **goals/01 agreement was predicted ≥ 4/6**; it is 3/6, all three disagreements near the
  threshold, all three cells of the "fact stated, conclusion implicit" kind. This is a calibration
  finding about middling cells, not about gross ones.

## Which candidate it selects

**B, the cell grain, ships** in `doc-verify:goal` as `goal-evidence-reasons` at error severity on
promotion, as the owner asked. It is the only candidate that puts the finding on the row (line,
message, repair per cell), it has the widest margins on every defect class including the
restatement class that beat round 3's section-level ask, and it is stable. Its cost is five
questions per goal where A costs one; on this corpus that is 6 to 7 questions per goal file, which
is less than a reader spends on the table.

A is the honest second: one question, every document verdict equal to B's on these eleven
fixtures, narrower margins. It is the shape to prefer where cost dominates and the finding need
not name the row. A2 is rejected: a column of cells without their row context does not let the
judge find one bad cell.

The hypothesis's refuting cell (iii) (A2's verdicts equal to B's on every fixture) did not fire;
cells (i) and (ii) did not fire. The hypothesis stands as stated, with the amendment that the
section form with context is as good at the document level on this set.

## Changes this verdict makes

1. `doc-verify:goal` gains `evidence_reasons(D, R, C)` and `goal-evidence-reasons` over every
   table with an `Evidence` header under `## AC coverage`, `## AC coverage matrix` or
   `## Acceptance evidence` (goals/01's shape). A column headed `Evidence required` is a plan and
   is not judged.
2. The host gains table facts (`core.table/3`, `core.header/3`, `core.row/3`, `core.cell/3`) and
   the evidence forms `core.cell(D, R, C)` and `core.column(D, T, C)`, tested in
   `doc-verify/tests/language/tables.test.ts`; README "Table facts" documents them. These are the
   facts the planned extraction form of `verification_falsifies` needs (round 4b).
3. goals/04's five evidence cells are replaced by the `good.md` chains (true, path-keeping,
   verified by the fixture author against the verdict files): the one edit to goals/04 this round
   makes, after the verdict.
4. `skills/goal-file/goal-authoring.md` records the owner's ruling on evidence cells.
5. **goals/01 (CLOSED-GREEN) failed the check on five of its eight acceptance-evidence cells**
   (rows 2, 3, 4, 6 and A7, at 0.51–0.66). The lead first shipped the check as a warning on
   closed goals; the owner ruled the same day that a closed goal's text may be refined and the
   check is an error everywhere. goals/01's cells are rewritten as chains grounded in the
   repository (the landing commit's file list, the shared skill's files and the five skills that
   cite it, design/02 §Shared verification practices, worklog/02 §C9 and §C10, the test suites),
   and goals/01 passes at promotion. The judge's labels before the rewrite are in
   `results/round-4-real-cells-live.txt`. (The blind labels covered the six R rows; the table has
   A7 and A8 as well.)
6. A diagnostics defect found by the staged check and fixed before the commit: with several
   atoms on one section (one per row), every row's finding quoted the first failing row's span and
   probability. `bindingFinding` now picks the leaf whose atom names the binding's values and puts
   a row finding at its row's line; `tables.test.ts` covers it.

## Left unmeasured

Judge variation; the extraction form (round 4b); the union of requirement text and cell, which
would close the wrong-row gap; chain truth; the threshold for middling cells (the goals/01 band at
0.55–0.66 says 0.5 is where real cells of mixed quality land, and a second fixture set drawn from
real goals, not seeded, would be the way to set it); whether A's advantage over A2 is the row ids
or the Design column (one more candidate, column plus row ids, would tell).

## Files

`round-4-preregistration.md` (with the review's fourteen items taken), `results/round-4-review.md`,
`results/round-4-{B,A2,A,Bp,real-cells}-live.txt`, `probe/oracle-fixtures/evidence_reasons/`,
`probe/oracle-fixtures/{evidence_column_reason,evidence_cells_reason,evidence_reasons_paraphrase,real-cells}/`,
`probe/oracle-test.mjs` (per-row atoms, `files_from`, `extra_files`, the column invariant,
`--repeat`, `--ledger`, `--show-evidence`, `--real-cells`).
