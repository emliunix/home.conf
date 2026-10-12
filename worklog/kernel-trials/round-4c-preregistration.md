# Round 4c — `verification_falsifies` on the cell grain

Written 2026-10-13 before any live call; amended the same day after the independent review
(`results/round-4c-review.md`, verbatim) and before the run. Round 3 withdrew
`verification_falsifies` as declared (one yes/no over a whole verification section): both seeded
defects passed at p ≥ 0.97. Round 4 showed the cell grain separates seeded evidence cells and
added the table facts. This round re-authors the oracle as a **classification per table cell**
(not the extraction form design 05 names; that remains the next candidate if this one fails),
measured on round 3's fixtures plus the controls the review demanded, and ships it in
`doc-verify/modules/design.yaml` if it separates. Owner direction of 2026-10-13: evaluate and
decide the experiments autonomously.

## Hypothesis

At least one candidate labels every restated, negated, padded, verified-asserting or
command-pointer cell `fails` at p ≥ 0.6 and at most 2 of the 14 genuine witness cells `fails`.
**Refuting cell:** no candidate meets both. Labels in [0.5, 0.6) and `unknown` are *not
separating* (reported by shape, not a false pass). A second claim rides on the first: the
property in the row's evidence (C2) is what lets the judge reject a genuine witness attached to
the wrong property. **Refuting cell:** C2 labels fewer than 11 of 14 swapped cells `fails`.

## Axis

Row context at the cell grain. C1 and C2 ask over the same row with the same evidence form
(`core.cells`), the same `Failure witness:` line prefix and the same criteria; C2 adds exactly one
line of evidence (`Property: …`) and exactly one sentence of question (the witness must be a
failure of this row's property). Nothing else differs. `core.cells(D, R, L)` is the one engine
addition: a row's named cells as one evidence atom, each line headed by its column.

## Candidates and their questions, verbatim

**C1** (`witness_observable(D, R, L)`, evidence `core.cells(D, R, ['Failure witness'])`,
threshold 0.5, labels `holds` / `fails`):

> This is the failure-witness cell of one row of a design's verification table; the row's
> property is named elsewhere. The cell holds only if it names an observable condition:
> something a test, a command or a measurement would show, stated as what would be seen if the
> claim it witnesses were false. It fails if it only restates or negates that claim in other
> words, asserts that the claim holds or is verified, names only that a check, test or command
> exists, passes or fails without saying what would be seen, or is too vague to observe. A cell
> may cite another document, a round or an item by name; that alone neither helps nor hurts.

**C2** (`witness_observable_in_row(D, R, L)`, evidence `core.cells(D, R, ['Property', C])`): the
C1 text with its first sentence replaced by "This is one row of a design's verification table:
the property and its failure-witness cell." and one sentence appended: "The witness must be a
failure of this row's property; an observable failure of some other property fails."

**C2'** (`witness_observable_paraphrase`), the wording control, a paraphrase of C2 run only on
`controls` and `defective-swapped`:

> Read one row of a design's verification table: a property and the cell that is supposed to say
> how its failure would show. Say holds only when the cell describes a concrete thing a test,
> command or measurement would observe when this property is broken. Say fails when the cell
> merely repeats or denies the property, declares it verified, points at a test or command
> without saying what it would show, is too vague to check, or describes the failure of a
> different property. Mentions of other documents or rounds are neutral.

The ruling "a bare command failure is a pointer" is now in the questions, not beside them.

## Fixtures (`probe/oracle-fixtures/verification_falsifies/`, reused by the candidate sets)

Every fixture is design/04 at HEAD with only the Failure witness column changed; the runner's
`invariant: evidence-column-only` check verifies that before any call. Rows are design/04's 14
properties in order (row1 "Binding by construction" … row14 "Trust boundary holds").

| Fixture | Cells | Expected (C1 / C2) |
| --- | --- | --- |
| `good` | HEAD's 14 witnesses | 14/14 `holds` both; rows 10, 12, 13 wordy but genuine; row 11 repeats row 1's first clause and is genuine for nested classification too |
| `defective-gross` | all 14 restated (round 3) | 14/14 `fails` both |
| `defective-subtle` | row 1 restated (round 3) | row 1 `fails`, 13 `holds`, both |
| `defective-subtle3` | rows 1, 8, 12 restated | those `fails`, 11 `holds`, both |
| `controls` | style controls, per row below | as listed, both |
| `defective-swapped` | every witness moved to the next row | C1 14/14 `holds` (cannot see the property); C2 ≥ 11/14 `fails` |

`controls`, per row: 1 tautological negation ("Answers are not bound to the atoms they were asked
for") `fails`; 2 short genuine ("A 0.4 answer at threshold 0.5 is labelled `fails`") `holds`;
3 confident pass assertion `fails`; 4 tautological negation ("The static checks are not correct")
`fails`; 5 short genuine ("Two libraries defining `problem` collide") `holds`; 6 padded
restatement, 50 words, no observable `fails`; 7 command pointer ("`npm test -- request-shape`
fails") `fails`; 8 genuine without failure words ("A child module with a raised threshold loads
with no `waive:` line") `holds`; 9 tautological negation ("Diagnostics are incomplete") `fails`;
10 genuine, command-dependent ("the seeded case yields 0 findings where 1 is expected") `holds`;
11 command pointer ("the gate fails") `fails`; 12 padded restatement `fails`; 13 short genuine
("A known-bad document passes") `holds`; 14 confident pass assertion `fails`. A control cell on
the wrong side at p ≥ 0.6 under both candidates refutes the claim that the oracle detects
witnesses rather than style; which class fails says which style it keys on.

No fixture is replaced after the run. design/04 and design/05 are edited only after the verdict.

## Real cells (blind labels, `probe/oracle-fixtures/real-cells/witness-labels.yaml`)

Every witness cell of design/02 (11, header "Observable failure witness"), design/03 (9) and
design/05 (10), labelled by the lead before the run under the C2 question; run through C2 by
`--real-cells --labels witness-labels.yaml`. Expected agreement ≥ 26/30; design/05 rows 1 and 2
("any of K1–K4 fails", "the kernel fails a gate …") are labelled `fails` under the pointer
ruling, so **design/05 is expected NO-GO on shipping** and its two cells are rewritten as
observables after the verdict, the way goals/04 was in round 4. design/01 has no verification
section.

## Measurements

- Per cell: label, p, separation at 0.6, k/14 per fixture, document verdict; false pass first.
- Cross-candidate: per-fixture verdict equality; the controls and swapped rows where C1 and C2
  differ; minimum margin on restated cells.
- Stability: C1 and C2 run twice per fixture with the cache off (`--repeat 2`); label flips.
- Wording: C2' on `controls` and `defective-swapped`; cells that flip against C2.
- Real cells: agreement with the blind labels.
- Engine gate: `npm test` (tables.test.ts covers `core.cells`: rendering, a missing column
  dropped, no non-empty cell yields no atom). An empty witness cell is a structural violation of
  the shipped constraint without a judge call (the `require: core.cell(...)` literal fails; the
  goal check's test covers that shape); a header with zero rows binds nothing and is reported by
  a separate structural warning in the shipped module.
- Cost, from the mock projection: C1 and C2 84 main questions per pass, 168 worst case; with
  `--repeat 2`, 336 worst case per candidate; C2' 28 main, 56 worst; real cells 30 main, 60
  worst. Caps 1.5× worst, one ledger per track.

## Selection rule (recorded before the run)

C2 is selected if it meets the hypothesis and labels ≥ 11/14 swapped cells `fails`; otherwise
C1 if it meets the hypothesis; otherwise nothing ships and the extraction form is next. Ties on
the hypothesis go to the candidate with the higher minimum margin on restated and control cells.

## What ships on selection

In `doc-verify/modules/design.yaml`, replacing `verification_falsifies`: the selected oracle,
asked per row of every table under `## Verification design` whose header has `Failure witness`
or `Observable failure witness`, at error severity on promotion; a verification section with no
such table gets a structural **warning** ("no table with a failure-witness column; no per-row
check ran"), never the section-level ask round 3 measured as useless. Cost per design: 9–14
questions where one was asked. `core.cells` stays in the engine whichever candidate ships.

## Predicate

```sh
npm test
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable --repeat 2 --ledger round4c-C1 --cap 500 --show-evidence
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable_in_row --repeat 2 --ledger round4c-C2 --cap 500 --show-evidence
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable_paraphrase --ledger round4c-Cp --cap 90
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels witness-labels.yaml --ledger round4c-real --cap 90
```

Each prints `complete: true|false` for its track.

## Left unmeasured

Verification sections written as lists (the engine library's `falsifies` over list items);
judge variation; whether a witness is true of the command beside it (the verdict claims only
that the cell reads as an observable); the Command column, excluded from both candidates (one
control cell, row 10, is command-dependent); the extraction form; whether C2's advantage, if
any, is the property text or the row binding.

## Review

`results/round-4c-review.md`, ten findings, "run after amendments". Taken before the run:

1. `controls` (14 cells over five style classes) and `defective-subtle3` added; the refuting
   reading for a style detector recorded.
2. `defective-swapped` added as the axis test; C1 given the same `Failure witness:` prefix via
   `core.cells`; C2 = C1 plus one evidence line and one sentence; the selection rule rewritten.
3. Hypothesis restated as a conjunction with one refuting cell; [0.5, 0.6) and `unknown`
   classified.
4. Blind labels for design/02, 03 and 05 committed; `--repeat 2` on both candidates; C2'
   paraphrase; shipped severity and profile stated.
5. The pointer ruling moved into the questions; three pointer-class control cells; design/05
   rows 1–2 pre-registered `fails` and its NO-GO stated.
6. Both questions revised and quoted; the negation and cross-reference sentences added.
7. Section fallback dropped for a structural warning; both header spellings matched by rule;
   empty-cell and zero-row cases stated; `core.cells` kept.
8. Costs from the mock projection, caps per track.
9. Command column named as a known limit with one control; chain truth bounded in the claim.
10. "Classification per cell, not extraction" stated in the preamble.
