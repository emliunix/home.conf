# doc-verify constitution

The proposition, the roots it rests on, and the invariants any doc-verify kernel must preserve,
each with its root and its falsifier. A design may change anything else. This is a living
document: an invariant is amended only by a design that cites the experiment round whose verdict
selected it, and the amended line names that design. Started 2026-10-12 from the architecture
review and kernel-trials round 1 (design/05); restructured the same day into proposition, roots
and falsifiers after the owner asked whether the constitution is itself well-founded.

## Proposition

A document's conformance to an authored contract can be decided by a program over the document's
structure, with a judge supplying only declared facts, such that a PASS is trustworthy without a
human reading the document, **relative to the oracle contracts the author declared**. Where the
program cannot decide, it routes: a NEEDS-REVIEW names the deciding evidence so the reader, human
or agent, starts there. The tool is a gate with a routing outcome, not a reviewer.

## Roots

Measurements this document rests on; each is cited from a record, none is assumed.

- **R1 Judge probabilities are not calibrated.** A `confidence` of 0.87 beside an argmax
  distribution value of 0.91 on one answer (design/04 §Assumptions and evidence). Hence
  thresholds read the distribution and only demote.
- **R2 Batched answers are correlated and context-dependent.** 8 of 12 scope items came back
  `unknown` without the parent heading and correct with it (design/04). Hence context reaches
  the judge through an atom's arguments, and request shape is an authored knob.
- **R3 Positional binding fails.** 0 of 12 answers bound correctly by position, 12 of 12 by key
  (design/04, commit `d0a02a9`). Hence identity by content.
- **R4 Structural checks decide keylessly and cheaply.** 24 documents, 1509 facts, 14 constraints
  in 2–5 ms (worklog/kernel-trials round 1). Hence structure never waits for the judge.
- **R5 Oracle discrimination is a measured property of each oracle, and it varies.** First
  measured 2026-10-12 (kernel-trials round 3, live): on seeded defects three of five oracles
  separate a gross edit, two let a subtle one pass, and `verification_falsifies` passes both
  (`holds` at 0.97 and 0.99); on the corpus the judge is decisive (no `unknown`) and stable
  (1.00 over 52 atoms, two runs). Hence oracle quality lives outside the engine (design/05
  §Oracle toolkit) and the proposition is conditional on it, per oracle.
- **R6 A check is trusted only once a seeded defect has made it fail** (the repository's
  `seeded-defect-gate` rule; design/04 §Verification design). Hence every invariant below names
  its falsifier, and an invariant without a gate is not in force.

## Invariants

Each line: the invariant, its root, its falsifier (the gate that would show it broken; the gates
are specified in `docs/doc-verify-model.md` §9).

1. **The judge is a fact source, never a decider.** *(widened by design/05 on the owner's split)*
   Every judged thing is one ground atom, one keyed question, one evidence slice, and one answer
   under a declared shape: a label from a fixed set, or a set of ground facts under a schema, and a
   declared reading of each answer into true, false or undecided. The engine offers the judge no
   option the author did not declare, and a threshold can only demote an answer to undecided. A
   "known unknown" is a label the author declares and reads as undecided; the hole, an atom not
   yet asked, is the engine's and is never confused with it. An oracle is a declared contract
   authored with every knob it needs; its quality is measured by its own fixtures, outside the
   engine; the engine is sound relative to the contract and holds no opinion about it.
   *Root:* R1, R2, R5. *Falsifier:* a design that uses a judge number arithmetically, lets a threshold change one label to another, or reads anything about an oracle beyond its declaration (design/05 §Verification, "Oracle split").
2. **Unknown propagates and never resolves on its own.** A verdict is PASS only when it holds under
   every way the unknown atoms could be answered.
   *Root:* the proposition, with R1. *Falsifier:* a PASS that a later answer overturns (model §9 "PASS is final"; M1, M2).
3. **Demand is the engine's; scheduling is a declared policy.** *(amended by design/05)* The demand
   set is exactly the unknown atoms the verdict still depends on, computed by the kernel. Which
   subset is asked in a round is a scheduler policy, declared in the module or the configuration,
   independent of the order rules are written in, and bounded by a round cap. The left-to-right
   prefix order of design 04 is one such policy.
   *Root:* R2, R4 and cost. *Falsifier:* an atom the verdict no longer depends on is demanded, or one it depends on is never demanded (model §9 D1, D2); a result that depends on clause order.
4. **Every non-pass names its deciding evidence and what is missing.** *(clarified by design/05)*
   A finding carries the leaves it rests on (facts and answered atoms), the first goal literal that
   fails for a violated require, and the authored repair. A full derivation is available on
   request; it is a debugging view, not the deliverable.
   *Root:* the proposition's routing clause. *Falsifier:* a non-pass finding without its leaves, its missing literal or its repair (model §9 "Missing literal"; design/04 "Diagnostics complete").
5. **Finiteness and the trust boundary hold by construction.** *(amended by design/05)* The kernel
   runs in an instance with no channel to the judge, the network or the filesystem beyond what the
   host writes into it; evidence leaves only through the host's keyed request under the outbound
   policy. Termination is guaranteed by tabling plus an inference budget; the only static check the
   kernel needs is groundness of negated goals.
   *Root:* the outbound policy of design/02 and R4. *Falsifier:* a module that reaches the judge, the network or the filesystem, or runs past the budget without BLOCKED, or a non-ground negation accepted (model §9 "Boundary", "Static checks").
6. **Identity is by content, never position.** Atoms, evidence hashes, cache keys, answer binding.
   *Root:* R3; a corollary of invariant 2, since an answer bound to the wrong atom makes 2 meaningless. *Falsifier:* two atoms of one oracle receiving each other's answer, or a reordered batch changing any fact (design/04 "Binding by construction").
7. **The fact vocabulary is open.** *(added by design/05)* The host hands the kernel a mechanical
   dump of the document (its syntax tree) and metadata; sections, references, text properties and
   candidate spans are rules over that dump, in libraries an author can read, extend and test with
   the same mutation tables as any module. Nothing structural is decided in the host.
   *Root:* the proposition ("a program over the document's structure") and the architecture review of 2026-10-12 (host-side rules). This is an architectural principle, not a correctness invariant, and is weighed as such. *Falsifier:* a structural rule in the host (design/05 "Open vocabulary" grep gate).

## How this document changes

The repository's rule R6 applies to this document itself: an invariant whose falsifier has not been
seen to fail on a seeded defect is recorded here but is not yet in force; the model's gate table
says which have.

An experiment programme (see `AGENTS.md` §Experiment programmes) runs a preregistered, reviewed
round; its verdict either confirms the invariants as written or selects a change. The change is
written as a numbered design that supersedes the affected sections of earlier designs, and the
line here is amended citing it. A line is never amended by a review, a plan or a commit alone.
