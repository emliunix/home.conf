# Round 4c plan: independent review (verbatim)

The independent seat (a sonnet subagent) read `round-4c-preregistration.md` as first written on
2026-10-13, the round 3 and round 4 verdicts, the round 4 review, the reused fixtures and the
home design module. It ran nothing and edited nothing. Its review follows unedited; the plan's
`## Review` section records how each finding was taken.

---

# Round 4c plan: independent review (step 4 of experiment-round)

I read the 4c plan, round 3's and round 4's verdicts, the round 4 review, the three fixtures and `fixtures.yaml`, `doc-verify/modules/design.yaml`, and the verification tables of design/02, 03 and 05 (not in your list, but the shipping plan depends on them). I ran nothing and edited nothing. Findings are ordered by threat to the hypothesis.

## 1. The fixtures cannot tell a witness detector from a failure-vocabulary, length or specificity detector (the demand from round 4's review is not met)

**Wrong or missing.** Every restated cell in `defective-gross` and `defective-subtle` has the same form: a short, abstract assertion of correctness ("The static checks are correct", "Modules compose correctly", "Each answer is bound to the atom it was asked for"). They contain no negation or failure verb and are much shorter than the genuine cells. Nearly every good cell contains a failure marker ("not", "other than", "accepted", "differs", "lacks", "omits", "becomes"). A lexical "does it describe a failure" detector, a length detector or a specificity detector separates all three fixtures perfectly, and a pass would prove nothing about witness-hood. `defective-subtle` is one cell (row 1, the most generic row), and its other 13 cells are byte-identical to `good`. That is 1 new sample, not 14.

**Why it matters.** The hypothesis says the judge separates "restated" from "observable". The fixtures test only "short assertion of correctness" against "long failure description". A "separation" would be uninterpretable. This is also the failure class that beat round 3 (restatement held at 0.97).

**Amendment.** Add a fixture `controls` (a small table of 12 to 16 rows borrowing real Property names; per-row asking needs no full document) with pre-registered per-cell labels and refuting cells:
- **Tautological negation** (restatement with failure form): "Binding by construction is violated", "Answers are not bound to their atoms", "The static checks reject a valid program". Expect `fails`. A `holds` here means the judge keys on failure vocabulary.
- **Long padded restatement**: 40 words or more of fluent prose, no observable. Expect `fails`.
- **Short genuine witness** (length and vocabulary control): "A reordered atom changes a fact", "Two libraries defining `problem` collide", "A param change has no effect". Expect `holds`. A `fails` here means a length effect.
- **Genuine witness without failure words**, for example "the seeded case yields 0 findings where 1 is expected". Expect `holds`.
- **Confident pass assertion**: "All oracle tests pass; the property is verified". Expect `fails`.
- **Command-failure pointers** (see 5).
- **Swapped witness** (see 2).

Pre-register that any control cell on the wrong side at p ≥ 0.6 under both candidates refutes the claim that the oracle detects witnesses rather than style. Vary `defective-subtle` to at least three rows (including a middle row such as "Extends law") so it is not a single cell.

## 2. Row context (the axis) is not isolated: nothing in the fixtures can distinguish C2 from C1

**Wrong or missing.** Every defective cell is detectable from the cell alone, because a bare assertion of correctness is visible without the property. So C1 should do as well as C2, and the plan's own selection rule ("C1 if it matches C2 on every document verdict") will almost surely pick C1, since good is PASS and both defective fixtures are FAIL for any competent oracle. The axis is then decided by the fixtures' ceiling, not by row context. The one defect class that needs the property, a genuine witness attached to the wrong row, is absent. In `good.md`, row 11 ("Nested classification (scripted)") carries the row 1 binding witness nearly verbatim ("Two atoms of one oracle over different sections receive each other's answer"). It is a ready-made wrong-row case that the plan does not mention.

Co-varying factors between C1 and C2, beyond the Property line:
- The C2 evidence carries `Property:` and `Failure witness:` header prefixes, so C2 tells the judge which cell is the witness cell and C1 does not.
- The C2 question has an added sentence and an added clause ("criteria applied to the witness cell").
- C1's question says "restates the property", but the property is not in C1's evidence, so that clause is unevaluable in C1.

**Amendment.**
- Add `defective-swapped`: the 14 good witnesses rotated by one row (or 5 rows swapped). Every cell is a genuine observable for the wrong property. Pre-register C1 `holds` (it cannot know) and C2 `fails` on at least the swapped rows. This is the cell that tests the axis. The expectation for row 11 under C2 (`fails` or `holds`, with reason) must be recorded before the run; add it to the "known weak rows" list.
- Give C1 the same `Failure witness: ` prefix so the only content difference is the Property line. Make the C2 question the C1 question plus the single sentence about the property, and say so in the plan.
- Replace the selection rule. Document-verdict equality is the wrong tie-break because it is nearly certain. Pre-register: C2 is selected if it is correct on `defective-swapped` rows (at least 4 of 5 `fails`) and on controls where C1 is not; otherwise C1. Add the minimum margin on restated cells to the rule.

## 3. The hypothesis and its refuting cells are not each other's negation

**Wrong or missing.**
- The hypothesis says "every restated cell fails and every genuine witness holds, under at least one candidate". The refuting cells are (a) a restated cell `holds` ≥ 0.6 under **both** candidates, and (b) more than 2 good cells `fails` under the **selected** candidate. If C1 misses cell X and C2 misses cell Y, no cell is missed by both, so (a) does not fire, yet neither candidate separates. Refuting cell (a) is also too weak a condition for a hypothesis that says "every".
- "Every genuine witness holds" and "up to two may fail" contradict each other.
- Labels at 0.50 to 0.59 (`fails` below the 0.6 separation line) are not classified. The ledger threshold is 0.5 and the scoring line is 0.6. Round 4's review already asked for this to be stated.

**Amendment.** State the hypothesis as: "at least one candidate has every restated cell (14 + 1 + the control restatements) `fails` ≥ 0.6, and at most 2 of 14 good cells `fails`." Refute if no candidate meets both. Add one line: labels in [0.5, 0.6) and `unknown` count as not separating (not a false pass) and are reported. Fix the contradiction by saying which of "every" or "≤ 2" is meant.

## 4. Expectations are incomplete and in places unrecorded

**Wrong or missing.**
- No expectation or refuting cell for C1 and C2 on the good fixture's own weak spots beyond rows 10, 12 and 13 (see 2 for row 11). Row 11 and row 1 are near-duplicates, so identical or near-identical text appears twice; cache and dedupe make those labels non-independent. The plan does not say whether the cache is off.
- The corpus run is "read by the lead" with no recorded expectation or blind labels. Round 4's review item 12 asked for exactly this and it was taken. Of the design documents, 03, 04 and 05 have a `Failure witness` table (design/02's header differs, see 7). The real cells are the only cells not written for this round and are the only test of the ruling in 5.
- No expectation for stability. Round 4 ran `--repeat 2` and found one wording-sensitive cell; round 4c has neither a repeat nor a paraphrase, though it ships to error severity.
- The shipped severity and profile for the oracle are not stated (the existing constraint is `error`, `profiles: [promotion]`).
- "Medium-high confidence 14/14 fails on gross" carries forward round 3's overconfidence about this judge on this exact content. The one real risk (the judge accepts restatements, as in round 3) deserves the pre-stated reading "the grain was not the problem", which the plan has; add the corresponding reading for tautological negation (see 1).

**Amendment.**
- Add the blind corpus labels: the lead labels every witness cell in design/03, 04 and 05 (and 02 once its header is covered) as `holds` or `fails` before the run, commits the labels, and the run reports agreement. Expect disagreements concentrated on design/05 (see 5).
- Run `--no-cache --repeat 2` on both candidates (state it in the predicate) and report label flips. Add one paraphrase of the C2 question run on the controls and the swapped fixture.
- State the shipped severity and profile.

## 5. The "command failure is a pointer" ruling is not in the question, and the corpus contradicts it

**Wrong or missing.**
- **Wording vs ruling.** The C1 question says the cell holds if it names "something a test, a command or a measurement would show". A cell "`npm test -- oracles` fails" is literally that. The judge does not see the ruling (it is recorded in the plan, not in the question), so the question as worded admits the very cells the ruling says must fail. The measurement cannot test the ruling.
- **The fixtures never exercise it.** Not one good cell is a bare command failure. All 14 describe an observation (read them: e.g. "Two atoms ... receive each other's answer", "a depth-2 program makes a number of rounds other than 2"). Row 10's and row 14's cells also read as observations. So the ruling is consistent with the good cells but untested by them.
- **Design/05's real cells.** Row "Feasibility (round 1)": "any of K1–K4 fails". Row "Model conformance": "the kernel fails a gate ... on a seeded witness". These are the command-failure pointer the ruling condemns, on the programme's own design. Row "Gate suite form" ("tested only by hand-written cases") and "Soundness by construction" ("expected undefined, never PASS") are borderline. Shipping at error severity would make design/05 NO-GO and the plan has no expectation for it.

**Amendment.** Either put the ruling in the question ("a witness that only says a named command or test fails, without saying what it would show, fails") or drop the ruling. If it is put in, add 3 pointer cells to `controls` ("`npm test -- oracles` fails", "any of K1–K4 fails", "the gate fails") with `fails` expected, and pre-register design/05's two cells as `fails` under the ruling. State that this will make design/05 NO-GO and that its repair is a later change, not part of this round.

## 6. Question wording on a single cell

**Wrong or missing.**
- C1: "restates the property" has no referent in C1's evidence (see 2). Change "the property" to "the claim the cell is a witness for" in C1 or give C1 the property.
- "Asserts that the property holds" and "restates the property" overlap; keep one.
- "Stated as what would be seen if the property were false" is good, but the "fails" clause does not say what to do with a cell that is observable yet vague ("Diagnostics are incomplete"). That is the tautological-negation class and needs a sentence: "A cell that only negates the property in other words fails."
- Neither question says whether a cell may cite another document or a row number. Design/05's cells do ("round 2", "gate ledger item 1", "K1–K4").

**Amendment.** Quote both final questions in the plan after revising, and add the tautological-negation sentence and a sentence for cross-references.

## 7. The shipping plan is unsound in three places

**Wrong or missing.**
1. **The fallback ships a known-useless check.** `not has_witness_table(D, S)` falls back to the section ask. Round 3 measured that ask false-passing both a gross and a subtle seeded defect (holds 0.97 and 0.99) at error severity. It would silently pass any document it covers while the contract claims verification. "So the shipped contract never silently drops a document" is the opposite of what it does.
2. **The header match misses a real document.** The condition is a table with a `Failure witness` header. Design/02's header is "Observable failure witness", so design/02 falls to the section fallback in item 1. Header case, spacing and synonyms are not covered; a header-synonym or substring rule is needed (`core.header` matching) or the document is simply not checked.
3. **Vacuity.** The plan's `core.cells` tests do not cover (a) an empty `Failure witness` cell (no atom is created, so the per-row `forall` passes: the strongest defect is the one passed), (b) a table with the header but zero data rows, or (c) an empty Property cell (C2 silently degrades to C1). These were the round 4 review's item 10 and apply again. Also: if C1 is selected, `core.cells` is unused engine code, so state whether it stays.

**Amendment.**
- Drop the section fallback or demote it: replace it with a structural finding at warning severity ("{S} has no table with a Failure witness column; no per-row witness check ran"), so a document is never reported passing on the judge's agreement with a measured-useless ask.
- Match the header as `Failure witness` or `Observable failure witness` (case-insensitive) and list the rule.
- Make an empty witness cell a structural error with no judge call, and a zero-row table a structural error. Add all three cases to `tables.test.ts` and gate the live run on them. Add a seeded defect that flips the `has_witness_table` branch.
- Do not ship on selection alone: ship after the corpus labels (4) agree and the severity is chosen. Say what happens to design/05 (see 5).

## 8. Cost and caps are not projected

**Wrong or missing.** The plan says "mock projection before the live run; cap 1.5× the worst case" but gives no numbers, and the predicate uses `--cap 120` for each candidate. Main questions: 42 per candidate on the three fixtures (about 29 distinct if the cache dedupes the 13 repeated subtle cells), plus a follow-up per non-passing leaf (about 16), so about 60. With the controls, swapped fixture, `--repeat 2` and the corpus (about 25 cells), the total is about 200 per candidate. The cap of 120 would truncate (`complete: false`) as soon as the additions go in. There is also no cost line for the shipped oracle: 14 questions per design document replace one, and the judge-advisory job is in CI.

**Amendment.** Print the exact mock projection in the plan (main, worst-case follow-ups, per track). Use separate tracks (fixtures; controls and swapped; repeat; corpus), each with a cap of 1.5× its worst case and its own `complete` flag. State questions per design file for the shipped oracle against one section ask.

## 9. Left unmeasured that should be measured now

- **Row-level exposure of tied cells**: whether a wrong-side cell is the same text as another (rows 1 and 11).
- **Chain truth**: whether the witness is true of the command beside it is listed as unmeasured; fine, but the verdict must not claim more than "the cell reads as an observable".
- **The Command column is excluded from both candidates**; a witness that is observable only given the command ("the seeded case yields 1") would be judged without the command. Record that as a known limit, and one control cell of this kind.
- **Judge variation**: one other model on the controls and swapped fixture if budget allows, as round 4's review asked.

## 10. Smaller points

- The preamble says the round "re-authors the oracle on that grain". Say that this is a classification per cell, not the extraction form, so the verdict does not claim the extraction form was tested (round 4's review item 8).
- The review section says "amendments listed here"; list how each of these is taken, by number, as the round 4 plan did, and do not replace any fixture after the run (already stated).
- Round 4's verdict flagged "whether A's advantage over A2 was the row ids or the Design column": the same confound (row identity vs. content) may apply to C2 here, since the `R` binding exists in both. Note it, no action.

**Verdict: run after amendments.** The cell grain is the right question, and the cheap C1/C2 contrast is a good design. The fixtures as written cannot separate a witness detector from a failure-word, length or specificity detector, and cannot show any advantage of row context, so the selection rule would default to C1 for a reason unrelated to the axis. Findings 1, 2, 3, 5 and 7 are blocking; 4, 6 and 8 should be done in the same revision.
