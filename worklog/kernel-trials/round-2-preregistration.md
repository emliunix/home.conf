# Round 2 — conformance of kernels to the model

Written 2026-10-12 before any probe ran, replacing an earlier draft that measured equivalence with
the TypeScript evaluator. That framing was withdrawn on the owner's point that the evaluator is
itself an unverified experiment: agreement between two unverified implementations shows nothing.
The reference is `docs/doc-verify-model.md`. **Review pending**: an independent seat reads this
plan before the run; the run does not start until its review is appended.

## Hypothesis

The WFS kernel (round-1 encoding plus a demand walk over the residual program) passes every gate
of the model (§9) on seeded witnesses derived from the model, and agrees with the model on every
governed document. **Refuting cell:** one gate failed, or one corpus document whose statuses differ
from the model's hand-derived values and the difference is not a defect in the derivation.

## Axis

The kernel under test, with the model fixed. Two subjects, measured the same way; neither is the
reference.

## Candidates

- **S1 — WFS kernel** (swipl-wasm, round-1 encoding, residual walk, `prefix` and `full` policies).
- **S2 — the TypeScript evaluator** of design 04, driven through `runProgram` with a scripted judge.
  It is a subject, not a baseline; its tests are not copied as expected values.

## Witnesses

One program per gate row of model §9, each with its expected statuses and demand sets derived by
hand from the model and written down here before either subject runs. Plus the 24 governed
documents under the draft profile (no answers) and under a scripted judge for two rounds, with the
model's values derived from the facts dump by a naive reference evaluator written for this round
(a direct, slow implementation of model §3–§6 for the stratified fragment, in under 200 lines,
reviewed by the independent seat for faithfulness to the model, not for speed; it reuses the
existing module parser for syntax only, never `evaluate.ts`). Unstratified witnesses are round 3.
The witness format every subject reads is `probe/witnesses/FORMAT.md`.

## Expected outcomes (recorded before the run)

| Gate | S1 WFS kernel | S2 TypeScript evaluator | Confidence |
| --- | --- | --- | --- |
| M1, M2 | pass | pass | high |
| PASS is final | pass | pass | high |
| Status table | pass | pass | high |
| Interval count | **fail until encoded**: WFS has no three-valued aggregate; the core library needs a two-query encoding; recorded as a finding, then re-run | pass | high |
| D1 | pass | pass | medium |
| D2 | pass | **uncertain**: the prefix `settled` rule may demand an atom whose answer cannot change any status when an earlier literal is already `f` under some binding | medium |
| Policy invariance | pass | not applicable (one policy) | medium |
| Missing literal | pass | pass | medium |
| Boundary | not measured this round | not measured | — |
| Corpus, draft | agrees with the reference | agrees with the reference | high |
| Corpus, scripted two rounds | agrees | agrees; demand sets equal under `prefix` | medium (delay order, visflow design 20 F9) |

Where S1 and S2 disagree and both differ from the reference, the reference's derivation is
re-read first; a reference defect is corrected in place and said so.

## Predicate

`probe/run-conformance.mjs` prints one line per gate per subject, `M1 S1 complete: true|false`,
and a diff per mismatch; exits 0 only when S1 passes every gate except those expected to fail above
(printed as `expected-failure`). S2's lines are informational this round.

## Left unmeasured

The boundary gate and scheduler cost (round 3). Performance beyond round 1.

## Review (independent seat, sonnet, 2026-10-12)

The seat reviewed the plan, the model (as the reference), the witness format and the example
witness. Its full text is kept verbatim in `results/round-2-review.md`. Summary of what it found:

- **Model defects**, each now amended in `docs/doc-verify-model.md` and marked `amended 2026-10-12`:
  the well-founded model over three-valued leaves was not named as a standard object (now: the
  encoding by negative loops, equivalently the alternating fixpoint with leaf bounds); M2 is false
  under negative loops (now restricted, with loop-`u` reported as *unfounded*); `unknown` versus
  absent was undefined (now equivalent); independent `choose` labels over-demand (now stated as
  conservative); `matches` on an unbound operand could never be resolved (now a static error);
  the status table was more conservative than invariant 2 allows (now `Gθ = t` satisfies a require
  whatever `Bθ`, and dually for forbid; `nonempty`, constraint status and warning weight defined);
  BLOCKED left unfinished bindings unstated (now undetermined) and the warning ratio was unlabelled
  (now a design 04 policy); the support definition was circular (now syntactic over residual
  derivations, with its over-approximation stated and measured by a new D3); policy invariance was
  unconditional (now conditioned on termination and a context-free judge); the missing-literal rule
  was undefined on derived goals and `u` prefixes (now a descent rule).
- **Example witness**: statuses, demand and verdict correct; the missing literal `w::o(d,b)` is
  correct under the amended descent rule (it was not under the old text).
- **Plan**: an expected failure that passes must be flagged; "correct the reference in place" must
  require a recorded derivation and a re-review; one witness per gate cannot test universal
  properties; S2's D2 expectation must be registered.
- **Coverage**: witnesses for the static checks (non-ground negation), a negative-loop program, the
  `Bθ = u` rows, and over-demand (`p :- o, not o`) were missing.

## Amendments after review, before the run (2026-10-12)

- The model is amended as listed; witnesses are derived from the amended text.
- **New witness class C4, brute force.** Random small programs (2–3 oracles, 2–4 rules, 1–2
  constraints) whose expected statuses, verdict and `Dem` closure are computed by enumerating every
  total extension of `ans`; this tests M1, M2, PASS-is-final, D1 and D2 as universal properties.
- **New witnesses**: `static-nonground-not` (expected: rejected), `m2-negative-loop` (S1 only;
  expected undetermined, empty support, *unfounded* finding, NEEDS-REVIEW; the reference marks it
  unsupported), `status-b-undefined` (the `Bθ = u` rows: expected satisfied when the goal is
  decided), `overdemand-o-not-o` (expected `Dem = {o}`, undetermined; D3 flags it).
- **Predicate**: an expected failure that passes prints `unexpected-pass` and is a recorded
  contradiction of this plan, not a success. S2's registered expectation for `d2-minimal`: it
  demands the irrelevant disjunct atom (an expected mismatch for S2).
- **Reference corrections** require a row in `probe/reference/DERIVATION-LOG.md` citing the model
  section, and the seat re-reads every row before the verdict.
- **Owner's point, folded into the model §2**: `u` at the end of a finished run comes only from a
  threshold demotion; a judge failure after retries is BLOCKED and never `unknown`.
