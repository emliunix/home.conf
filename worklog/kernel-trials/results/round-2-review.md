# Round 2 — independent review (sonnet seat), verbatim

(Received 2026-10-12 before the run. The amendments it caused are in `round-2-preregistration.md`
§Amendments and in the model's marked paragraphs.)

## First review (plan, model, witness format), verbatim

### A. Model defects
- **§2/§3 (1), WFS with three-valued leaves.** This is not the standard object, because WFS is normally defined over two-valued facts. It can be made well-defined: treat each leaf as a bound pair (T0 ⊆ P0), as in the alternating fixpoint, or use the round-1 encoding `u(A):-tnot(u(A))`. M1 then holds, since the operator is monotone in the knowledge order.
  - defect: M2 is false for unstratified programs, which §1 allows. `p:-not q. q:-not p.` is `u` under every total `ans`. fix: restrict M2 to programs with no negative loop among reachable ground atoms. Otherwise say loop-`u` is reported as undetermined with empty Dem, and weaken D1 to "decides every binding that depends on an unanswered atom".
  - defect: "ans ⊆ ans'" does not say how an explicit `unknown` entry relates to an absent one. fix: define `unknown` ≡ absent.
  - defect: `choose` labels are independent leaves. `p:-k(i,x). p:-k(i,y).` is `u` unanswered but `t` under every completion. Sound for invariant 2, but it over-demands. fix: add label exclusivity, or state the conservatism.
- **§3 builtins.** defect: `matches` on an unbound X is `u`, but no leaf can resolve it, so D1 fails. fix: make it a static error like negated-goal groundness. Also state that `count` cannot be recursive through its own predicate.
- **§3 count rule (4).** It is sound and monotone. Comparing an interval over-approximates when atoms are correlated, which is conservative only. No defect beyond that.
- **§4 vs invariant 2 (3).** defect: require with Bθ=u and Gθ=t is "undetermined", yet every completion either drops the binding or satisfies it. The same holds for forbid with Bθ=u and Gθ=f. Invariant 2 permits `satisfied`. The model smuggles in conservatism and demands needless atoms. fix: add those rows, or declare the conservatism and make D2 relative to it. Also unspecified: `nonempty` when every binding has Bθ=u, how a constraint's status is built from its bindings, and whether warning weight is per constraint or per binding.
- **§5 (6).** NO-GO before BLOCKED is justified by M1, but only for violations found by a completed evaluation. defect: §8 gives no status for bindings left unfinished when the budget or cap is hit. fix: unfinished bindings are undetermined. The warning-threshold rule is a design-04 choice, not derived from the constitution; label it so.
- **§6 support (2).** defect: the semantic definition is ill-formed. "Residual derivation" is used before it is defined, and the clause is circular. It also differs from the "leaves of residual derivations" definition. With `p:-o, not o.`, p is `u` in WFS but `f` under both completions. Residual leaves give {o}; the semantic reading gives ∅.
  - defect: D1/D2 are passed by any superset of Dem. D2 is named "Minimal" but only tests that nothing outside Dem matters. fix: define Dem syntactically, rename D2, and add a gate that every demanded atom can change some status.
  - defect: atoms answered `unknown` are neither excluded from Dem nor called "unanswered", so they could be asked forever. fix: Dem excludes any atom in `dom(ans)`.
  - defect: "policies reach the same final statuses" is false when the cap R is hit (prefix needs more rounds than full). fix: condition it on termination within R and B, and on a context-free judge.
- **§7 missing literal (5).** defect: the rule is undefined when an earlier literal is `u`, because "the literals before it hold" is false. It is also undefined when G is a derived predicate or has several clauses. fix: report, per f-derivation, the first `f` literal, descending through rule bodies. A `u` literal before it is noted, not required to be `t`.

### B. Example witness
- Statuses are correct. req: a satisfied, b violated, c undetermined. forb: a violated, b satisfied, c undetermined. All six table cells are covered.
- Demand `{w::o(d,c)}` for both policies is correct. The verdict NO-GO is correct.
- The missing literal disagrees with the model as written. §7 says "first literal of Gθ", and Gθ is `ok(d,b)`, so the model gives `w::ok(d,b)`. The witness expects `w::o(d,b)`, which needs the body descent the model does not define (defect 5).
- FORMAT does not say how non-oracle literals are written (`w::ok(...)`, `core::section(...)`).

### C. Plan falsifiability
- The predicate can fail, but it is weak. It exempts Interval count as an expected failure while the hypothesis says "every gate". An unexpected pass of that gate is not flagged.
- S2 cannot fail the predicate, so only S1 is tested.
- One hand-written program per gate does not test universally quantified properties (M1, M2, D1, D2). The expected values come from the same author as the model, so a shared misreading goes unseen.
- "Uncertain" for S2 D2 is not a registered expectation.
- "Correct the reference in place" lets the model absorb any failure. Require a recorded derivation and a re-review.
- The axis (kernel with model fixed) is right, but the model is itself under review.
- Top three things left unmeasured for "replace the evaluator":
  1. Over-demand and judge-call cost per policy on the corpus. D1/D2 pass trivially for a residual-leaf superset.
  2. Finding content under invariant 4: leaves, repair text, the missing literal on derived goals.
  3. Boundary, budget and groundness (invariant 5), plus unstratified and loop programs, all deferred.
- Suggested addition: random small programs, with the reference computed by brute force over all total extensions.

### D. Coverage gaps
- **Boundary and the budget.** Excluded from this round. Facts: `node(a). node(b). edge(a,b).` Rule: `lonely(X) :- node(X), \+ edge(X,Y).` Constraint: require `lonely(X)`. Expected: rejected or BLOCKED on non-ground negation, not silently `lonely(b)=t`. Add a second case with B=10 on a three-way join, expecting `finished=false`.
- **M2.** The stratified-only reference cannot host a seeded witness. Rules: `p:-not q. q:-not p.` Constraint: require `p`. Answers: none. Expected: undetermined, Dem=∅, NEEDS-REVIEW. This shows M2 and D1 as stated are false.
- **Status table, Bθ=u rows.** Facts: `n(a)`. Oracle: `o(X)`, unanswered. Rule: `g(X):-n(X).` Constraint: forall `n(X), o(X)`, require `g(X)`. Model gives: undetermined, Dem={o(a)}, NEEDS-REVIEW. Invariant 2 allows: satisfied, PASS.
- **Over-demand (D2 minimality).** Rule: `p:-o, not o.` Constraint: require `p`. Model gives: undetermined, Dem={o}. Semantic reading gives: Dem=∅, violated. No gate or witness in the plan catches this.

## Second review (reference and derivation log), verbatim

I read the amended model, the log, `reference.mjs`, `random-brute.mjs` and the nine witnesses. I re-derived each witness's expected values by hand. All nine are correct under the amended model, and the model's own text decides them. That includes the missing-literal rows with `passed_u` and `path`, and the three-step status and demand sequences.

### Seven interpretations
1. **`not q`, q derived and u: accept.** §6 calls a `u` negated goal a leaf, but that leaf is not a label atom. Descending into q's residual derivations is the only reading under which D1 holds. §6 should say so explicitly.
2. **Undetermined `nonempty` population: accept.** §4 makes the row undetermined, but §6 defines support for bindings only. Taking the forall leaves of every binding is the minimal sound choice. §6 needs one sentence for population rows.
3. **`matches` on a non-degenerate interval is u: accept.** This is §3's literal text, and it is conservative. D1 still holds, because the interval narrows as the counted `u` tuples are answered.
4. **Choose labels valued independently: accept.** §2 as amended says exactly this.
5. **`present/3` from the README: reject as a model reading.** §3 gives only "a derived predicate over node facts". The README definition is not model-derived, which breaks the round's rule that the model is the only authority. Accept the content once §3 adopts it. Until then, corpus rows that use `present` do not count as model-derived.
6. **`_` in a negated goal is non-ground: accept.** §8 requires "every negated goal ground", and `_` is a variable. The design-04 checker accepting it is a finding about that artifact.
7. **Warning weight per constraint, one document at a time: accept.** §4 amended and §5 decide the weight. The draft profile is a harness parameter outside the model. The default threshold of 0 means the warning rule is never exercised, so it is untested rather than confirmed.

### Do the stated sections decide each log row?
- **Row 1 (YAML quoting):** no model section decides it, and the log says so.
- **Row 2:** §7 decides the descent. The `goal#1` notation is FORMAT, not the model.
- **Row 3:** the model does not decide the quoting. FORMAT's atom syntax does.
- **Rows 4, 5, 6 and 7:** yes, §4, §6, §7 and §3/§8 respectively.
- **Row 5, one gap:** §6 says "forall instance **or** goal instance". The reference reads this as a union when both are `u`. That is sound but should be stated.
- **Row 8:** §4's justification supports it. §6's wording of M1 and D2 ("changes no binding's status") does not say "modulo satisfied-or-absent". The checker was loosened after a counterexample. Amend the text so the model, not the checker, carries that rule.

### Model defects the reference exposed
- **`unknown` handling contradicts itself.** §1 makes `unknown` equivalent to absent, and §6 demands atoms "not in `dom(ans)`". So a threshold-`unknown` atom stays in Dem and is re-asked every round until the cap, which gives BLOCKED. §2 ("Where u comes from") says the same case ends as NEEDS-REVIEW. fix: Dem excludes atoms the judge has already answered, `unknown` included. Neither the reference nor `random-brute` has a round driver that re-asks, so this is untested.
- **The missing-literal walk is not deterministic.** §7 says a `t` literal "binds its variables" without choosing among several solutions. The reference takes the first in enumeration order, and for derived predicates that is fixpoint insertion order, not source order. fix: specify the order, or compare witnesses against the set of admissible answers.
- **Dem keys differ in a minor way.** The model's Dem is over label atoms; the reference and the witnesses key by oracle atom. This is harmless, because answers are keyed by oracle atom.

### Does `random-brute.mjs` enumerate every total extension?
Yes. It enumerates all 2^k two-label completions (k ≤ 6) of the unanswered or `unknown` atoms. It uses an independent two-valued evaluator and tests soundness, binding coverage, PASS/NO-GO finality, M2, M1, D1, D2 and policy invariance. Soundness, M2 and D1 are not vacuous. A reference that decides wrongly or under-demands fails.

It can still pass vacuously in these ways:
- **Over-demand is never measured.** Demanding every atom passes D1 and D2. D3 is not in the checker.
- **Coverage is not reported.** The checker prints only the program count and a "conservative" count. It does not say how many programs had non-empty Dem, undetermined rows, `nonempty` populations, or `not` over a derived `u` atom.
- **The generator is narrow:** one variable per program, so no joins; two labels only (no choose); non-recursive rules; no `count`, `matches`, `in` or `present`; no unstratified programs.
- **Repeated `unknown` is untested.** Its policy loop always supplies labels.
- **NEEDS-REVIEW is exempt from the verdict check.**

### Is the reference a faithful implementation of the amended model for the stratified fragment?
Yes, with the following exceptions. It implements the amended §4 table, the two-bound stratified evaluation, the §6 residual derivations, the §7 descent, the §3 count interval and the §8 static checks. It does not cover BLOCKED, the cap R, the budget B, or any round driver. Its descent order is not model-specified (above). `present` rests on the README (interpretation 5). Nonempty-population demand and `not q` descent are extensions that need model sentences (interpretations 1 and 2). It throws on unstratified programs, which the witnesses mark `reference: unsupported`. The corpus expected values come from the reference itself, so corpus agreement shows nothing independent. Independence rests on the hand-derived witnesses and the brute-force checker.
