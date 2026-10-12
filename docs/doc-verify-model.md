# doc-verify model

A definition of what doc-verify computes, derived from the constitution
(`docs/doc-verify-constitution.md`) and nothing else. Every earlier artifact, design 04, the
TypeScript evaluator, kernel-trials round 1, is a lesson consulted (§Lessons), never an
authority: where an earlier artifact and this model disagree, the model decides, and the
disagreement is a finding about the artifact. The model is the reference every kernel is measured
against. Started 2026-10-12.

## 1. Objects

- **Document dump.** A document `D` is a finite set of base facts `F_D`: syntax-tree node facts
  and metadata facts. The host produces it mechanically. *(invariant 7)*
- **Program.** A finite set `P` of clauses over base predicates, derived predicates and oracle
  predicates, plus a finite set of constraints. Clauses may be recursive and may use negation;
  no stratification is required of the author.
- **Oracle.** A declared contract and nothing else: a predicate `o` with input positions, a
  question template, an evidence function `ev_o` from ground inputs to a slice of the dump, a
  threshold `t_o`, and an answer shape: a finite label set `L_o` (a two-label oracle has
  `L_o = {holds, fails}`), or a structured answer, a set of ground facts under a schema, which
  enters as leaves the same way (the whole answer `t` at or above `t_o`, `u` below). The model
  takes the declaration as given and says nothing about whether the oracle is any good; that is
  the oracle toolkit's business (design 05 §Oracle toolkit): fixtures, separation, decisiveness
  and calibration live there, and a kernel is sound *relative to* the declared contracts.
  *(invariant 1; widened 2026-10-12 on the owner's split)*
- **Atom.** A ground oracle application `a = o(i_1 … i_n)`. Its identity is the ground term.
  *(invariant 6)*
- **Answer.** A partial function `ans` from atoms to `L_o`, the judge's chosen label with its
  distribution. The judge is offered the declared labels and nothing else: the engine adds no
  option. `asked(ans) = dom(ans)`: an atom with an answer is asked, whatever the answer means.
- **Valuation map.** Part of the oracle's contract: `v_o` sends an answer to a logical value per
  label atom. Default: the chosen label's atom is `t`, every other label atom `f`. A label the
  author marks **undecided** (a *known unknown*, such as `unknown` or `insufficient_evidence`)
  makes every label atom of the oracle `u`. A chosen label whose distribution value is below `t_o`
  is also `u`. A threshold never turns one label into another. Every `u` an answered atom carries
  is therefore traceable to a line the author wrote. *(re-amended 2026-10-12 on the owner's
  distinction between the hole and the known unknown; this replaces the earlier `unknown ≡ absent`
  and `asked`-carve-out text.)* *(invariant 1; amended 2026-10-12 after review)*
- **Label atom.** For a `choose` oracle, `o(i, l)` for each `l ∈ L_o`; for a two-label oracle,
  `o(i)` stands for `o(i, holds)`.

## 2. Truth values and leaves

Three values, `t`, `f`, `u`, ordered by information `u < t`, `u < f`.

The **leaf valuation** `λ_ans` of a label atom `o(i, l)`:
- `u` if `a ∉ dom(ans)`: the **hole**, an atom not yet asked, the engine's business;
- otherwise `v_o(ans(a))(l)`: the contract's reading of the answer, the author's business, which
  is `t`/`f` by default and `u` for an undecided label or a below-threshold answer.

A base fact is `t` if in `F_D`, else `f`. *(invariant 2 at the leaves: unknown is a value, not a
default.)*

Label atoms of one `choose` oracle are valued independently: before an answer, "some label of `a`
holds" is `u`, although every completion makes it `t`. This is conservative (never unsound) and
can over-demand; a kernel may add the exclusivity rule and claim the tighter reading, which is
then a measured difference, not a defect. *(amended 2026-10-12 after review)*

### Where `u` comes from

During a run, `u` is the transient state of a hole: an atom the host has not asked yet. That is
what makes the demand set computable and the rounds batchable, and it vanishes as answers arrive.
At the end of a **finished** run, a leaf can be `u` for exactly two reasons about the document,
both authored in the oracle's contract: the judge chose a label the author marked undecided (the
known unknown), or the answer did not clear the author's threshold. Either is a deliberate third
verdict, NEEDS-REVIEW, meaning a human decides; an oracle with no undecided label and `t_o = 0`
never produces it.
Two other sources are not about the document and are reported as such: a negative loop in the
module (§3, *unfounded*) and an atom whose evidence does not exist in the dump (an *unaskable*
finding naming the atom; the author's rule produced a question that cannot be posed). A judge
failure after the host's retries is **never** `u`: the run does not continue, the verdict is
BLOCKED (§5, §8). *(added 2026-10-12 on the owner's point)*

## 3. Semantics

The **model** `M(P, F_D, ans)` is the well-founded model of `P ∪ F_D ∪ E_ans`, where `E_ans`
encodes the leaf valuation in two-valued terms: a label atom valued `t` or `f` is a fact or its
absence, and a label atom valued `u` is defined by a negative loop (`u(a) :- not u(a)`), which the
well-founded semantics leaves undefined. Equivalently, it is the alternating fixpoint with each
leaf given as a bound pair. It assigns every ground derived atom one of `t`, `f`, `u`. On programs
whose derived predicates are stratified, this is Kleene's strong three-valued evaluation with the
two bounds of design 04; on unstratified programs it is still defined. *(amended 2026-10-12 after
review: the standard object is named.)*

The constitution needs two properties of `M`, both theorems of the well-founded semantics and
both gates (§8):

- **(M1) Monotone in information.** If `ans ⊆ ans'` (more atoms answered, none changed), then every
  atom that is `t` or `f` under `ans` has the same value under `ans'`. A decided value never flips.
- **(M2) Total when answered.** If every atom reachable from the program is answered with a label
  (no `unknown`) **and the reachable ground program has no negative loop**, every derived atom is
  `t` or `f`. A derived atom left `u` by a negative loop (`p :- not q. q :- not p.`) stays `u`
  under every answer; a binding resting on one is undetermined with an empty support, and the
  kernel reports it as an *unfounded* finding so the author sees the module defect. *(amended
  2026-10-12 after review)*

**Aggregates.** `count(V, G, N)` under `M` is the interval `[c, p]`: `c` is the number of distinct
`V` with `G` = `t`, `p` the number with `G` ≠ `f`. A comparison on an interval is `t` if it holds for
every value in the interval, `f` if for none, `u` otherwise. A kernel whose engine has no
three-valued aggregate must encode this as two queries.

`count` may not range over a predicate that depends on the predicate being defined (aggregates
are stratified), and a comparison on an interval over-approximates when the counted atoms are
correlated, which is conservative only.

**Pattern builtins.** `matches(X, R)` is `t`/`f` on a bound atomic `X` and `u` on an interval. An
unbound `X` is a **static error** of the module, like a non-ground negated goal (§8): no answer
could ever resolve it, so leaving it `u` would break (D1). `present(D, Cs, Ps)` is the derived
predicate: `Ps` is the list of ids in `Cs` that are sections of `D`, in document order (the
`order` fact); it is `f` when none is, so a `forall` over it binds nothing. *(amended 2026-10-12;
the definition is adopted into the model from the README on the second review's ruling.)*

## 4. Constraints and status

A constraint is `c = (B, G, mode, severity, weight, message, repair)` with `mode ∈ {require,
forbid}`. A **binding** is a substitution `θ` with `Bθ ≠ f`. Under `M`:

| mode | satisfied | violated | undetermined |
| --- | --- | --- | --- |
| require | `Gθ = t` (whatever `Bθ`) | `Bθ = t ∧ Gθ = f` | otherwise |
| forbid | `Gθ = f` (whatever `Bθ`) | `Bθ = t ∧ Gθ = t` | otherwise |

A binding with `Bθ = u` is never violated. It **is** satisfied when its goal is already decided
the right way: every completion either drops the binding or satisfies it, so invariant 2 permits
it and demanding the forall's atoms would be waste. *(amended 2026-10-12 after review; design 04
was conservative here.)* A constraint's status is violated if any binding is, else undetermined if
any binding is, else satisfied. A constraint with no binding at all is satisfied unless it declares
`nonempty`, in which case it is violated when no binding has `Bθ ≠ f` and undetermined when every
binding has `Bθ = u`. A `warning` constraint's weight counts once per constraint. *(invariant 2)*

## 5. Verdict

Over the constraints of one document:
- **NO-GO** if any `error` constraint has a violated binding;
- else **BLOCKED** if the kernel did not finish (§6: round cap or budget, or the judge was
  unavailable for a demanded atom); every binding the kernel did not finish is undetermined;
- else **NEEDS-REVIEW** if any `error` constraint has an undetermined binding, or the satisfied
  weight of `warning` constraints over their total weight is below the module's threshold (the
  weighted-ratio rule is a design 04 policy kept for parity, not derived from the constitution);
- else **PASS**.

By (M1) and (M2), PASS under `ans` implies PASS under every total extension of `ans`. That is
invariant 2 as a theorem, and it is a gate.

## 6. Demand and rounds

A **residual derivation** of a ground atom `g` with value `u` is a derivation of `g` in the
program with every `u` leaf kept as a leaf: it reads a `u` label atom as holding and a `u`
negated goal as holding, and is otherwise a derivation. The **support** of an undetermined
binding is the set of label atoms not in `dom(ans)` that occur as leaves of some residual
derivation of its forall instance or its goal instance. The **demand** `Dem(ans)` is the union
of supports over every undetermined binding of every selected constraint, minus `asked(ans)`
(§1). An asked atom is decided, even when the contract decided it as `u`: every policy skips it, and
`prefix` takes the first *demandable* leaf of each residual derivation, so that `prefix` is empty
exactly when `full` is. A binding whose support is empty after the subtraction rests only on
authored `u` leaves: it stays undetermined, it demands nothing, and it ends as NEEDS-REVIEW. *(re-amended 2026-10-12 after the kernel author's counterexample
`ok :- o1, o2` with `o1` answered `unknown`.)* A `u` negated goal whose atom is derived is not a leaf: the residual derivation descends
into that atom's own residual derivations, which is what makes (D1) hold. The support of a
binding is the union over its forall instance and its goal instance when both are `u`. An
undetermined `nonempty` population (§4) has as support the forall leaves of its bindings.
*(re-amended 2026-10-12 after the second review)* *(invariant 3; amended
2026-10-12 after review: the definition is syntactic, and it over-approximates the semantic
relevance of an atom — `p :- o, not o.` has support `{o}` though no answer can make `p` true.
The over-approximation is conservative, never unsound, and is measured by (D3).)*

Three properties; the first two are gates, the third a measurement:
- **(D1) Complete.** Answering every atom of `Dem(ans)` with a label leaves no binding
  undetermined except one that, in the new state, rests only on authored `u` leaves (reported as
  *unresolvable*) or on a negative loop (reported as *unfounded*, §3 M2). Stated this way because
  a binding's support can mix a hole with an authored `u` leaf: answering the hole may leave it
  undetermined, and that is the contract's doing, not the engine's. *(re-amended 2026-10-12 after
  the kernel author's C4 finding, 14 of 200 random programs.)*
- **(D2) Closed.** Answering an atom outside `Dem(ans)` changes no binding's status, where a
  binding that disappears (its forall becomes `f`) counts as satisfied, as §4 treats dropped and
  satisfied alike; (M1) reads the same way.
- **(D3) Relevant.** The share of demanded atoms for which some labelling changes some status.
  A kernel reports it; a lower share is a cost, not a defect.

A **scheduler policy** `π` picks a non-empty subset `π(Dem(ans)) ⊆ Dem(ans)` to ask in a round. It
is declared, not an artifact of clause order. Named policies: `full` (all of `Dem`), `prefix`
(design 04's order: for each residual derivation, only its first unanswered leaf in source order),
and candidates for measurement (`cheapest-evidence`, `most-pruning`). Rounds repeat until
`Dem(ans) = ∅` or a declared cap `R`; reaching the cap with `Dem ≠ ∅` is BLOCKED. For a fixed
program and a judge whose answer to an atom does not depend on what else is asked, every policy
that terminates within `R` and `B` reaches the same final statuses by (M1); policies differ in
cost and in how many rounds they need. *(amended 2026-10-12 after review)*

## 7. Findings

For every binding that is not satisfied, the kernel reports:
- its status and substitution `θ`;
- its **leaves**: the facts and answered label atoms of one derivation (violated) or the residual
  leaves (undetermined), each answered atom with its label, distribution and threshold;
- for a violated `require`, the **missing literal**, by descent: walk `Gθ` left to right; a
  literal valued `t` binds its variables and is passed; a literal valued `u` is noted and passed
  as if it held; the first literal valued `f` is the answer if it is a base fact, a label atom, a
  builtin or a negation, and if it is a derived atom the walk descends into that predicate's
  first clause in source order with the head bound and repeats. Where a `t` literal has several solutions, the walk takes the first in
  **source order**: facts in dump order, then clauses in module order, recursively; so the
  reported literal is a function of the program and the dump, not of an evaluator's internal
  order. The report names the literal and the clause path to it. *(amended 2026-10-12 after review: defined on derived goals and on `u`
  prefixes.)*
- the message and repair with `θ` and params substituted;
- on request, a full derivation tree. *(invariant 4)*

## 8. Boundary and budget

A kernel is a function `K(P, F, ans, π, R, B) → (statuses, Dem, findings, finished)` with no other
input and no other output. It cannot reach the judge, the network or the filesystem; the host
alone asks the judge, sending exactly `ev_o(a)` for each demanded `a` under the outbound policy.
A judge call that fails after the host's retries stops the run: `finished = false`, BLOCKED, and
no atom of that round is recorded as `unknown`. `B` is an inference budget; exceeding it is
`finished = false` (BLOCKED). The static checks the
kernel owes are two: every negated goal is ground when reached, and every `matches` operand is
bound when reached (§3). *(invariant 5; amended 2026-10-12)*

## 9. Gates (properties any kernel must pass, independent of implementation)

| Gate | Seeded witness |
| --- | --- |
| M1 | a program and `ans ⊆ ans'` where some atom flips `t`→`f` or `f`→`t` |
| M2 | a loop-free program and a total `ans` under which some atom is `u`; and a negative-loop program reported as unfounded, not as `t` or `f` |
| PASS is final | a PASS under `ans` and a total extension under which an error constraint is violated |
| Status table | each cell of §4 with a one-rule program |
| Interval count | `count` over one `t` and one `u` tuple compared with 1 and 2 |
| D1 | `Dem` answered, a loop-free binding still undetermined |
| D2 | an atom outside `Dem` answered, a status changed |
| D3 (measure) | the share of demanded atoms that can change a status, per policy, on the corpus |
| Static checks | a non-ground negation or an unbound `matches` accepted instead of rejected |
| Policy invariance | `full` and `prefix`, both terminating within `R`, reaching different final statuses |
| Brute force | random small programs: a status, a verdict or `Dem` closure that disagrees with enumeration over every total extension of `ans` |
| Missing literal | a violated require whose reported literal holds, or an earlier one fails |
| Boundary | a module that reaches the judge, IO or the budget without BLOCKED |

A kernel candidate is measured by these gates, and by cost (judge calls per policy, wall time).
The TypeScript evaluator of design 04 is one candidate among others and is measured the same way.

## Lessons consulted

- **Design 04** gave the two-bound reading, the prefix order, the threshold rule, the status
  table and the verdict precedence. Kept where the constitution needs them; the prefix order is
  demoted to a policy, the depth bound is replaced by `R` and `B`.
- **The TypeScript evaluator** is itself an experiment: unverified, trusted on example tests. Its
  `settled` flag is the `prefix` policy; its interval `count` is §3's aggregate rule and is a
  lesson the well-founded semantics does not supply by itself. Its tests are candidate seeded
  witnesses, with expected values re-derived from this model, never copied.
- **Kernel-trials round 1** showed that an engine's delay list is not the demand, that unknown is
  an encoding at the leaves, that the engine does not check groundness, and that non-stratified
  programs cost nothing to allow. Hence §6's support definition, §2's leaf valuation and §8.
- **The plan review** supplied M1/M2 as the properties that make the two-bound reading and the
  well-founded semantics coincide, and the interval-count gap.
- **The model review (round 2 seat)** found the status table more conservative than invariant 2
  requires, the support definition circular, the missing-literal rule undefined on derived goals,
  M2 false under negative loops, and `matches` on an unbound operand unresolvable; each is amended
  above and marked.

## Change log

- 2026-10-12: started from the constitution; amended the same day after the round-2 independent
  review (see the marked paragraphs). The round-2 witnesses are derived from the amended text.
- 2026-10-12, owner's distinction: the hole (no answer, the engine's `u`) and the known unknown
  (an authored label) are different things; the engine no longer appends an `unknown` option, the
  contract carries a valuation map, and the `asked` carve-out and fall-through rule follow from it
  instead of being special cases.
- 2026-10-12, kernel author's counterexample: under `prefix`, asked-`unknown` leaves are skipped
  with fall-through, so `prefix` and `full` are empty together; "unresolvable binding" defined;
  (D1) restricted to resolvable bindings.
- 2026-10-12, second review (of the reference and its derivation log): `asked(ans)` introduced
  so a threshold-`unknown` atom is never re-asked; `present/3` defined; `not` over a derived `u`
  atom descends; population-row support defined; forall-or-goal support is a union; (M1)/(D2)
  read dropped bindings as satisfied; the missing-literal walk is given a source order.
