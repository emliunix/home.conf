# Round 1 — SWI-Prolog's well-founded semantics as the kernel

Written 2026-10-12 before any probe ran.

## Constitution (the invariants any kernel must preserve)

1. The judge is a fact source, never a decider: one ground atom, one keyed question, one label;
   a threshold only demotes to unknown.
2. Unknown propagates and never resolves on its own: PASS only when the verdict holds under every
   answer the unknowns could take.
3. Ask only what can still change the verdict, in bounded rounds: the demand set is exactly the
   unknown atoms the verdict depends on.
4. Every verdict carries its derivation to the leaves; every violation names what is missing.
5. Finiteness and the trust boundary are enforced before evaluation.
6. Identity is by content, never position.

## Hypothesis

SWI-Prolog's tabled evaluation under the well-founded semantics (WFS), in a runtime doc-verify
can ship, provides invariants 2, 3 and 4 natively: an unknown oracle atom encoded as an undefined
atom makes every dependent atom true, false or undefined with no rule transformation; the engine's
delay list for an undefined answer is the demand set; answers asserted between rounds update the
tables incrementally; a meta-interpreter over the tabled program yields proof trees and missing
literals; and all of it runs over the current corpus in under one second.

**Refuting cell:** any one of K1–K4 below fails in every candidate host.

## Axis

The host runtime of SWI-Prolog. The hypothesis turns on whether the full engine (tabling, WFS
delays, incremental tabling) is available in a runtime the CLI can depend on; the semantics
itself is published and is not under test.

## Candidates

- **C0 — DeepClause sandbox (baseline, not rerun).** Measured 2026-09-29 (worklog 04 C10):
  directives ignored, `call/1` cannot reach user predicates, tabling hangs. Fails by record.
- **C1 — `swipl-wasm` 8.2.2, in-process under Node 26.** The full SWI-Prolog system compiled to
  WebAssembly, installed from npm into `probe/vendor/`.
- **C2 — native `swipl` via subprocess.** Not installed on this machine; installing is a system
  change. Runs only if C1 fails a condition, to tell a WebAssembly limit from a semantic one.

## Pass conditions and predicates

Each condition is one probe program with a printed `complete: true|false` line.

- **K1 — undefined and delays.** A program with a rule depending on an oracle atom `o(a)` that has
  no answer. `violated(c1)` must come back *undefined* (not true, not false), and
  `call_delays(violated(c1), D)` must name the oracle atom in `D`. After `assertz(answered(o(a),
  fails))`, the same query is decided (true) with `D == true`. A second oracle `o(b)` that no
  constraint reaches must not appear in any delay list (invariant 3).
- **K2 — incremental rounds.** With `answered/2` declared `dynamic ... as incremental` and the
  rules tabled `as incremental`, asserting an answer and re-querying (no `abolish_all_tables`)
  returns the updated truth value. The probe also checks the opposite: without `incremental`, the
  stale table persists, so the mechanism is real and not a re-evaluation by accident.
- **K3 — proof tree and missing literal.** A meta-interpreter over the tabled program returns, for
  a true atom, a tree whose leaves are facts and answered oracle atoms, and for a violated
  `require`, the first goal literal that fails (bounded abduction, as the current evaluator does).
- **K4 — corpus scale.** Facts for all 24 governed documents at HEAD (generated from the current
  engine's fact extractor) and the rules of `doc-verify:artifact` + `doc-verify/modules/design.yaml`
  translated by hand. Evaluating every constraint over every document in under 1000 ms, startup
  measured separately.

## Expected outcomes (recorded before the run)

| Condition | C1 swipl-wasm | C2 native | Confidence (C1) |
| --- | --- | --- | --- |
| K1 undefined + delays | pass | pass | high: WFS and `call_delays/2` are core tabling features |
| K2 incremental tabling | pass | pass | medium: incremental tabling is core SWI, but untested in the WASM build by us |
| K3 proof tree | pass | pass | high: a meta-interpreter calling tabled subgoals as leaves is a standard idiom; risk is our own code |
| K4 corpus < 1 s | pass, startup 300–900 ms | pass, startup < 200 ms | medium: WASM tabling speed unmeasured; corpus is ~2000 facts |

If K2 fails in C1 only, the design survives with explicit `abolish_all_tables` between rounds at
the cost of re-evaluation per round; that is recorded as a degraded pass, not a pass.

## Left unmeasured by this round

- Sandboxing untrusted modules (`library(sandbox)` availability in the WASM build).
- Mapping doc-verify modules (`extends`, params, oracles' metadata) onto SWI modules.
- Judge integration and caching; unchanged by the kernel.
- Non-stratified programs (WFS admits them; whether to allow them is a language decision).

## Review (independent seat, sonnet, 2026-10-12)

I read both files, `evaluate.ts` and design 04 §Evaluation. I ran nothing.

**1. Falsifiability.** Only partly.
- The refuting cell is "K1–K4 fail in every candidate host". C0 fails by record. C2 runs only if C1 fails, and it needs a system install the plan has not authorised. If C1 passes, nothing can refute the hypothesis. If C1 fails and C2 cannot run, the cell is unreachable. The plan should say what happens then.
- K1 does not support invariant 3. `o(b)` is "unreached by any constraint", so any implementation passes. The test needs an oracle that is reachable but irrelevant. Examples are a disjunct that is already true, and an oracle behind an unanswered earlier oracle literal in the same rule. `evaluate.ts` asks only when "every oracle literal before it is answered", and delay lists do not encode that left-to-right prefix rule.
- K1 tests only the `fails` answer. It should also cover `holds`, `unknown` and a `choose` oracle with several labels.
- K3 is built by the same author, and it is not compared with `evaluate.ts`'s `Premise` shapes. K4 hand-translates the rules, so it measures speed only.
- Nothing compares verdicts with the current evaluator. A kernel that is fast and wrong passes K1–K4.

**2. Axis.** The runtime is a feasibility axis, not the one the claim turns on. The semantic risk is the encoding of an unknown oracle atom.
- There is no native "undefined fact" in SWI. Getting `undefined` needs either the builtin `undefined/0` or a negative loop such as `o(X) :- tnot(o_neg(X)). o_neg(X) :- tnot(o(X))`. That is a rule transformation, and it makes the program non-stratified. Both contradict "no rule transformation" and "non-stratified left unmeasured".
- Every `choose` label becomes an independent undefined atom. That is acceptable only if it matches the evaluator, where possible mode tries every label independently. The plan does not say so.
- Stratified versus non-stratified, with the encoding held fixed, should be a second axis. It decides whether the Kleene-reading claim holds.

**3. Expectations.**
- Recorded before the run: yes, and the confidence column is useful.
- Vague:
  - "startup 300–900 ms" is a 3x band, and K4 excludes startup. A total over 1 s could still count as a pass.
  - K3 has no stated shape for a pass.
  - K2 lists a "degraded pass" outcome but gives no wall-time threshold for it.
  - The plan does not say how K1–K4 failures roll up into one verdict. Which failures keep the design alive?
- I cannot verify "swipl-wasm 8.2.2". Record `current_prolog_flag(version, V)` and the build's thread, tabling and incremental flags.

**4. Unmeasured, most decision-relevant first.**
1. **Verdict equivalence with `evaluate.ts`.** Compare binding status (`satisfied`/`violated`/`undetermined`) and the demand set per round, over the 24 documents plus seeded cases. The cases should cover `count` intervals, `present`, `matches` on unbound or interval operands, `forbid`, and prefix-settled demand.
2. **Constructs with no WFS counterpart.** `count` returns `[certain, possible]`. `findall` and `aggregate_all` ignore delays, so they need two-bound queries or a rewrite. `matches` and `present` are custom builtins.
3. **Trust boundary and ship cost.** Plan item "sandboxing" is left unmeasured. Invariants 5 and 6 and the WASM bundle size are not measured either. Untrusted modules running in a full Prolog engine is the largest unmeasured risk.

**Technical flags.**
- `call_delays/2` returns only the delay condition of the answer you query. That condition holds the immediate delayed literals, which are intermediate tabled atoms or `tnot` goals, not the oracle leaves. It can contain disjunctions. A demand set needs a transitive walk of the residual program (`call_residual_program/2`). K1 should check that it reaches the leaves.
- `tnot/1` needs a tabled, ground goal. Non-ground negation flounders, and negating a non-tabled predicate is an error. Check the translation against `not G` with an anonymous argument.
- WFS equals the Kleene strong reading on stratified programs over undefined base facts. It does not extend to the encoded program (see 2), and `p :- o. p :- tnot(o).` stays undefined under WFS as well.
- I have not confirmed that incremental tabling and WFS delays combine without limitations in SWI. Test an undefined answer being re-evaluated after `assertz`, not only a true one.

## Amendments after review, before the run (2026-10-12)

Each item corrects the plan above in place; the original text is left so the correction is visible.

- **Correction to the hypothesis.** "with no rule transformation" was wrong. SWI has no undefined base fact; an unanswered oracle atom is encoded by a negative loop through `tnot`, which is a transformation and makes the encoded program non-stratified at the leaves. Amended claim: *the transformation is confined to oracle leaves; the author's rules are untouched.* K1 now also records the exact encoding used, and the Kleene-equivalence claim is scoped to "author rules stratified, leaves encoded".
- **Refutation when C1 fails and C2 cannot run.** The round's verdict is then *unresolved for host*, not refuted and not confirmed; the decision row says so and the next round installs C2 with the owner's consent.
- **K1 strengthened.** (a) Invariant 3 is tested with a reachable-but-irrelevant oracle: a rule `ok(S) :- sect(S), oracle(o1(S)), oracle(o2(S)).` with `o1(a)` unanswered; the demand set for round 1 must contain `o1(a)` and must not contain `o2(a)` (the current evaluator's prefix rule). A second case with a disjunct already true (`ok2(S) :- fact(S). ok2(S) :- oracle(o3(S)).`) must demand nothing. (b) The demand set is computed by a transitive walk of the residual program to oracle leaves, not from `call_delays/2` alone; the probe prints both so the difference is visible. (c) Answers `holds`, `fails` and `unknown` are each tested, and a `choose` oracle with three labels is encoded as one undefined atom per label and tested in positive and negated position. (d) `tnot` over a non-ground goal is tested once to record the floundering behaviour.
- **K2 strengthened.** The re-evaluated answer after `assertz` includes the undefined-to-true and undefined-to-false transitions, not only true. Degraded-pass threshold: re-evaluation per round over the corpus under 500 ms.
- **K3 pass shape.** A term `node(Goal, Children)` with leaves `fact(F)` and `oracle(Atom, Label)`; for a violated require, `missing(Literal)` naming the first failing goal literal under the forall binding. The shapes are compared by eye with `evaluate.ts`'s `Premise` kinds (atom, oracle, not, builtin); exact equivalence is round 2.
- **K4 tightened.** Evaluation under 1000 ms *and* total (startup + consult + evaluation) under 2000 ms; both printed. The build's `version`, tabling and incremental flags are printed.
- **Roll-up rule.** K1 failing refutes the hypothesis for that host (the semantics is unavailable). K4 failing refutes for that host (too slow to ship). K2 failing is a degraded pass under the threshold above. K3 failing is retried once, because it is our code, then recorded as failed.
- **Named for round 2, not this round.** Verdict equivalence with the current evaluator over the 24 documents and seeded cases (count intervals, present, matches on unbound or interval operands, forbid, prefix-settled demand); the constructs without a WFS counterpart (`count` as an interval, `matches`, `present`); the trust boundary (`library(sandbox)` in the WASM build, bundle size). Round 1 is feasibility only; it cannot select the kernel.
