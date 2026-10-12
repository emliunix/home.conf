# Round 4c verdict — `verification_falsifies` on the cell grain (2026-10-13)

## Predicate

```sh
npm test                                                                                                                   # pass (tables.test.ts covers core.cells)
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable_in_row --repeat 2 --ledger round4c-C2 --cap 500 --show-evidence   # complete: true, 168 + 50
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable --repeat 2 --ledger round4c-C1 --cap 500 --show-evidence          # complete: true, 168 + 48
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable_paraphrase --ledger round4c-Cp --cap 90                           # complete: true, 28 + 9
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels witness-labels.yaml --ledger round4c-real --cap 90                                 # complete: true, 30 + 2
```

Run once live after the mock cost runs; every track `complete: true`, every fixture's
evidence-column invariant `ok`, every fixture PASS under draft with a refusing judge. 394 main
questions and 109 follow-ups in all. Outputs: `results/round-4c-{C1,C2,Cp,real-cells}-live.txt`.

## What measured

| Fixture | C1 (cell, headed) | C2 (cell with its property) | C2' (paraphrase) |
| --- | --- | --- | --- |
| `good` | 14/14 holds | 14/14 holds | — |
| `defective-gross` | 10/14 fails at ≥ 0.6 (rows 1, 2, 7 `fails` at 0.52–0.59; row 13 `holds` 0.60); NO-GO | 13/14 (row 13 `holds` 0.51, flips on repeat); NO-GO | — |
| `defective-subtle` | 14/14; NO-GO | 14/14; NO-GO | — |
| `defective-subtle3` | 13/14 (row 12 `holds` 0.50); NO-GO | 14/14; NO-GO | — |
| `controls` | 13/14 (row 1 `holds` 0.90); NO-GO | 13/14 (row 1 `holds` 0.80); NO-GO | 13/14 (row 1 `holds` 0.83); NO-GO |
| `defective-swapped` | 14/14 holds (as predicted: cannot see the property); PASS | **0/14 fails: 14/14 holds at 0.64–0.99**; PASS | 0/14; NO-GO (verdict from the controls run's state, not from this fixture) |

Stability: C1 0 flips in 84 atoms; C2 1 flip (gross row 13, at the threshold). Real cells, C2
against the lead's blind labels: 28/30 agree; design/02 row 11 and design/05 row 2 `holds` where
the lead had `fails` at low confidence; design/03 row 9 and design/05 row 1 `fails` as predicted,
so **design/03 and design/05 are NO-GO** under the shipped check until their cells are rewritten.

## Expectations the run contradicted

- **The property-context claim is refuted.** C2 was predicted to fail at least 11 of 14 genuine
  witnesses attached to the wrong property; it fails none, at 0.64–0.99, and the paraphrase that
  asks in plainer words ("describes the failure of a different property") fails none either. The
  judge reads "is this an observable failure condition" and does not check what it is a failure
  of. Row context raises margins (gross 13/14 against 10/14) but buys no relevance check. The
  wrong-row gap round 4 recorded for evidence cells holds here too, with the property present.
- **The strict hypothesis is refuted**, by two cells under the best candidate: gross row 13 (the
  restated "Migrated-constraint separation" witness, `holds` 0.51 and `fails` on the repeat) and
  controls row 1 ("Answers are not bound to the atoms they were asked for", `holds` 0.80–0.90
  under all three questions). The lead reads the second as a control defect after the fact: an
  answer attached to the wrong atom is observable, and the cell is one clause from the genuine
  row-1 witness. It is recorded as a wrong-side control, not relabelled; the two other
  tautological negations (rows 4, 9) and both padded, both verified-asserting and both pointer
  controls failed as predicted, so the "style detector" reading does not hold for any class
  except that one cell.
- **C1 was expected close to C2 on restatements**; it is not: four gross cells and one subtle
  cell sit in [0.5, 0.6) or across the line under C1 where C2 is ≥ 0.78 on all but row 13.
- The two low-confidence real-cell labels were wrong, both in the judge's lenient direction:
  "Root configuration … fail their selected rules" and "the kernel fails a gate … on a seeded
  witness" read as observable to the judge.

## Which candidate it selects, and the deviation from the pre-registered rule

The rule said: C2 if it meets the hypothesis and ≥ 11/14 swapped; else C1 if it meets the
hypothesis; else nothing ships. Neither meets the strict hypothesis, so the rule says nothing
ships and the extraction form is next. **The verdict ships C2 anyway**, and says why: "nothing
ships" leaves in force the section-level ask round 3 measured as passing both seeded defects at
≥ 0.97, which is still declared at error severity in `doc-verify/modules/design.yaml`. C2 gets
every document verdict right on all six fixtures (PASS on `good`, NO-GO on every defective and
control fixture), separates 55 of 56 restated or control cells that the lead stands behind, is
stable on repeat, and agrees with 28 of 30 blind labels on real documents. Its two misses are one
cell at the threshold and one cell the lead misjudged. C1 is not shipped: its margins on
restatements are at the line. The deviation is a decision row, not a quiet correction.

What C2 does not do, recorded on the oracle and in design 05: it does not check that the witness
belongs to its row's property. That needs the extraction form (list the property, the witness's
observable, and whether the second is a failure of the first) or a separate relevance question;
either is the next candidate for this oracle, not this round's.

## Changes this verdict makes

1. `doc-verify/modules/design.yaml`: `verification_falsifies` and its constraint removed;
   `witness_observable_in_row(D, R, L)` and `design-witness-observable` (error, promotion) per
   row of every verification table headed `Failure witness` or `Observable failure witness`;
   `design-has-witness-table` (warning) for a verification section with no such table. Cost per
   design: 9–14 questions where one was asked.
2. The engine's `core.cells(D, R, L)` evidence form (round 4c's one addition) stays.
3. After the verdict, the two real cells the check fails are rewritten as observables:
   design/05 "Feasibility (round 1)" and design/03 "Current artifacts pass". Both designs then
   pass at promotion. design/02 row 11 and design/05 row 2 are left as the judge read them.
4. Design 05 §Oracle toolkit, the gate ledger (item 3 closed; a round 4c gate added) and the
   decision rows updated; constitution R5's note on `verification_falsifies` amended citing this
   round.
5. The round 3 fixture set `probe/oracle-fixtures/verification_falsifies/` keeps its
   `fixtures.yaml` for the withdrawn oracle as the record of round 3; its Markdown files are the
   shared files of the round 4c sets.

## Left unmeasured

Relevance of a witness to its property (the extraction form); verification sections written as
lists; judge variation; whether a witness is true of the command beside it; the Command column.

## Files

`round-4c-preregistration.md` (amended, ten review items taken), `results/round-4c-review.md`,
`results/round-4c-{C1,C2,Cp,real-cells}-live.txt`, `probe/oracle-fixtures/witness_observable*/`,
`probe/oracle-fixtures/verification_falsifies/{controls,defective-swapped,defective-subtle3}.md`,
`probe/oracle-fixtures/real-cells/witness-labels.yaml`, `probe/oracle-test.mjs` (`--labels`).
