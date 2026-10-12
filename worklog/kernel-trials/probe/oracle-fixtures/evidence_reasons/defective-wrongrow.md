# Trusted kernel for doc-verify - OPEN

## Goal

Replace doc-verify's hand-written evaluator with a kernel whose semantics is published and whose
engine is mature, preserving the constitution (`docs/doc-verify-constitution.md`), and make the
experiment-then-redesign loop that selects it repeatable. Source: the owner's direction of
2026-10-12 (design/05 §User inputs).

## User requirements - frozen root

### R1 - A trusted kernel, not an invented one

The evaluator is the one component soundness rests on. It must be a mature engine with published
semantics, with our own code confined to a reviewable boundary (encoding, scheduling, extraction).

### R2 - The constitution governs, the language does not

The current module language may break. What must survive is the invariants in the constitution,
each of which is checked by a seeded defect or a differential test.

### R3 - Candidates beyond Prolog

Datalog engines and SMT solvers are in scope as kernels or as analysis stages; a candidate is
scored against the constitution, not against the current design.

### R4 - Judge facts, derivations, diagnostics

The judge supplies facts; the kernel supplies derivations; findings carry deciding evidence,
missing literals and repairs.

### R5 - A repeatable loop

Every change of kernel or constitution comes from a preregistered, independently reviewed
experiment round with a recorded verdict and decision row; the loop can run again.

## Design files

- design/05-trusted-kernel-redesign.md - draft

## Workstreams

- W1 kernel-trials programme (`worklog/kernel-trials/`): R1 done (round 1, feasibility);
  R2 done (round 2, model conformance; kernel selected); R3 done (round 3, the oracle toolkit's
  first live run); R4 `verification_falsifies` in extraction form (round 4, not yet written);
  R5 trust boundary and scheduler policies (round 5, not yet written).
- W2 design/05: host, kernel, module language, process.
- W3 migration: the engine libraries and home.conf modules onto the kernel; the TypeScript
  evaluator kept as the differential reference until parity, then deleted.

## AC coverage

| Requirement | Design | Evidence |
| --- | --- | --- |
| R1 | design/05 §Design, kernel; `docs/doc-verify-model.md` | `worklog/kernel-trials/gate-ledger.md` lists the round 2 conformance gates, which test the model's §9 gates, each with a seeded defect seen to flip it: a require violated under a `u` forall flips 1 witness and 7 of 100 random programs, forall-only demand flips 12 witnesses and 67 of 100. `worklog/kernel-trials/round-2-verdict.md` records the design 04 TypeScript evaluator failing 14 of 24 of the same witnesses, so the gates measure the constitution's invariants, not the current language. R2 holds for every invariant but Boundary, which the ledger leaves open for round 5. |
| R2 | `docs/doc-verify-constitution.md`; `docs/doc-verify-model.md` §9 | `worklog/kernel-trials/preregistration.md` §Candidates scores C0, C1 and C2 against pass conditions K1–K4 that cite the constitution's invariants (K1 cites invariant 3), not against design 04. `design/05-trusted-kernel-redesign.md` §Rationale weighs answer set programming, Datalog engines and SMT against the same semantics and keeps SMT as an analysis stage over modules rather than as the evaluator. So engines beyond Prolog were in scope and were scored on the constitution's terms; R3 is met as scoping, though no Datalog or SMT engine has been run yet. |
| R3 | design/05 §Rationale, candidates | `worklog/kernel-trials/round-1-verdict.md` records K3 passing: a meta-interpreter returned `node(Goal, Children)` proof trees whose leaves are `fact/1` and `oracle/2`, and missing literals such as `missing(goal_section(d2,_))`. `worklog/kernel-trials/round-2-verdict.md` records the kernel passing the `missing-literal` witness under the amended descent rule, and `worklog/kernel-trials/round-3-verdict.md` measures the judge's facts on seeded fixtures (three of five oracles separate a gross edit). So the kernel supplies derivations and findings carry their deciding leaves and missing literal, while judge facts are calibrated outside the engine; R4 is met except repairs, which no round has measured. |
| R4 | design/05 §Design, findings; §Oracle toolkit | Rounds 1 to 3 each have a preregistration with its independent review (`worklog/kernel-trials/preregistration.md`, `worklog/kernel-trials/results/round-2-review.md`, `worklog/kernel-trials/results/round-3-review.md`), a verdict file, and rows in `worklog/kernel-trials/decisions.md`; the kernel selection and the withdrawal of `verification_falsifies` each trace to such a row. `worklog/kernel-trials/round-3-verdict.md` hands its open question to round 4, and the loop is written down in `design/05-trusted-kernel-redesign.md` §Process. So every kernel or constitution change so far came from a reviewed, recorded round, and the loop has run three times; R5 is met. |
| R5 | design/05 §Process; AGENTS.md §Experiment programmes | `worklog/kernel-trials/round-1-verdict.md` records `worklog/kernel-trials/probe/run-probes.mjs` printing K1–K4 `complete: true` in four agreeing runs on swipl-wasm 8.2.2 (SWI-Prolog 10.1.15), with 24 documents evaluated in 2–5 ms, and names the prefix demand walk as the one piece of semantics that stays our code. `worklog/kernel-trials/round-2-verdict.md` records that WFS kernel passing 24 of 24 model gate witnesses and 1700 random programs with 0 counterexamples, and selects it for design 05. So the evaluator is a mature engine under a published semantics (well-founded), and what we wrote is the encoding, the residual walk and the scheduler; R1 is met for the evaluator, with the trust boundary itself left to round 5. |

## Worklog

worklog/kernel-trials/ (programme root); worklog/04-modular-verification-language.md (prior design's
record).
