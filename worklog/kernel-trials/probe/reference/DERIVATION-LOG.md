# Derivation log: naive reference and round-2 witnesses

Every place where the reference and a hand-derived witness disagreed, or where either was changed,
with the model section that decides it. The model is `docs/doc-verify-model.md` as amended
2026-10-12. The reference never read `doc-verify/src/engine/evaluate.ts`.

## Corrections

| # | Where | What was wrong | Decided by |
| --- | --- | --- | --- |
| 1 | `witnesses/example-status-table.yaml`, `witnesses/FORMAT.md` (module text) | `{ask: q, evidence: core.own(D, S)}` is a YAML flow mapping; the unquoted comma split it into the keys `core.own(D` and `S)`, so the module did not load in any subject. Quoted it. No expected value changed. | YAML syntax, not the model |
| 2 | `example-status-table` step 1, `missing.req` | The row lacked the clause path. Under the amended descent rule the walk enters `w::ok(d,b)`'s first clause and stops at the label atom, so the row is `{literal: "w::o(d,b)", path: ["w::ok(d,b)#1"]}`. The literal itself was already right. | §7 (amended) |
| 3 | `matches-bound-interval` step 1, `missing.work` | My hand derivation wrote `matches(Notes,'^Work - ')`. `Notes` starts with an uppercase letter, so Prolog requires quotes, and the reference printed `'Notes'`. The witness was wrong; it now reads `matches('Notes','^Work - ')`. | FORMAT.md atom syntax; §1 (an atom is identified by its ground term) |
| 4 | reference: status table | Draft 1 used design 04's table (satisfied needed Bθ = t). It was rewritten to the amended table before any witness was frozen: require is satisfied iff Gθ = t, violated iff Bθ = t ∧ Gθ = f; forbid is the dual. It also gained the constraint-level population rows. | §4 (amended) |
| 5 | reference: demand | Draft 1 took forall leaves only when Bθ = u and goal leaves otherwise, with prefix taken over the joint forall-then-goal derivation. It now takes the residual derivations of the forall instance (when u) and of the goal instance (when u), each as its own derivation for `prefix`. | §6 (amended) |
| 6 | reference: missing literal | Draft 1 reported the first literal whose prefix conjunction was f, or the first u literal before it with status u. It now uses the descent walk: t literals bind, u literals are passed and listed in `passed_u`, and at the first f derived atom the walk enters clause 1 with the head bound. | §7 (amended) |
| 7 | reference: static checks | Draft 1 had no static check of its own (it relied on the design-04 checker). It now has `staticCheck`, which runs on the parsed, unchecked module and rejects a negated goal that is not ground and an unbound `matches` operand. Both `static-*` witnesses are rejected by it before the parser's checker runs. | §3, §8 (amended) |
| 8 | `reference/random-brute.mjs` (the checker, not the reference) | Seed 1, program #18. Answering an atom outside Dem made a forall go from u to f, which dropped a binding that was satisfied (Bθ = u, forbid goal f). The D2, M1 and policy checks counted the missing row as a status change. §4's justification says such a binding is "dropped or satisfied" in every completion, so the checks now compare only non-satisfied rows. A satisfied binding that disappears is not a change. | §4 (amended), §6 D2 |
| 9 | reference: demand | The reference demanded an atom answered `unknown` again, because it treated `unknown` as absent everywhere. Dem is now the residual leaves minus asked(ans) under both policies, so under `prefix` a derivation whose first leaf has been asked contributes nothing. Valuation is unchanged: an `unknown` atom is still a u leaf. `unknown-not-reasked` (written by the kernel author) passes. | §1, §6 (re-amended after the second review) |
| 10 | reference: missing-literal walk | Among several solutions of a t (or u) literal, the walk took the first in fixpoint-table insertion order. It now takes the first in source order: a derived literal's instances are enumerated clause by clause in module order, each body left to right with facts in dump order, recursively; a recursive call already on the stack is skipped and its remaining instances follow. No witness value changed. | §7 (re-amended after the second review) |
| 11 | `overdemand-o-not-o`, header comment | The comment said D3 relevance was 0. It is 1: either label of o(d,a) turns the binding from undetermined to violated, as steps 2 and 3 of the same witness show. What the syntactic support over-approximates is p's truth (no answer makes p true), not o's relevance. The expected statuses and demand are unchanged. | §6 (D3) |
| 12 | `random-brute.mjs` (the checker) | After row 9 the checks had to read asked(ans). D1 now labels Dem together with the `unknown`-answered atoms. D2 now ranges over never-asked atoms only, since a label for an asked-`unknown` atom is new information, not an answer outside Dem. The policy check compares the end state with the total completion only when no atom is `unknown`. I also added the coverage line the seat asked for. | §1, §6 (re-amended) |
| 13 | reference: prefix demand; `random-brute.mjs` D1 | Row 9's prefix rule let an asked leaf end a derivation, so prefix could be empty while full was not. That was the `prefix-stall` finding, and the kernel author's `ok :- o1, o2` counterexample. `prefix` now skips asked leaves and falls through to the next demandable leaf; a derived leaf falls through when none of its residual derivations contributes. The reference reports `unresolvable` bindings (support minus asked(ans) is empty), and the D1 check skips them. After the fix, seeds 1–3 have 0 `prefix-stall` and 0 policy counterexamples. | §6 (re-amended after the kernel author's counterexample) |
| 14 (pending, not applied) | `prefix-unknown-fallthrough` step 2, `missing.c1` (the kernel author's file) | The witness's own comment says the walk "passes o1 (u, noted)", but its expect has no `passed_u`. FORMAT.md requires the u literals passed to be listed, and the reference reports `passed_u: ["w::o1(d,a)"]`, so the witness is wrong. I left it unedited because it is the kernel author's file; the fix is to add `passed_u: ["w::o1(d,a)"]`. | §7; FORMAT.md `missing` rows |
| 15 | `random-brute.mjs` D1 | D1 used to be judged on resolvability before the answers. It is now checked on the state after Dem is answered: a binding still undetermined there must be unresolvable in that new state (its support minus asked atoms is empty; the generator makes no loops). The 116 `D1-partly-asked` cases across seeds 1–3 are not counterexamples under this reading; they are counted as "unresolvable after Dem" in the coverage line. The open D1 finding below is closed by this wording. | §6 (re-amended after the kernel author's C4 finding) |

## Closed finding (row 15): D1 on partly asked supports

`random-brute.mjs 500 1|2|3` exit 1 with 38, 35 and 43 counterexamples, every one of the kind
`D1-partly-asked`. In each, a binding's support contains an asked-`unknown` atom and also at least
one unasked atom. Subtracting asked(ans) leaves the unasked atoms, so §6 calls the binding
resolvable. But answering Dem cannot decide it, because it still rests on the `unknown` leaf.
Example (seed 1, program #45 region; the script prints it verbatim):
- the forall is `section(S), o1(S)` and the goal is `not o2(S)`;
- o2(d,b) is answered `unknown`, so Dem holds o1(d,b);
- with o1(d,b) = holds the binding is still undetermined.

Every such binding is decided once the asked atoms are labelled too (the classifier checks this),
so the reference is consistent. The gap is in the statement of D1. Candidate fix, for the model
author: call a binding resolvable only when its support contains no asked atom. Equivalently,
D1 decides every binding up to its asked leaves.

## Superseded finding (resolved by row 13): prefix stall after the first re-amendment

`node reference/random-brute.mjs 500 1` exits 1 with 4 counterexamples, all of one kind (seed 2: 6,
seed 3: 7, same kind):
- `prefix-stall`: Dem(full) is not empty, but `prefix` is. Every residual derivation of the
  undetermined binding starts with an atom answered `unknown` (asked), so under the
  re-amended prefix rule each contributes nothing. Later leaves, e.g. `w::o1(d,b)` in seed 1
  program #45, are never offered. §6 asks a policy for "a non-empty subset" of Dem, so prefix, as
  re-amended, is not a policy on these states.
- `policy-after-stall`: the full and prefix runs end in different statuses, but only after prefix
  has stalled this way. That conflicts with §6's claim that every terminating policy reaches the
  same final statuses.

Soundness, cover, verdict, M2, M1, D1 (modulo asked) and D2 have no counterexample in 1500
programs. One possible fix, for the model author: under prefix, skip asked leaves and take the
first leaf that has not been asked.

No other hand-derived value disagreed with the reference. All 45 witness steps (including `unknown-not-reasked`) and the corpus step agree.

## Interpretations the reviewing seat should check (the model is silent or ambiguous here)

- *(§6 now states the next two readings and §1 defines present/3; they stay listed for the record.)*
- **`not q` with q derived and u.** §6 calls a u negated goal a leaf, but its leaf there is q, which
  is not a label atom. The reference descends into q's residual derivations and collects their
  label atoms. Stopping at q would leave (D1) unprovable, since q's atoms would never be asked.
  `random-brute` checks D1 under this reading.
- **Support of an undetermined population.** §6 defines Dem over undetermined bindings only.
  A `nonempty` population whose every binding is u (§4) is undetermined, but each of its bindings
  may be satisfied. The reference adds the forall leaves of all its bindings to Dem; without that,
  D1 fails for `nonempty-population` step 1.
- **`matches` on a non-degenerate interval** is u even when no value in it could match (§3 says
  "u on an interval"). This is conservative. A point interval is treated as a number. `matches` on
  a ground list is f, since a list is not atomic text.
- **`in` and comparisons on an interval** use §3's comparison rule: t for every value, f for none,
  u otherwise.
- **Choose labels.** A choose literal with an unbound label ranges over the label atoms, which are
  valued independently (§1, §2 amended). So `yz(d,c)` in `choose-negated` is u, not t.
- **Descent determinism (§7).** When a t literal has several solutions, the walk takes the first t
  solution in enumeration order (fact order, then label order). A u literal takes its first u
  solution. In the witnesses the reported literal never depends on this choice, except in
  `choose-negated` `lab`, where L = x is the only t solution.
- **`present/3`.** The model says only "a derived predicate over node facts". The reference uses
  the README's definition: the candidates D has (`core::section`), in document order
  (`core::order`). With none present it derives nothing.
- **`_` in a negated goal** is treated as non-ground (§8: "every negated goal is ground"). The
  design-04 checker accepts `not p(X, _)`. No witness depends on this; it is listed so the seat can
  rule on it.
- **Warning weight (§5).** A warning constraint counts as satisfied iff every row is satisfied,
  once per constraint. The module threshold defaults to 0, so warnings never move a verdict in
  these witnesses.
- **Corpus.** Each document is evaluated alone, over its own block of `corpus-facts.pl` (§1: a
  document is its own fact set), under the draft profile (constraints without `profiles`).
