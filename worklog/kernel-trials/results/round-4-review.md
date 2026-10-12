# Round 4 plan: independent review (verbatim)

The independent seat (a sonnet subagent) read `round-4-preregistration.md` as first written on
2026-10-13, round 3's plan, verdict and review, `doc-verify/lib/goal.yaml`, goals/04 at HEAD and
at `8b1e4a9`, and the experiment-round skill. It ran nothing and edited nothing. Its review
follows unedited; the plan's `## Review` section records how each finding was taken.

---

# Round 4 plan: independent review (step 4 of the experiment-round method)

I read the round 4 plan, round 3's plan, verdict and review, `doc-verify/lib/goal.yaml`, goals/04 at HEAD (`c632a91`) and at `8b1e4a9`, and the experiment-round skill. I ran nothing and edited nothing.

Findings are in order of how much they threaten the hypothesis.

---

## 1. The fixtures cannot test the axis (homogeneous defects)

**What is wrong.** Every defective fixture has all five cells defective. The decisive case for "cell grain beats section grain" is a table with four good cells and one bad cell. That is the dilution pattern round 3 found: a gross defect swallowed by a long section. With uniform fixtures, one section-level yes/no is at its easiest, because the whole table is bad or the whole table is good.

**Why it matters.** The plan's refutation clause is "A separates every level as well as B does". That clause is very likely to fire here for the wrong reason. A would separate on uniform tables whether or not grain matters, so the verdict would read "grain is not the axis". It would be an artefact of fixture design, not a finding about grain. The plan is also unlikely to ever show A false-passing: the section is a 5-row table of about 1 KB, which is not the long mixed section that failed in round 3.

**Amendment.** Add two mixed fixtures: `mixed-one-bare` (four chains plus one `done, works`) and `mixed-one-pointer` (four chains plus one pointer). Pre-register A as `fails` or `holds` for each, and B as exactly one cell `fails`. State that the grain hypothesis is tested on these two fixtures, with the uniform ones as floor and ceiling. Redefine "A separates as well as B" as: A's document verdict equals B's document verdict on every fixture, including the mixed ones.

## 2. Grain co-varies with other things between A and B

**What is wrong.** The plan says only the evidence and the subject differ. Three more things differ:

- **Which columns are seen.** A sees `core.own` of the whole section: the Design column (full of paths and `§` references), the header, and the `R1..R5` ids. B sees only the Evidence cell. The plan's own mechanism for A's false pass is "a table with paths-looking text reads as evidenced". That text is mostly in the Design column, which B never sees. So A versus B is also "Design column present versus absent".
- **Quantifier.** A is asked "every cell", which is a universal, while B is asked "this cell".
- **Host code path.** B needs the new table-fact host code; A does not.

**Why it matters.** A difference between A and B could come from any of these and could not be assigned to grain.

**Amendment.** Add candidate A2: one atom over the concatenated Evidence cells only. It has the same bytes as B's five atoms and one question, with a "every cell" quantifier. The comparison B versus A2 isolates grain. A versus A2 isolates the Design column and header. Report the three together. If A2 is not wanted, the verdict must say the axis was "grain plus column scope".

## 3. Pre-registration leak in `candidate-good`

**What is wrong.**

- **Conditional fixture identity.** Whether the `c632a91` table becomes `good.md` or `defective-terse.md` depends on B's output (at least 4/5 `holds` at p ≥ 0.6). The fixture's identity is then decided by the candidate under test.
- **Post-run authoring.** If the terse cells fail, the lead rewrites `good.md` after seeing which cells the judge disliked. The rewrite is written to the same three-part criterion that the question states, so it is good by construction. It is also tuned to the judge's observed behaviour. The "good, 5/5 `holds`" expectation row is therefore a regression gate, not a prediction.
- **Cell-level, not table-level.** The expectation "at most 2/5 holds" names no cells. Which cells are expected to hold?
- **Mislabelled cells.** The plan calls the `c632a91` cells "a path plus a one-word parenthesis". That is wrong for R3 and R5, which have no parenthesis at all and are plain pointers. R2's and R4's parentheticals are multi-word and read as conclusions ("gates pass, seeded defects flip them").

**Why it matters.** This is the one place where a rewrite after the run can make the result come out as predicted. The hypothesis's third level is partly constructed after the measurement.

**Amendment.**

- Write `good.md` (and a no-path variant, see 6) before the run. Commit it with the plan and review, by a fixture author who is not the plan author, as round 3 did. Remove the conditional.
- Always run the `c632a91` table as a fixed fourth level, `terse`.
- Pre-register a per-cell prediction for `terse`. For example: R3 and R5 `fails`; R1, R2 and R4 uncertain (say which side you expect and why); the document verdict `fails`.
- State what 3/5 `holds` means (it contradicts "at most 2/5"). Say that no fixture is replaced after the run, the same rule round 3 used.
- Record the rule that goals/04 itself is edited only after the verdict, if at all.

## 4. `defective-pointers` is defective, but R3 is borderline, and the fixture is not clean

**What is wrong.** I read each `8b1e4a9` cell against the owner's three parts (observable facts, a claim drawn from them, a conclusion).

- **R1, R4, R5.** Pure pointers. Defective.
- **R2:** "the model's gates, seeded (round 2)". This is a gestural assertion with no fact. Defective.
- **R3:** "...preregistration §Candidates; Z3 named as an analysis stage". "Z3 named as an analysis stage" is an observable fact about a document, with an implicit claim. It lacks a stated conclusion. It is borderline, not clearly defective. At `c632a91` this cell is nearly the same text, so it sits in both `pointers` and `terse`.
- **Not a clean fixture.** The fixture is the entire `8b1e4a9` document. It differs from HEAD in the Workstreams text and in the Design column, not just the Evidence column. So the document verdict can move because of other constraints, including the `coverage_complete` oracle, which runs under the promotion profile.
- **Not a fixture the owner specified.** The owner's seeded failing fixture is the pre-`c632a91` table. The plan should copy the table into the HEAD document and change only the Evidence column. The plan also does not say that it treats "a path is not a fact" as the rule.

**Why it matters.** "5/5 `fails`" is overstated for pointers, and a document-level false pass cannot be attributed to the evidence oracle.

**Amendment.**

- Build every fixture from HEAD goals/04 by replacing only the Evidence cells, with the Design column held fixed.
- Report only the evidence-oracle leaves for separation, and the document verdict separately.
- Pre-register per-cell labels from the lead's own rubric. Put R3 down as a possible `holds`, and say that a `holds` on R3 does not refute the hypothesis.
- Settle one open definition before the run: does a cited path or commit count as an "observable fact"? The owner says paths stay optional and `paths-resolve` checks them. If a pointer to a verdict counts as a fact, the pointers fixture is less defective than claimed. Choose and record a ruling.

## 5. `defective-bare` is a floor check only, and the informative bare cases are missing

**What is wrong.**

- **`done, works` is a floor.** A judge that says `holds` on it is simply broken. It proves little.
- **The missing fixture is round 3's winning defect.** Round 3's headline was `verification_falsifies` at `holds` 0.97 on **restatements** of the claim. The analogue here is a cell that restates the requirement or asserts the conclusion with confidence and no fact, for example "R1 is met: the kernel is mature with published semantics" or "Verified; all gates pass; trusted". Round 3's finding that this judge leans towards `holds` makes that the most likely way B false-passes. The plan has none.
- **Identical cells.** All five cells of `defective-bare` are the same string. If the judge cache or atom deduplication keys on evidence plus ask, "5/5" is one sample. The predicate does not say `--no-cache`.
- **Length control.** The good cells are far longer than any defective cell. B could be separating on length or specificity, not on reasoning. A long fixture with no facts (padded prose asserting success) would test that.
- **Non-sequitur control.** The criterion's second part ("draws the claim from those facts") is never tested. A cell with facts and a conclusion that does not follow, or a chain placed in the wrong row, would test it.

**Amendment.**

- Keep `defective-bare`, but vary the five strings and treat it as a sanity floor, not evidence.
- Add `defective-restatement`, `defective-padded` (long, no observable facts) and `defective-wrongrow` (a good chain in the wrong row).
- Add `--no-cache` to every live predicate and say so.
- Say in the plan that without the padded control, a B win cannot be told from a length effect.

## 6. "Paths optional" is not measured as claimed

**What is wrong.** The owner's requirement is that a cell need not cite a file path. The plan says `good.md` keeps its paths. The "paths optional" measurement only checks that `defective-bare` has no dangling path, which is trivially true.

**Why it matters.** Nothing shows that a prose-only reasoning chain `holds`, which is the owner's whole point. Nothing shows that a dangling path in a good chain still draws a `paths-resolve` warning while the evidence oracle still holds.

**Amendment.** Add `good-nopath.md` (chains with no path) and `good-dangling.md` (a chain citing a path that does not exist). Pre-register: both `holds`; `paths-resolve` warns only on the second.

## 7. The requirement text is not in the cell's evidence

**What is wrong.** The criterion says the cell "draws the requirement's claim from those facts". B's evidence is only `core.cell(D, R, 'Evidence')`. The requirement statements live in the anchored-root section, and the AC coverage section carries only `R1..R5`. Neither candidate shows the judge what claim is being drawn. For B the judge sees even less than for A.

**Why it matters.** Part two of the criterion is then unevaluable. The judge can only check that some claim is drawn, so the question degrades to "is this cell a chain, in the abstract". That makes wrong-row and non-sequitur defects invisible and inflates both candidates' leniency.

**Amendment.** Either add the row's requirement text to B's evidence (a union of the root requirement and the cell, keyed by the row id), with the same text given to A, or reword the question so that it does not refer to "the requirement's claim". Record which, before the run.

## 8. Question wording is not on record and is hard to apply to a single cell

**What is wrong.**

- **Not quoted.** The plan paraphrases the ask for B and says "the same three criteria" for A. The actual ask strings for A and B are not in the plan, so the independent seat cannot review the wording, which is the thing under measurement.
- **Parts overlap.** "Draws the claim" and "states a conclusion" overlap. A judge will merge them into two parts, or accept either as the third.
- **"Observable facts" is undefined for a cell that cites a document.** The judge cannot open the document. A path alone either counts as a fact or does not, and the wording does not say.
- **Mischaracterised as extraction.** The preamble says the round is the first measurement of round 3's "extraction over smaller atoms". B is a per-cell yes/no classification, which is a smaller atom, not extraction (list the facts, claim and conclusion, and let a rule decide). The verdict must not claim the extraction form was tested.

**Amendment.** Quote the two ask texts verbatim in the plan. Define each of the three parts with an example taken from outside the fixtures. State the ruling on pointers from finding 4. Replace "extraction form" in the preamble with "smaller classification atom". Name the extraction form as the next candidate if B false-passes.

## 9. Expectations: gaps and over-confidence

**What is wrong.**

- **Hypothesis versus refutation paragraph.** The hypothesis's refuting cell covers only B's labels. The condition "A separates every level as well as B" appears only in a later paragraph. Fold it into the hypothesis.
- **Unspecified outcomes.** `unknown`, threshold-demoted and `fails` below 0.6 are not classified. Round 3's review asked for exactly this.
- **Threshold inconsistency.** The hypothesis says "at its declared threshold" (0.5). Separation is scored at 0.6.
- **Over-confidence.** "Medium-high" confidence that B fails all five pointer cells ignores round 3's finding that this judge says `holds` on restatements at 0.97. A B false pass on pointers is the most probable refutation, and the plan has no pre-stated reading for it.
- **Unrecorded expectations.** The structural-only catch, the `paths-resolve` count, the cost and any repeat result have measurements but no pre-registered expectation.
- **Different aggregation per candidate.** B's rule is k/5, A's is one atom, so the two are not comparable.

**Amendment.** Specify in the plan:

- `unknown` or demoted counts as not separating, and for a defective fixture it is not a false pass but is reported.
- State which of 0.5 or 0.6 is the scoring threshold.
- Lower the confidence on pointers to medium or low and pre-state the false-pass reading (the judge accepts a named verdict as evidence; next candidate is extraction).
- Add expected values for structural-only catch (none, table structure intact), `paths-resolve` counts, and cost.
- Compare candidates at document-verdict level, with per-cell tables as diagnostics.

## 10. Engine gates miss the cases most likely to make the check pass vacuously

**What is wrong.** The new `forall` over table rows passes trivially when the parser yields zero rows. The listed `tables.test.ts` cases (pipe table, cell outside a table, fenced table, cell resolves to text at the row line, scripted judge) do not cover:

- escaped `\|` or a `|` inside backticks, which goals/04's cells could contain;
- a table with no `Evidence` column, or a different case or spacing in the header;
- an empty Evidence cell, which should fail structurally without asking the judge;
- a document whose coverage heading exists but whose table is absent or malformed.

**Why it matters.** The experiment runs on the new parser. A parser bug (wrong cell text or zero rows) would be read as judge behaviour or as a pass.

**Amendment.** Add those cases to `tables.test.ts` and require the suite to pass before any live call. Have the runner print the exact evidence text passed for each atom and the row count, so a reader can check the parser against the fixture. A seeded defect for "no rows" should flip a constraint.

## 11. Shipping the oracle into `doc-verify:goal` before the verdict

**What is wrong.** Candidate B is declared in `doc-verify:goal`, the shipped module, at `severity: error`. That changes verdicts on goals/01–03 and any other goal before the round decides anything. It also ends the "corpus run is not repeated" statement: the next corpus check will run it.

**Amendment.** Keep B fixture-local for this round (as A is), or ship it at a non-failing severity or behind a profile no one runs. Move it into the shipped module only in the verdict's decision row.

## 12. Real cells in goals/01–03 are left unmeasured, and they are the cheapest ground truth

**What is wrong.** The plan leaves goals/01–03 to "read by the lead, finding count noted". That is the only data in this round that the plan author did not write.

**Amendment.** The lead labels every Evidence cell in goals/01–03 as chain or not, blind to the judge's output, and commits those labels before the run. Run B over them (about 20 atoms) and report agreement. This gives a false-positive and false-negative rate on real cells.

## 13. Cap and cost reasoning

**What is wrong.** The reasoning is roughly right but thin. "3 or 4 fixtures × (5+1) plus follow-ups" gives about 24 main questions. Follow-ups add one per non-passing leaf, so about 5 per defective fixture. The promotion profile also asks `coverage_complete` once per fixture. With the fixtures in findings 1, 3, 5 and 6 (about 12 fixtures), the main atoms total about 72 plus follow-ups plus `coverage_complete` plus a repeat run. That would be about 100 to 180, over the 120 cap. A cap that is too low silently truncates (`complete: false`). A cap that is too loose cannot catch a runaway.

**Amendment.** Print the mock projection (exact main questions and the worst case with every follow-up) in the plan before the review closes. Set the cap to about 1.5 times the projected total, per track (fixtures; repeat; real-cell run), with `complete` reported per track as the method requires. Add one repeat of every B atom with the cache off, because round 3 only repeated the corpus.

## 14. Other unmeasured items to add

- **Stability** of B's cell labels (finding 13 covers the repeat).
- **Wording variation:** one paraphrase of the B ask, run only on `terse` and `mixed-one-pointer`, to see whether the borderline cells flip.
- **Judge variation:** one different model, on the same two fixtures, if budget allows.
- **Cost against a human read:** the verdict should state the question count per goal file against reading five cells.
- **Chain truth:** the oracle cannot check that cited facts are true. A well-formed chain with fabricated facts will pass. Say so in "Left unmeasured".

---

**Overall judgement: run after amendments.** The cell-versus-section question is the right one, but the plan as written measures grain only on uniform fixtures, ties the good fixture to the result, and omits the controls (restatement, padding, wrong row, no-path) that would tell a reasoning-chain detector from a length or style detector.
