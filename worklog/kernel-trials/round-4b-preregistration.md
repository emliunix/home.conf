# Round 4b — clingo with open externals as a third kernel subject

Written 2026-10-13 before any run; amended the same day after the independent review
(`results/round-4b-review.md`, verbatim) and before the run. Round 2 selected the SWI
well-founded-semantics kernel (S1) against the model. Its encoding of an unasked oracle atom (a
negative loop giving `u`, then a residual-program walk for demand) is hand-made, is the source
of every friction item in `friction-swipl-wasm.md`, and leaves 240 of 500 random bindings undetermined
that enumeration over every total answer decides (round 2 verdict, "Kleene conservatism"). The
owner's direction widens the candidate set beyond Prolog (goal 04 R3). This round adds clingo
(answer set programming, free `#external` atoms) as subject S3 in the existing conformance
runner, and says in advance what a pass would and would not reopen.

## What is being tested, honestly

The review is right that "supervaluation refines WFS on loop-free programs" is close to a
theorem (model §3 M1): a value WFS decides holds in every completion. So the witness and random
tracks are a **conformance check of the translation and the engine**, not a test of the
semantic axis. What the round measures that is not a theorem: (a) whether S3 reproduces the
model's statuses, verdict and demand exactly where the model decides (soundness of the
translation); (b) whether S3 decides everything enumeration decides (completeness); (c) the
**refined count on the real corpus**, which is the only number that bears on the kernel
decision (the 240/500 random figure comes from a generator that makes `p ∨ ¬p` on purpose);
(d) what S3 cannot give (derivations, missing literals, D1-safe demand) and at what cost.

## Hypothesis

Two predicates, both on the random track as primary and the witnesses as feature coverage:
**soundness**: every status, verdict and demand element the model's reference decides, S3
decides the same way; **completeness**: every binding enumeration over total answers decides,
S3 decides, identically. **Refuting cells:** one binding the reference calls `satisfied` or
`violated` that S3 calls otherwise; one PASS or NO-GO the reference gives that S3 gives
otherwise; one enumeration-decided binding S3 leaves undetermined or decides differently; a
D1 or D2 failure of S3's demand on a random program; a program the static checks accept that
S3 reports unsatisfiable without saying so.

## Axis

The semantics of the unasked atom: WFS undefined (S1, S2) against supervaluation over all total
answers (S3: cautious and brave consequences over free externals). The review names three
translation choices that co-vary and are now controlled: `choose` exclusivity (noted; an arm
without it is left for later), pre-evaluated builtins (now refused on derived operands, mirroring
the kernel's static `rejected`), and the demand definition (now stated exactly and tested by D1
and D2). Stable models differ from WFS on loops; the model allows loops and reports them
*unfounded*, so S3's handling of loops is measured, not assumed away.

## Candidate: S3, `probe/kernel3/subject-clingo.mjs`

- Runtime `clingo-wasm` 0.6.0 (clingo 5.8.1), vendored under `probe/vendor/`.
- Translation from the reference's parsed program: ASP rules; `in` and `matches` pre-evaluated
  only over fact-bound operands, a derived or count operand is `rejected` with the reason;
  `count` as `#count`; two-label oracles as one free external per unasked ground atom; `choose`
  oracles as one atom per label with an exactly-one choice when unasked; an atom answered
  `unknown` (or a known-unknown label) as a **free external that is never demanded** (model §6
  `asked`), and any binding this decides where the model says undetermined is tagged
  `authored-u` and reported apart from hole refinements.
- Status per binding over answer sets, model §4: bindings are the substitutions whose `forall`
  body B holds in some answer set; `require` is `satisfied` iff every answer set has B false or G
  true, `violated` iff every answer set has B true and G false, else `undetermined`; `forbid`
  symmetric; `nonempty` the same way. Verdict from statuses as §5 (the reference's logic); the
  "joint" verdict (some error constraint violated in every answer set) printed as a separate
  column, not compared.
- UNSAT (no answer set) is an explicit result: every status `undetermined`, verdict
  NEEDS-REVIEW, and a printed finding; never vacuous consequences.
- Demand, exactly: a free external e is demanded iff there is a label v such that fixing e := v
  changes the status of some binding relative to the unfixed solve. `prefix` not reproduced.
  Missing literals and proof trees not produced.

## Comparison rule (the S3 mode of `compare`)

Against a witness expectation: `satisfied` and `violated` must match; `undetermined` may be
decided by S3 (counted as *refined*, tagged tautology / exclusivity / exact-count / authored-u /
other); NEEDS-REVIEW may refine to PASS or NO-GO, PASS, NO-GO and BLOCKED must match;
`demand.full` under S3 must be a subset of the expectation's **and** non-empty whenever S3 leaves
a resolvable binding undetermined; `prefix` and `missing` not compared; `rejected` compared.
Against enumeration (`--random N`): statuses and status-derived verdict equal exactly; D1 (every
labelling of S3's demand decides every binding enumeration can decide) and D2 (fixing any one
atom outside S3's demand changes no status) checked and counterexamples printed.

## Seeded defects (`seeded-defect-gate`)

Three seeds, each of which must flip at least one random or witness result: the status rule
ignoring B; UNSAT treated as vacuous; `choose` exclusivity dropped. A seed that flips nothing
means the track cannot see that defect, and is recorded.

## Measurements

- Witnesses: 24 files, per step, S1 and S3 side by side; mismatches by class; `rejected` rows.
- Random: 500 programs, seed 1; equality with enumeration; D1/D2; the seeds.
- Corpus: `corpus-draft.yaml` (24 documents), after a census of unsupported features
  (`present/3`, interval `matches`) listed as expected skips; decided statuses equal to S1's;
  the refined count, tagged.
- Cost: externals E per step on the corpus, solves (2E + 2) and wall time against S1.
- Friction: every inconvenience with clingo-wasm filed as a visflow design record.

## Expected outcomes (recorded before the run)

| Track | Expectation | Refuting cell | Confidence |
| --- | --- | --- | --- |
| witnesses, decided statuses | 0 contradictions | any | medium (findings 1, 2, 4 of the review are now in the spec, not yet exercised) |
| witnesses, refinements | `status-b-undefined*`, `overdemand-o-not-o` step 1 (predicted **NO-GO**, `p :- o, not o` false in every completion, demand empty), `prefix-unknown-fallthrough`; each tagged tautology | a refinement tagged `other` | medium |
| witnesses, loops | `m2-negative-loop` (even loop, two answer sets) matches statuses and verdict; its `unfounded` finding is S1-only and not compared | S3 decides what M2 calls unfounded | medium |
| witnesses, expected failures | `present-candidates` (out of scope); any witness whose only mismatch is `prefix` or `missing` is not a failure under the S3 rule | an `unexpected-pass` on the list | high |
| random, equality | 500/500 statuses and verdicts equal to enumeration | one inequality | medium |
| random, D1/D2 | D2 holds by construction; **D1 fails** on a parity-shaped or threshold-count program if the generator produces one (the review's two counterexamples); the failure is the finding, and the syntactic cone is then the only D1-safe demand | — | medium |
| seeds | 3/3 flip | a seed that flips nothing | medium-high |
| corpus, refined count | **0 to 2** refined bindings over 24 documents; 0 means the kernel decision does not reopen on utility grounds | — | medium |
| corpus, decided | every decided status equal to S1's | any | medium-high |
| cost | solves per step 2E + 2 with E ≤ 12 on the corpus; wall time within 20× S1 | — | low |

**Reading.** A pass on soundness and completeness with a corpus refined count of 0 says: S3 is a
correct second implementation of the model's decided part and adds nothing on real documents;
the kernel stays S1 and S3 becomes a differential reference. A corpus refined count above 0 with
derivations absent says: the realistic design is a hybrid (S3 for statuses, S1 for findings),
to be designed, not adopted here. A soundness failure not explained by a translation bug says
supervaluation is not a refinement of the model as written, and S3 is rejected as a kernel.

## Predicate

```sh
node worklog/kernel-trials/probe/run-conformance.mjs --s3                  # witnesses
node worklog/kernel-trials/probe/run-conformance.mjs --s3 --corpus
node worklog/kernel-trials/probe/run-conformance.mjs --s3 --random 500     # primary: equality, D1, D2
node worklog/kernel-trials/probe/run-conformance.mjs --s3 --s3-seeds       # the three seeds
```

Each prints per-witness `pass`, `refined`, `expected-failure`, `unexpected-pass` or `FAIL` for
S3, exits non-zero on an unexpected S3 mismatch, and ends `complete: true|false` (false if any
step was skipped or out of scope without being on the expected-failure list).

## Left unmeasured

Proof trees and missing literals from clingo (reification could give derivations; not
attempted); the two-arm exclusivity experiment; a generator with `choose`, `count`, `unknown`
labels and loops (the review's item 10; the random track stays narrow this round and says so);
M1 across steps and PASS-is-final for S3 (cheap; added if the implementer has time, else next
round); judge interaction; the scheduler (round 5).

## Review

`results/round-4b-review.md`, eleven findings, "run after amendments". Taken before the run and
sent to the implementation seat as the spec: 1 (status over B and G), 2 (verdict ordering, joint
verdict column, `overdemand` step 1 predicted NO-GO), 3 (soundness and completeness split;
enumeration as the oracle; the theorem acknowledged), 4 (authored-`u` as free and never demanded,
tagged), 5 (`m2-negative-loop` expected to match; UNSAT explicit; loop witnesses deferred to the
generator item), 6 (demand stated exactly; D1/D2 on the random track), 7 (builtins refused on
derived operands; `rejected` row; refinements tagged; the exclusivity arm left unmeasured), 8
(corpus refined count pre-registered at 0–2; confidence lowered; census before the corpus run),
9 (cost as solves per step; derivations named as the hybrid question), 10 (random primary; three
seeds; generator extension left unmeasured), 11 (`--s3`, exit code, `complete`, `unexpected-pass`).
