# Round 9 plan: independent review (verbatim)

The independent seat (a sonnet subagent) read `round-9-preregistration.md` as first written on
2026-10-13, round 4c's plan, verdict and review, round 4's verdict, the shipped design module, the
evidence forms and the reused fixtures. It ran nothing and edited nothing. Its review follows
unedited; the plan's `## Review` section records how each finding was taken.

---

# Round 9 plan: independent review

I read the plan, the 4c preregistration, verdict and review, the 4-verdict contradiction section, `design.yaml`, `cellsEvidence`/`columnEvidence`, the `good`, `defective-swapped` and `controls` fixtures, the 4c fixture/module/label files, and the skill. I ran nothing and edited nothing.

The idea is sound: a relevance-only question is the cheapest remaining test, and round 4c's 0/14 does not rule it out, because the observability task was in the same question. Findings are ordered by threat to the verdict.

## 1. The plan has no baseline arm, and R1 is nearly a repeat of an arm that already failed
**Wrong.** Round 4c's C2 already put `Property:` and `Failure witness:` in the evidence and told the judge "the witness must be a failure of this row's property". C2' did the same in plainer words ("describes the failure of a different property"). Both gave 0/14 fails on swapped. R1 is C2 minus the observability criteria, and R2 is R1 plus a property list. The plan never names C2 as the comparison, so a pass would not show why it passed. The cause could be the dropped observability task, a stronger framing, or the list.

**Why it matters.** Neither the verdict nor the next-step decision could say which change did the work.

**Amendment.**
- State in the plan that 4c C2 and C2' (0/14 on swapped, 14/14 `holds` at 0.64-0.99) are the baseline. Re-run the shipped `witness_observable_in_row` on the new fixtures only if they contain pairs not already measured.
- Add a refuting statement: "R1 at or below 3/14 `fails` on swapped repeats 4c; the question wording alone buys nothing".
- Record what the plan expects to differ from 4c (dropped task, dropped criteria) so the contrast is interpretable.

## 2. The axis is not clean, and R1's question re-imports observability
**Wrong.**
- R2 adds one sentence plus the list. That co-variance is acceptable only if it is called "list plus the sentence that tells the judge to use it". Say so, because a win cannot separate them.
- R1's question says "Fail if ... so generic that it would count as a failure of any property". That is a vagueness or observability criterion, which the question also says not to judge ("Do not judge whether the cell is observable"). The two instructions pull against each other.
- The generic controls ("the check fails", "a test is red", "the output is wrong") fail on observability or vagueness, not relevance. A `fails` there says nothing about relevance. A `holds` there could be read as the judge honouring "do not judge observability".

**Why it matters.** The generic-5 expectation (≥4 / 5 `fails`) cannot discriminate relevance from the style detection that round 4c already struggled with.

**Amendment.**
- Either drop the "generic" clause from R1 and R2 and treat generic controls as a separate, labelled class ("relevance-neutral"). Or keep it and rename it "fits any property" in the hypothesis, and move the generic controls out of the relevance pass criteria.
- Add a paraphrase arm R1' (as 4c's Cp) on `defective-swapped` and `controls`, so one wording cannot decide the verdict.
- Fix R2's sentence to be mechanical: "The properties of the same table are listed after the row; the cell must fail this property and not another listed one."

## 3. Per-atom requests make `mixed-one-swapped` redundant for the judge
**Wrong.**
- Under per-atom, each row is judged on its own. R1 sees two cells.
- R2 sees two cells plus a Property list that is identical in every fixture, because the Property column is fixed.
- So a row's label depends only on its (Property, witness) pair. The "single swapped row in an otherwise good table" claim tests the document aggregation (any `fails` makes the document NO-GO), which is deterministic. It does not test the judge.
- Rows 4 and 9 are also the easy pair: static-check vocabulary against diagnostics vocabulary, far apart.

**Why it matters.** The fixture costs about 28 calls and adds almost no information.

**Amendment.**
- Drop the "catches a single swapped row" clause from the hypothesis, or keep it as a free check done by aggregation arithmetic.
- Replace `mixed-one-swapped` with extra wrong pairs that vary distance. Use a seeded random derangement (and a second one), plus an adjacent-neighbour pair: rows 6 and 7, or 13 and 14.
- Pre-register the seeds and add a `row-permutation` invariant for each.

## 4. The swapped fixture is mostly the easy case, and the expected labels are over-confident
**Wrong.** The one-row shift pairs each property with its neighbour's witness. Some neighbours are near-related:
- **Row 7, Requests shaped**, receives row 6's witness, which includes "a depth-1 batched program makes more than 1 round, or a single atom's evidence is split across requests". That is nearly a request-shape failure.
- **Row 1, Binding**, receives row 14's, which includes "a split atom's evidence". That is arguably a binding failure.
- **Row 13, Migrated-constraint separation**, receives row 12's migration-parity verdict-difference witness. Close in vocabulary.
- **Row 5, Modules compose**, receives row 4's, which includes "oracle deeper than `rounds`".

The table says "none expected" near-matches. Several are plausible `holds`, so ≥11/14 is a fair threshold. But the claim is unlabelled, and the lead's "per-row reading in `fixtures.yaml`" is not yet written.

**Why it matters.**
- Without per-row labels, a miss at row 7 or row 1 cannot be separated from a judge error.
- A hard case does exist in the good rows: rows 4, 6, 7 and 14 carry another property's vocabulary in their own witness. See finding 5.

**Amendment.**
- Before the run, write per-row `fails`/`holds`/`ambiguous` labels for every fixture cell, with confidence. Count only unambiguous rows toward the 11/14 line.
- Add the derangements from finding 3. Three arms (shift-1, random, adjacent pair) let the report show that adjacency, not relevance, drives any misses.
- Add one deliberate near-miss case: row 2's witness on row 3, a related threshold/soundness pair.

## 5. R2 is more likely than R1 to false-fail genuine multi-property witnesses
**Wrong.** The expected table gives R2 14/14 on `good`, which is the optimistic direction. Several genuine witnesses are bundles that name other table properties. Row 4's lists "oracle deeper than `rounds`", which is Rounds bounded. Row 6 mentions "evidence is split across requests". Row 7 includes "unknown `request_shape` loads". Row 14 bundles five failures. Given the full property list, R2 can see a better-matching property and fail the row.

**Why it matters.** The cost of R2 is false fails on correct rows. The selection rule weighs only the swapped gain.

**Amendment.**
- Predict `good` for R2 as 12-14/14, with rows 4, 6, 7 and 14 named as likely flips. Do the same for R1 (rows 1 and 11 shared clause, plus these).
- Add a rule: "R2 is selected only if `good` ≥ 13/14 `holds`".
- Report per-row p on these four rows, not just k/14.

## 6. The selection rule has a hole, and "at least 2 rows" is inside noise
**Wrong.**
- If R1 misses the hypothesis (for example 10/14) and R2 meets it with fewer than 2 rows of lead, the rule falls through to "otherwise R1 if it meets the hypothesis", then "nothing ships". R2, which met the hypothesis, is dropped.
- A 2/14 difference is within repeat noise (4c saw one at-threshold flip per 84 atoms) and within a single-run sign test. It is also one run on one fixture.
- The hypothesis states 13/14 on each fixture. The refuting cells state 11/14 swapped and "more than 2 of 14 good". 13/14 and ≤2 false fails on `good` are different bars; 11/14 on swapped is a different bar from 13. The labels in [0.5, 0.6) are not classified (4c stated they do not separate).

**Amendment.**
- Rewrite as a decision table:
  - R2 meets the hypothesis, R1 does not: ship R2.
  - Both meet it: ship R1 unless R2 is better by ≥ 3 rows on the union of the swapped, derangement and adjacent arms, both repeats agreeing. R1 needs no host change, so it is the default.
  - Neither: nothing ships.
- Use one bar, ≥ 11 of 14 `fails` on swapped and ≤ 1 false fail on `good` (stated). Count labels in [0.5, 0.6) and `unknown` as not separating, reported separately.

## 7. The "other-property vocabulary" controls are ill-posed
**Wrong.** "Under batched, an unsafe variable is accepted" on the Rounds-bounded row is a hybrid of Requests-shaped vocabulary and Static-checks content. "Under batched" is arguably about rounds and requests, so `holds` is defensible. The ground truth is the lead's reading, set by the lead who wrote the cell. The plan also does not say which rows get which class, what the 4 genuine rows are, or the exact texts.

**Amendment.**
- Make the "other-property" control a real witness from a distant property pasted under a row. Do not hybridise.
- Optionally pair it with a decoy word from the row's own property in a non-failure role. Then the class is "mentions row's vocabulary, wrong failure".
- Write all 14 control cell texts and the row-to-class map into `fixtures.yaml` before the run.
- Pre-register that a hybrid cell cannot count in the hypothesis. If hybrids are kept, put them in a separate "ambiguous" class.

## 8. Real-design labels measure only false positives, and the shape is unspecified
**Wrong.** In designs 02, 03 and 05 every witness is on its own row by construction. The lead's blind labels will be mostly `holds`, so the real-design arm can only show over-strictness ("more than 3 flagged" is the only refuting cell). It tells nothing about detecting real wrong-row defects on realistic vocabulary. The lead also labelled these cells in 4c, so "blind" is weak.

The labels file shape is not stated. 4c's `witness-labels.yaml` uses `documents:` / `<section>#rowN: { label, confidence, why }`; a builder must guess whether to reuse it.

**Amendment.**
- State that `relevance-labels.yaml` uses 4c's shape: `oracle: witness_relevant_in_table`, per-document `column`, `rows: <section>#rowN: { label, confidence, why }`. Label every row of designs 02, 03 and 05, plus a `shares_with:` note on rows whose witness mentions a neighbouring property.
- Have the lead write labels before the run, commit them, and record agreement as in 4c.
- Add a derangement arm on designs 03 and 05 (witness column rotated by a fixed seed), so the real-design track has a positive class on real vocabulary. A fixture-only result would leave this unmeasured.

## 9. What ships needs three specifics
**Missing.**
- **Two findings per row.** `design-witness-observable` and `design-witness-relevant` over the same rows give up to two findings per row. A row with a restated witness will also be judged for relevance and may flag both, and a vacuous witness text can look "relevant" or "irrelevant" arbitrarily. State whether the relevance finding is suppressed when the observability finding fires (sequence it: `not` observable first) or both are reported. I would suppress it, so a row gives one reason.
- **Cost.** Observability costs 9-14 questions per design today, and relevance doubles that. Add the projection.
- **The host form is conditional, and the rendering is open.** `core.row_with_column` ships only on R2. Its exact output, which the judge-visible text depends on, must be fixed before the run (finding 11).

**Amendment.**
- Choose and state the interaction rule.
- Add the cost line to the plan (finding 10).
- Make the ship conditional explicit in the decision table: "if R2 selected, `core.row_with_column` plus tests (including empty Property cell, single-row table) land in the same commit".

## 10. Cost and caps are blanks
**Wrong.** `--cap <1.5× worst>` is unfilled on three of the four commands, and no projection is given. 4c printed exact projections.

Rough size for the plan as written: 14 rows × 4 fixtures = 56 main questions per candidate, 112 with `--repeat 2`. Follow-ups are on top. The real-cells track is about 30 more. With the amendments (derangements, paraphrase arm, real derangements) it is roughly 250-300 per candidate worst case.

**Amendment.**
- Print the mock projection (main plus worst-case follow-ups per track) in the plan.
- Give each track its own cap and `complete` flag. The predicate already has four commands; add one for the paraphrase and derangement tracks, each with a number.

## 11. Things a builder would have to guess
- **Fixture layout.** The plan says `probe/oracle-fixtures/witness_relevant/` via `files_from`, but `witness_relevant_in_table` is a separate `--oracle`. Does it get its own directory (4c used `witness_observable` and `witness_observable_in_row` as separate dirs, each with `module.yaml` and `fixtures.yaml`)? Say so, and say the set shares `../verification_falsifies`.
- **The row-permutation invariant.** The existing check is "restricted to the witness column"? The plan says so for `mixed-one-swapped`, but the runner implements `row-permutation` for the `reversed` arm of whole rows. Confirm it can check a column-only permutation or specify the extension.
- **`core.row_with_column(D, R, C)` rendering.** Not specified: the header format of the row cells (as `core.cells`: `Column: text`?), whether the row's own property is marked, the order of the list (table order), duplicates, empty cells, and the `Properties in this table:` format (comma list, one per line, numbered?). It must be fixed, because the judge sees it. Also which cell is the witness cell, since the evidence takes only column `C` as a parameter. State the evidence `pieces` / line mapping and the max-bytes budget (the 4000 cap is likely enough but say it).
- **Labels and thresholds.** The oracle threshold is 0.5 with separation line 0.6, as 4c; copy that stated rule.
- **The `controls` row map and the `witness_relevant` ledger names** (see finding 7).

**Amendment.** Add a "Builder notes" paragraph to the plan with these decisions made.

## 12. Other points
- **Pre-register the extraction-form bar.** The plan says the extraction form is next on failure. State that "nothing ships" means the measured R1/R2 numbers are the bar the extraction form must beat.
- **Interaction left unmeasured.** The plan lists relevance and observability interaction as unmeasured, which is fair. State that the shipped finding does not check both together, so a verdict cannot claim they compose.
- **Rows 1 and 11.** The shared clause is the one place the "wrong row" label is itself arguable. Add a fixture cell that puts row 11's witness on row 1 and row 1's on row 11, pre-labelled `holds` (a shared clause) so the relevance judge is not penalised for a legitimate overlap.
- **Cache.** Say the cache is off for the repeat arm (the predicate already has `--repeat 2`; confirm `--no-cache` is implied or add it).

**Run after amendments** (blocking: 1, 3, 4, 6, 8, 10 and 11; do findings 2, 5, 7 and 9 in the same revision).
