# Round 4b plan: independent review (verbatim)

The independent seat (a sonnet subagent) read `round-4b-preregistration.md` as first written on
2026-10-13, the model, the constitution, round 2's plan and verdict, the runner, the brute-force
reference and two witnesses. It ran nothing and edited nothing. Its review follows unedited; the
plan's `## Review` section records how each finding was taken.

---

# Review of round 4b preregistration (clingo as subject S3)

I read the plan against the model, the constitution, the round 2 plan and verdict, the runner, `random-brute.mjs`, the two witnesses and the method skill. I ran nothing and edited nothing. I did not read the corpus file or `prefix-unknown-fallthrough`.

## Findings

**1. The status rule ignores the body, so S3 will report unsound `violated` and `satisfied`.**
- The plan says "goal true in every answer set → `satisfied`; false in every → `violated`". Model §4 says violated requires `Bθ = t ∧ Gθ = f`. A binding whose body is false in some completion is dropped there, so it is not violated.
- Where a constraint has a `forall` literal over an oracle, the plan's rule calls such a binding `violated`. The generator makes 40% of constraints of that shape. `nonempty` populations have the same gap.
- Why it matters: the refuting cell "S3 calls a binding otherwise" would be met by a plan bug, not by supervaluation, and the 500/500 row cannot hold as written.
- Amendment: define the status over answer sets using the §4 table.
  - `satisfied` iff every answer set has B false or G right.
  - `violated` iff every answer set has B true and G wrong.
  - Bindings are the substitutions with B in the brave set.
  - Forbid is symmetric, and `nonempty` is defined the same way.

**2. The verdict rule differs from enumeration's, and the comparison rule contradicts itself on refinement.**
- The plan derives the verdict from per-binding statuses (§5). Enumeration's verdict is per completion. With `c1: require o` and `c2: require not o`, every completion is NO-GO, but each constraint is individually undetermined, so the status-derived verdict is NEEDS-REVIEW. Weighted warning thresholds can differ in the same way. The random track says "verdict equal", so it will report a spurious inequality.
- The rule "verdict must match where the expectation is not undetermined" is ill-defined, because verdicts are not "undetermined". It would flag a correct refinement as FAIL. In `overdemand-o-not-o` step 1, `p :- o, not o` is false in every completion, so S3 says `violated` and NO-GO against the expected NEEDS-REVIEW.
- Amendment:
  - Order verdicts by information. NEEDS-REVIEW may refine to PASS or NO-GO; PASS, NO-GO and BLOCKED must match.
  - Compare against enumeration's status-derived verdict as the primary, and report the joint verdict (cautious over "some error violated") as a separate measured column.
  - State in the plan that step 1 of `overdemand-o-not-o` is predicted NO-GO with empty demand.

**3. "Sound refinement of WFS" is close to a theorem, so the hypothesis as written tests the translation, not the axis.**
- By M1 and §3, a WFS-decided value on a loop-free program holds in every completion, so supervaluation must agree. The only ways to refute the hypothesis are translation bugs (finding 1, exclusivity), negative loops (finding 5) and authored-`u` leaves (finding 4). The plan implies the axis is measured, but it is a conformance check.
- The witness track cannot test soundness where it matters. "Undetermined may be anything" means a wrong `satisfied` in a `u` cell is never checked, so the "refined" count is unfalsified.
- Amendment:
  - Add a third reference, supervaluation by enumeration, as the oracle for S3. Run `random-brute`'s enumerator over every loop-free witness, or hand-derive refined expectations before the run.
  - Compare S3 to that oracle (engine and translation fidelity). Compare S1 to the oracle (the semantic gap).
  - The axis is then isolated from clingo itself.
  - Split the claim into two predicates: soundness (S3 decided ⇒ holds in every completion) and completeness (enumeration-decided ⇒ S3 decided).
  - The model's §9 brute-force gate is soundness only, and the equality target is new. Say so, and say what model amendment a pass would propose.

**4. Authored-`u` leaves (known unknown, below-threshold answers) have no encoding.**
- "Asked ones fixed" does not cover an asked atom whose label is undecided or below threshold, where every label atom is `u` (§1, §2).
  - Fixed true or false misstates the contract.
  - Left free, it is supervaluated like a hole, and a tautology (`p :- o. p :- not o.`) goes to PASS despite the judge's "unknown". Invariant 2 is not breached, but the author's NEEDS-REVIEW is overridden.
- The plan lists the known-unknown label as unmeasured, but it is the one place where "refinement" changes what the author declared.
- Amendment:
  - Specify the encoding: free external, never demanded (§6 `asked`).
  - Add a witness step with an `unknown` answer on a tautology and record the predicted result.
  - Extend the enumerator to treat such atoms as free.
  - Report any PASS or NO-GO that the model reports as NEEDS-REVIEW through an authored `u`, separately from hole-refinements.

**5. `m2-negative-loop` is a mispredicted expected failure, and unsatisfiable programs are unhandled.**
- For `p :- not q. q :- not p.` clingo has two answer sets. Brave `p` is true and cautious `p` is false, so S3 reports undetermined and NEEDS-REVIEW, exactly the expected statuses and verdict. `compare` checks `findings` only for S1, so S3 will print `unexpected-pass`, which the runner reports as a plan contradiction.
- On `p :- not p`, or any odd loop, clingo is unsatisfiable. "True in every answer set" is then vacuously true for both `satisfied` and `violated`.
- Even-loop programs with `r :- p. r :- q.` decide `r` under stable models while WFS leaves it `u`. S3 would then decide what M2 says is unfounded.
- On legitimacy: the model does not forbid loops statically. It allows them and requires an *unfounded* finding (§3, M2). If the owner reads it as forbidden, a static check is host-side and independent of the semantic, and S3 gets the same check.
- Amendment:
  - Replace the prediction with: the status and verdict match, and the unfounded finding is absent unless a dependency-graph check is added (record which).
  - Define UNSAT as an explicit result (unfounded or error), never as vacuous consequences.
  - Add witnesses for `p :- not p` and for the `r` case, with predictions. The scope sentence "for the model's negation-loop-free language" in the Axis section should say that stable models differ from WFS on loops.

**6. The flip-test demand cannot satisfy D1, and the subset rule hides that.**
- Flip-test demand is D2 turned into a definition: an atom is demanded iff answering it changes a status. D2 holds by construction, but D1 pulls the other way.
- Counterexample 1: three sections with `o(d,s)` and `require count(S, o(d,S)) >= 2`. Fixing one atom to either value leaves the interval straddling 2, so the demand is empty while the binding is undetermined and resolvable.
- Counterexample 2: `p :- o1, not o2. p :- o2, not o1.`, which is parity. Neither atom alone changes anything.
- "Demand ⊆ expectation" is satisfied by the empty set, so the demand track passes a D1 failure. The random track also does not check demand.
- "Either way" is ambiguous (some value or both). Spell it out. "Or the verdict" adds atoms whose only effect is on a warning weight, which §6 never demands.
- Amendment:
  - State the exact definition.
  - Add D1 (answering `Dem` under every labelling decides every resolvable binding) and D2 to the random track, as `random-brute` does for S1.
  - Add a `count` witness and a parity witness with predictions.
  - Require non-empty S3 demand whenever the oracle says some binding is resolvable and undetermined.
  - If D1 fails, that is the finding. A syntactic cone of influence, which is the model's support, is then the only D1-safe demand, and S3 cannot supply it natively.

**7. Co-varying translation choices.**
- Exclusivity of `choose` labels is a strengthening the model flags as a measured difference (§2). Random has no `choose`, so it is untested there, and on witnesses the "undetermined may be anything" rule hides it.
- Pre-evaluating `in` and `matches` over fact constants is wrong when the operand is derived (`count` then `matches`, the `matches-bound-interval` witness) and removes the §3 static errors. Clingo's own safety errors differ from the kernel's `rejected` results.
- `#count` is exact over completions, so it differs from the interval on correlated atoms, which is a semantic effect the round should attribute.
- Demand uses a different definition (finding 6), not just a different engine.
- Amendment:
  - Run S3 in two arms, with and without exclusivity.
  - Do not pre-evaluate builtins that touch derived or interval operands.
  - Add a `rejected` row for S3, covering non-ground negation and unbound `matches`.
  - Tag every refinement with its cause: tautology, exclusivity or exact count.

**8. The expectations are over-confident or unregistered at the refuting-cell level.**
- "0 contradictions" (medium-high) and "500/500" (medium-high) ignore findings 1, 2 and 4.
- The `m2` row is wrong (finding 5).
- The `overdemand-o-not-o` row lists a demand prediction but not that the verdict flips to NO-GO.
- The corpus row expects "decided equal; at least 1 refined", but out-of-scope `present/3` and interval-`matches` documents would not be equal; they would be skipped. Run a census of the corpus for unsupported features before the run.
- The decision-relevant number is the refined count on the real corpus, because the 240 of 500 random bindings that were left undetermined are an artifact of a generator built to make `p ∨ ¬p`. Round 2 itself says "to be measured on real modules".
- Amendment:
  - Pre-register a numeric guess for the corpus refined count; 0 to 2 seems the likeliest.
  - Record a refuting cell per row.
  - Lower the random row until findings 1, 2 and 4 are fixed.
  - State that a corpus refined count of 0 means the kernel decision does not reopen.

**9. Unmeasured items that would change the kernel decision.**
- Invariant 4 for refined bindings.
  - A binding S3 calls `violated` where S1 says undetermined has no derivation tree and no missing literal. The evidence is "every completion", a case split.
  - A hybrid (S1 for findings, S3 for statuses) is the realistic design. Measure whether S1's descent has anything to report for such a binding, on `overdemand-o-not-o` step 1.
  - Note that reification could give derivations; the plan already mentions this.
- Cost.
  - Two solves per external re-ground each time, since clingo-wasm exposes `run` only, with no assumptions.
  - Report the external count E per step on the corpus and total solves (about 2E + 2), plus a worst case, not only "20× S1".
- The speed row is correctly low confidence; keep it.
- The external domain: which externals are declared for atoms reachable only through derived predicates, and the unaskable-atom check.
- M1 monotonicity across steps and PASS-is-final for S3, a cheap check on the existing multi-step witnesses.

**10. The random track should be primary, but with limits.**
- It is stronger than the witness track on soundness: it uses an independent enumerator (it shares only `loadProgram` and the parser with the reference) and checks cells where the witness rule is lenient. It should be the primary predicate for the soundness and completeness claims, once findings 1, 2 and 4 are fixed.
- It is narrow: one variable, two labels, no `choose`, `count`, `matches`, recursion or loops, and no authored `unknown`. Equality with enumeration is also close to the definition of supervaluation, so it tests the engine and translation, not the hypothesis.
- Amendment:
  - Extend the generator with `choose`, `count`, an `unknown` label and a loop option, or add a second generator class for these.
  - Seed defects per `seeded-defect-gate`: drop the B clause, drop exclusivity, treat UNSAT as vacuous. Each must flip the random predicate.
  - Keep the witness track as feature coverage and corpus as the utility measure.

**11. Predicate mechanics.**
- `--s3` does not exist. The runner's exit code counts only S1 mismatches and prints no `complete` line.
- Define `complete`: false if any step is skipped or out of scope without being listed as an expected failure. A skip is not a pass.
- Make the runner exit non-zero on any unexpected S3 mismatch. Commit one command per track, and record S1's baseline from the same run.
- Add `unexpected-pass` handling for the S3 expected-failure list.

## Verdict

Run after amendments.
