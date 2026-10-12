# Round 7 plan: independent review (verbatim)

The independent seat (a sonnet subagent) read `round-7-preregistration.md` as first written on
2026-10-13, the gate ledger, the model, the C4 generator and the random track, the round 2 and
4b verdicts, the round 5 review and the two method skills. It ran nothing and edited nothing. Its
review follows unedited; the plan's `## Review` section records how each finding was taken.

---

# Review of the round 7 preregistration (property tests with shrinking, C5)

I read the plan, the gate ledger (items 1, 5, 6), model §3–§6 and §9, `reference/random-brute.mjs`, `kernel2/random.mjs`, `run-conformance.mjs` (`runSeeds`), the round 2 and 4b verdicts, the round 5 review, `core.pl` (`core_choose`, `core_count`), `subject-clingo.mjs` (defect hooks) and the two skills. I ran nothing and edited nothing.

## Blocking findings

**1. K3 cannot be seeded in S1: S1 has no exclusivity to drop. The "exclusivity" property is also mis-specified.**
- `core_choose(A,Labels,L) :- member(L,Labels), core_label(A,L)` values label atoms independently. Model §2 says this is the conservative reading, and that a kernel which adds exclusivity "claims the tighter reading, which is then a measured difference, not a defect".
- On the unmutated S1, "exactly one label true under any completion" cannot hold of its three-valued reading. `p :- o(a,x), o(a,y)` is `u` before an answer, where enumeration says `f`. That is Kleene conservatism, not a failure.
- Exclusivity is a property of the completions the oracle enumerates, not of a subject. It only shows as a difference for S3, which encodes `1 {..} 1` (`subject-clingo.mjs:344`). So it is not a separate property. It is `sound`/`cover` for S1 and exact equality for S3, on programs that mention two labels of one atom.
- Amendment:
  - Drop "exclusivity" as a named property, or restate it as ground-level checks. Under an answer `l`, every other label atom of that atom is `f` (S1 and S3). For S3 only, unanswered `choose` atoms get no two-true completion.
  - Replace K3 with an S1 defect that exists, such as "an answered `choose` leaves the other labels `u`" (a mutation of `core_label`/`core_not_label`). Say which property flips it.
  - Keep S3c as the exclusivity seed.
  - Give the generator a trigger. It must produce two labels of the same `choose` atom in one rule or goal (same section variable, atom unanswered) at a stated share. Independent draws of labels will rarely do that.

**2. The unmutated-S3 expectation contradicts the recorded 4b result. A counterexample on the unmutated kernel "not failing the round" contradicts the refuting-cell list.**
- Round 4b: S3 `--random 500` exits 1 on a known D1 counterexample (program #231, item 5). Round 2 and S1: 38 programs per 500 where a binding resolvable at `ans` is unresolvable after `Dem` (the model's own D1 gap, `d1Weak`).
- The plan expects "0 counterexamples" on unmutated S3 and S1, and does not say how D1 is encoded. If D1 is the model's re-amended wording, S1's `d1Weak` cases are exempt. If it is strict, S1 fails.
- The hypothesis (c) says "finds no counterexample". The refuting cell then says a counterexample is "a real finding, … the round is not failed by it". Either (c) is refuted by it or it is not a claim.
- The honest reading is that this is the first place the shrinker meets a known-positive case. #231 should shrink to a few lines.
- Amendment:
  - State the exact D1 property, copying the `exempt()` and `d1Weak` handling of `kernel2/random.mjs`.
  - Add an `EXPECTED_FAILURES` table, as `run-conformance.mjs` has. S3 × D1 is expected red, with the shrunk program recorded as item 5's minimal witness. Pre-register that cell as "expected: red, shrinks to ≤ N atoms".
  - Split the unmutated-kernel cell by subject. S3 × D1 is a pre-registered finding. Any other counterexample on S1 or S3 is a new finding that fails (c). Say what the round then decides: "the kernel decision is reopened" needs a named criterion, for example a counterexample in `sound`, `M1` or `verdict` on S1, which is unsoundness and not conservatism.
  - Say the gate-ledger command will exit 1 while S3 × D1 stands (as 4b did).

**3. The axis is confounded; a C5 win could be the properties, not the generator.**
- "C4 vs C5" changes four things at once: generator coverage, shrinking, the property set (exclusivity, interval, loop shape, `matches` unbound) and the comparator. A C5 flip of S3b/S3c/K4 can come from any of them.
- The new properties cannot see anything on C4 programs. They have no `choose`, `count` or loops, so they hold vacuously. A "C4 misses it" result would be true by construction.
- Shrinking cannot change a flip at all. It only affects measurement (b), so it is a separate sub-axis.
- Amendment:
  - Run a 2×2 on the random track, not a bare "C4 re-run":
    - Full property set on the C5 generator, with shrinking on (the main arm).
    - The same property code and runner on a C5 generator with the new features switched off, which is C4's grammar. This arm shows that S3b/S3c/K4 are invisible because of the generator and not the property.
    - C5 with shrinking off (`endOnFailure`/no-shrink). It shows that flips do not depend on shrinking, and gives size before and after shrinking.
  - Keep the old C4 script as a historical control only. Its comparator differs (it is a script with its own RNG, not the fast-check runner).
  - The shared `rng` seed and the "same seeds" must mean the same fast-check seed list, listed in the plan.
  - Replace "found by C5 only" in the expectation table with the arm that carries the claim.
  - K1, K2 and S3a are already flipped by C4 (7/100, 67/100, 105/500). They test that the port keeps the old gates, not the axis. Label them controls. The axis rows are K4, S3b, S3c and the S1 version of K3.

**4. The oracle for the widened language is not specified, and for loops it is missing.**
- Positive recursion does admit enumeration. Per completion, compute the least fixpoint per stratum, which is simple and independent. The plan implies enumeration "does not apply" to anything with loops, which over-claims.
- For negative loops, enumeration over two-valued completions of the leaves is not enough. An independent oracle is a ground alternating-fixpoint (WFS) evaluator of about 30 lines. The programs are ground over ≤ 4 sections, so it is small. It should live in the brute-force file and share nothing with `reference.mjs`, `core.pl` or S3.
- S1 is checked against WFS exactly.
- S3 is checked against stable models, and is not equal to WFS: it can decide more (supervaluation). An even loop gives two answer sets and `undetermined`; an odd loop gives UNSAT. Compute cautious and brave consequences by enumerating the subsets of a tiny ground program.
- "UNSAT or undetermined" is not an oracle. State what the model says (statuses and verdict) for a program where an odd loop is reachable and a program where it sits in an unrelated constraint. S3's UNSAT path uses a relaxed forall (`rb`), and the model's M2 says only bindings resting on the loop are undetermined. Write the expected statuses per subject.
- Amendment: add a property × subject table. Each cell names the oracle (completion enumeration, lfp, WFS, stable-model sets) and the comparison (soundness-only for S1 on loop-free programs, exact equality for S3, shape-only where stated). Without it a builder has to invent one, and an invented oracle is not independent.

**5. `count` property: containment cannot flip K4 as written, and the interval is not observable.**
- "The interval contains the count of every completion" is a soundness check. An upper bound that is too high (+1) still contains. Only a too-low bound is caught. The plan does not say which direction K4 goes.
- The interval is observed only through comparison outcomes (`t`/`f`/`u`). A too-wide interval turns `f` into `u`, which is conservatism and the existing checks tolerate it.
- Amendment:
  - K3/K4 must name the direction. Seed both: low (unsound; flipped by `sound`) and high (too wide; needs the exactness property).
  - Exactness: restrict to uncorrelated counted atoms (`count(S, o(d,S), N)` directly over oracle atoms, distinct sections). There, `[c,p]` equals `[min, max]` over completions, and a `cmp` is `t`/`f`/`u` exactly as the enumeration says. Model §3 says correlated counts over-approximate, so exactness cannot be asserted on correlated programs.
  - State the generator's `cmp` shape (operator, constant range) so that the boundary cases `c < K ≤ p` occur at a stated share.

**6. "Minimal under single removal" is checkable but tautological as stated, and unsound for the shrinker it checks.**
- fast-check's shrinker is greedy. Its output is already a local minimum over its own shrink candidates. If the removal check uses the same candidates, it passes by construction.
- Define the neighborhood independently of the shrinker, and larger. Candidates: delete one rule, oracle, constraint, section/fact, `selected` fact or answer entry; delete one body literal; flip `not` to positive; weaken `unknown` to absent; narrow a `choose` to two labels. Minimal means no neighbor fails the same property.
- The plan's "unused rule, oracle or constraint" is a weaker syntactic test and is not the same thing. A rule can be used and unnecessary. Use the neighborhood test and drop the "unused" phrasing.
- Invalid neighbors (dangling predicate, checker-rejected) are skipped. Count them and print the count. Do not treat a skipped neighbor as "no longer fails".
- The check must call the property in the same way as the runner. Under a non-deterministic property it says nothing (finding 7).
- For minimality to be reachable the shrinker needs a neighborhood at least as rich as this one. A "not minimal" cell then points at the arbitrary, not at the kernel.
- Amendment: define the neighborhood list in the plan and give it a ledger name. Report minimal / non-minimal as a count, with the non-minimal program printed. Pre-register a size bound for the K and S3 seeds. Without it, "medium confidence" has no refuting cell.

**7. Determinism: C4 draws extra random values inside the property.**
- `random-brute.mjs` and `kernel2/random.mjs` draw `ans`, `total` (a random completion) and `mid` from the same RNG while checking. Under fast-check, shrinking re-runs the property on shrunk values. Any value drawn from a side RNG changes between runs, so a failing program stops failing and shrinking gives garbage or a non-minimal result.
- Amendment: everything the property uses must be part of the shrinkable value. That covers `ans`, a chosen total completion (as an index or a bit-mask) and the `mid` subset. Alternatively use deterministic functions of the program (for example "every completion", capped). The runner must verify that a counterexample reproduces on a second evaluation before shrinking, and print `non-deterministic` if it does not.
- Rejected programs: C4 does `n -= 1; continue`. Under fast-check use a structural construction that cannot produce checker-rejected programs where the property is not about rejection (see finding 8). A filter loses shrinks and can starve the 500 budget.

## Methodology and coverage findings

**8. Shrinking on structured programs: say what the arbitrary is.**
- fast-check is not vendored (`probe/vendor/package.json` has only `swipl-wasm` and `clingo-wasm`; none of `fast-check` is in the repo's `node_modules` either). The plan must say it is added to `probe/vendor/package.json` with a pinned version, and not to the repository's own, per AGENTS.md. The builder cannot ask.
- Recommend a custom arbitrary on a plain-data AST, built with `fc.record`, `fc.array`, `fc.oneof` and `fc.integer`. It should not use `fc.chain` or `filter`, which degrade shrinking.
- References between pieces (body literal → predicate or oracle, constraint → predicate) are indices resolved modulo the pool at render time. Any sub-AST is then a valid program, deletion is a legal shrink and nothing dangles.
- Predicate stratification is by construction. A rule can only refer to earlier predicates, except where recursion or a loop is switched on.
- `choose` and recursive features are optional fields. Shrinking toward `undefined` removes them.
- State the generator's own invariants: every `matches` operand is bound except in the explicit "unbound" mode, which produces a program the checker may reject, and the expected result is `rejected` computed syntactically.
- A hand-rolled shrinker is only warranted if the AST's built-in shrink cannot reach the finding-6 neighborhood. Say that, and record time and quality either way.

**9. Bias control is stated per feature and the seeds need joint (trigger) coverage.**
- "Each named feature ≥ 10%" is a marginal rate. K4 needs `count` with an undetermined tuple and a boundary `cmp`. S3b needs an odd loop that a constraint depends on. S3c needs two labels of one atom. Their joint rates can be far under 1% even when each feature is 10%.
- At 500 programs a trigger of 1% gives about 5 hits, and "flipped" becomes seed-dependent. A zero-counterexample result is weak (rule of three: about 0.6% at 95% for a failure rate that high).
- Amendment:
  - Print a trigger line per seed ("programs where the seed's site is exercised and can change the outcome"). Pre-register a floor (for example ≥ 20 of 500) and make the claim "narrowed" when it is not met.
  - Report the number of flips among the 500 per seed, not a boolean.
  - For unmutated cells say the bound explicitly.
  - Use at least three fast-check seeds for the seeds table. The plan says one "run".
  - The 5% / 10% rule is also unmeasurable until the grammar's weights are given. Give them (`fc.oneof` weights or `frequency`), or tell the builder to choose weights that meet the floors and record them.

**10. Cost of completion enumeration and the D1 loop is far above the 10 minute estimate.**
- C4 had ≤ 3 sections × ≤ 3 oracles (a few dozen completions). Plan C5: sections ≤ 4, `choose` with 3 labels, more oracles. 12 two-label atoms is 4096 completions per program, and the D1 and policy loops multiply S1 evaluations (`Kernel.create` plus evaluate per labelling, 2^|Dem|). Shrinking repeats the property dozens of times per counterexample. S3 re-grounds and re-solves per probe (5× S1's per-step cost).
- Amendment: cap free atoms at about 10 and `Dem` size for the D1 loop (the generator enforces it, not a skip). Report the shrinker's share. State a per-property timeout and make it `complete: false` when hit. Revise the 10-minute row with the number of evaluations it assumes.

**11. Subject and feature handling that a builder would have to guess.**
- The plan names `reference` as a subject "where it applies". The predicate only takes S1 and S3. Decide: drop the reference from this round, or add `--subject reference`.
- S3 refuses `matches` over a count and `present`, and its scope is not the whole C5 language. Say what happens when a program uses a feature S3 refuses: skipped and counted as out-of-scope, with `complete` computed as "no property skipped" as the plan says. This is a contradiction as written. S3 skips will make `complete: false` every run unless the grammar for S3 is restricted or out-of-scope programs are not counted as skipped properties.
- `matches` needs the fact vocabulary (what text the facts hold, which patterns). S1 uses PCRE (`re_match`), the oracle would use a JS or hand matcher. Restrict patterns to a subset on which they agree (literals, anchors, alternation), and say so.
- `in`, `cmp` and recursion need the base relations. The existing facts are `section(d,s,root)` and `selected(d,s)` only. Recursion over what edge relation? Define the facts the generator can emit.
- `matches` on an unbound operand: the oracle is syntactic ("the operand is not bound by an earlier positive literal"). Define it and say which layer reports `rejected` (checker vs kernel; C4 discards checker rejections).
- How seeds K1 and K2 are applied: these are mutations of `core.pl` and the plan does not say how (in-memory patch via a kernel option, as round 5's hooks do, or a copy). The seeds table in `run-property.mjs --seeds` must apply them without editing the committed file.
- S3's defects exist as `defect:` options (`ignore-body`, `unsat-vacuous`, `no-exclusivity`), so S3a–c are cheap. K1–K4 need hooks.

**12. Property list, naming and what is compared per subject.**
- The plan's seed table says S3a is flipped by `sound`. The 4b result shows `ignore-body` flips by exact equality to enumeration (105/500 "unequal"). `sound` alone may not flip it if the mutation is conservative. Add the S3 exactness property and correct the "predicted property" cell.
- The old C4 checks are the plan's property list ("sound, cover, verdict, M1, M2, D1, D2, policy invariance"). The model §9 gates not covered: PASS is final (stated as verdict), Status table (witness grain), Interval count (the new property), Static checks (only `matches`; non-ground negation is absent), Missing literal (absent, and recursion makes it the likeliest to hide a defect), Boundary (round 5). Say which are out of scope, and list Missing literal and non-ground negation under "Left unmeasured".
- Policy invariance with loops and `unknown` answers: C4 only checks policies at `Dem = ∅`. Loop programs end undetermined and `Dem` may stall (prefix-stall). State the property on loop programs.

**13. Loop-shape property for S1.**
- "The shape of the report" for a negative loop is unspecified. Define it: the binding is `undetermined`, listed under `unfounded` (not `unresolvable`), `Dem` contains no atom that decides it, D1 is exempt for it, and the verdict is NEEDS-REVIEW if an error constraint rests on it. That is what `kernel2/random.mjs` exempts today. Without a definition S3b's predicted flip (the "M2 loops" property) is not checkable, since S3b's mutation is a PASS with empty statuses, and the property has to be "verdict is not PASS when a reachable odd loop makes a row undetermined".

**14. `complete` flags and exit codes.**
- `complete: false` conditions listed (property skipped, seed not applied, counterexample without shrunk program) are good. Add: seed trigger floor not met; feature coverage under 5% (the plan lists this as "narrowed", so it must be a flag); a minimality check that could not run; timeout; a subject skip that a pre-registered expected-failure does not cover.
- Exit non-zero on a refuting cell but zero on a pre-registered expected red (S3 × D1), with a printed line "expected". Otherwise the command is permanently red.

## Unmeasured that would change the decision

**15. The plan should state these as left unmeasured, with why each does or does not change the kernel decision.**
- The D1 gap of the model itself (S1's 38 per 500 programs, `d1Weak`). It is a property of the definition, not of any subject, so the amended wording (finding 2) is an input to every D1 cell. If C5 finds a new class where the amended D1 fails on S1, the model text moves, not the kernel.
- Item 5 (single-flip demand of S3). The round should produce the shrunk witness and decide: the cone (S1's) is the only D1-safe demand known. Say whether a second class of D1 miss on S3 would change "S3 is a differential reference" or not. It should not, but write it.
- `present/3` (already listed) and Missing literal (not listed).
- Whether a counterexample on a loop program exercises the kernel or the S3-versus-WFS gap (supervaluation refinement). Tag the cause as 4b did.
- Multi-step `ans` growth (M1 is checked on one extension; sequences are not), real documents versus random (the 240/500 conservatism figure is the generator's).

## Builder guesses to remove (consolidated)

1. The vendor location and pinned version of `fast-check`; no network assumed.
2. The AST and its resolve-by-modulo reference scheme (finding 8).
3. Generator weights, the free-atom cap, the `Dem` cap (findings 9, 10).
4. The fact vocabulary for recursion, `in`, `matches` and `cmp`.
5. The loop oracle per subject (WFS and stable models) and the expected statuses for reachable and unreachable odd loops (finding 4).
6. How K1–K4 are applied without editing `core.pl`.
7. The S1/S3 per-property comparator table (soundness only versus exact equality).
8. The minimality neighborhood (finding 6) and treatment of invalid neighbors.
9. What the runner does when a subject refuses a feature.
10. How `rejected` is defined for unbound `matches`.
11. Where results are written (`results/round-7-<subject>.md`, `results/round-7-seeds.md`) and which files are the C4 comparison arm.
12. The fast-check seed list and the number of programs per seed/arm.

## Verdict on the axis, seeds and hypothesis as a whole

The hypothesis is falsifiable by a seed table plus coverage, once finding 1 (K3 absent in S1), finding 2 (the contradicting cells) and finding 3 (the 2×2) are fixed. As written: K3 is unseedable, the unmutated-S3 expectation contradicts a recorded result, three of the seven seeds are controls rather than axis tests, and the loop oracle is not defined. The property tests themselves (sound, cover, M1, M2, D1, D2, policy) are the right port of the model §9 gates. Everything the plan adds beyond C4 needs the amendments above before a builder can implement it without guessing.

run after amendments
