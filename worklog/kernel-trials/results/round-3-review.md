# Round 3 — independent review (sonnet seat), verbatim

(Received 2026-10-12 before the run. Amendments are in `round-3-preregistration.md`.)

I read the plan, the oracle declarations and `oracles.ts`. I did not run anything.

**Plan error to fix first.** The candidates table gives `coverage_complete` threshold 0. `lib/goal.yaml` declares 0.5. Every other threshold in the table is 0. This changes how that row should be read (see 1).

**1. Falsifiability**
- **Separation** can fail as written: good and defective land on the same side. It is weak at n=1 per side (see 2). The plan also does not say what counts as "same side" when good is `unknown` and defective is `fails`. That case should be named, and I would count it as not separating.
- **Decisiveness** can fail, but it measures two different things. `applyThreshold` demotes to `unknown` only on four conditions: no distribution, a length mismatch, a tie at the top, or a top value below the threshold. At threshold 0 the last one never fires. So for four of the five oracles, "does not decide" is just the judge choosing the `unknown` option, which is always in the list. That is the judge saying the evidence is insufficient. It is not a calibration failure. Only `coverage_complete` (0.5) can have a real threshold demotion. The two should be reported separately: judge-unknown, threshold-demoted, tie or malformed. They point to different remedies (rewrite the question or evidence, versus recalibrate). The refuting cell should say which one counts.
- **Stability** can fail. Two caveats: "More than one atom in ten" is meaningless where the oracle has one or a few atoms (`evidence_not_law` has one receipt, `scope_explicit` one document). One flip would be 100%. State a minimum n, or mark those rows "not assessable". A repeat of two runs says nothing about drift over time. "Mean change of argmax" is measured against uncalibrated probabilities (R1), so its meaning is unclear.

**2. Axis**
- The axis is not "the oracle". Each candidate bundles a different question wording, evidence selector (body, union, per section), byte size, and label shape. A difference between oracles cannot be attributed to any one of these. That is acceptable if the claim is only "does each oracle work". The hypothesis's claim, "the toolkit's calibration is useful", needs the variation to be controlled. The plan does not say this.
- With one good and one defective fixture per oracle (n=1 each), the main confounds are: the plan's author picks the good document and writes the edit; a single seeded edit is a large, obvious change, so it tests "can the judge see a gross edit", not "does the oracle track the property"; the good and defective fixtures differ in more than the property, for example in length; one sample per side cannot give a threshold; the corpus run reuses the same documents, so fixtures and corpus are not independent. The fixtures should be written or reviewed by someone other than the plan author. At least 2 to 3 defects of different kinds per oracle would help, including one subtle one.

**3. Expectations**
- They are too loose to rule out a pass: "Separates" has no margin on the distribution value; confidence is given as "medium"; two rows say "one document" or "—", so those cannot fail at all; there is no pre-stated reading for the case where the good fixture itself comes back `unknown` or `fails` (a reader could call that a fixture problem and rerun, which makes the plan unfalsifiable); the 0.5 and 0.9 cutoffs are given with no basis. Add a pre-stated reading for each cell, including a good fixture that does not hold.
- The `coverage_complete` prediction is partly a regression gate. Its basis is design 04's v1 measurement (`unknown` at 0.92 to 0.95). That was a different mechanism and request shape, and the current threshold differs (0.5, not 0). It does predict something, but the row has no stated condition under which it would be wrong. "Does not separate OR does not decide" is a disjunction covering both bad outcomes, so only one cell (decides and separates) falsifies it. Write which one you predict. The "<0.5" decisiveness prediction on a small corpus is also fragile.

**4. Fixture validity**
- **Rationale argues an unrelated mechanism:** a good test of `problem_resolved`. Its ask text names "without relying on an unnamed decision", but the edit targets "resolves the stated problem". Make sure the edit leaves the problem statement alone and replaces only the rationale, and that the mechanism section is untouched.
- **Witness column replaced by restatements:** valid. The risk is a judge calling a restatement an observable witness. This is also the likeliest edit to separate clearly.
- **One root requirement row deleted from the AC table:** valid in principle, but hard, not obvious. The judge must cross-check the whole root list against the table, and long union evidence at 16000 bytes invites `unknown`. The edit should also be checked for leaving a trace in the body.
- **Receipt rewritten as a rule:** the weakest edit. The ask text allows decisions, and "always do X" can be read as a recorded decision. It should be a clear standing-law assertion with no dated work, evidence or named object left.
- No fixture is planned for `scope_explicit`. Its defect needs a stated edit: the "Scope - what we touch" section cut to a vague sentence.

**5. Budget and method**
- 300 questions is plausible but unproven. Fixtures need 10 questions. Each corpus run needs one question per demanded atom, so two runs need twice that, and the corpus size is not stated. The span follow-up is one extra choose question per document, and it fires for every `fails` or `unknown` leaf. `per-atom` request shape would add further questions. Compute the worst case before the run, and make the runner stop on the cap and report `complete: false`.
- A scratch git repo through `doc-verify check` is workable, since `mutate` does it. But it drags in: structural constraints that must pass first; `goal.yaml`'s anchored-root heading list; the `home.design-03` module on top of `home.design`; for the receipt, `doc-verify:references`; `--profile promotion`, which activates the semantic constraints. An unmet structural constraint can make the semantic one undefined and never asked. The seeded defect must therefore not break structure. Check that each fixture's structural constraints pass before reading the oracle leaf.

**6. Top three things left unmeasured**
1. **Whether the semantic half catches defects a structural check cannot.** Run every seeded defect through the structural constraints alone as well.
2. **Cost per verdict against a human read.** No defective fixture is checked for passing (that is the failure the proposition is about).
3. **Variation across judge, model and phrasing.** Everything runs on one judge and one wording per oracle.
