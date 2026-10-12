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

- W1 kernel-trials programme (`worklog/kernel-trials/`): round 1 feasibility done; round 2
  model conformance; round 3 trust boundary and scheduler policies.
- W2 design/05: host, kernel, module language, process.
- W3 migration: the engine libraries and home.conf modules onto the kernel; the TypeScript
  evaluator kept as the differential reference until parity, then deleted.

## AC coverage

| Requirement | Design | Evidence |
| --- | --- | --- |
| R1 | design/05 §Design, kernel; docs/doc-verify-model.md | kernel-trials round 1 verdict; round 2 model conformance |
| R2 | docs/doc-verify-constitution.md; docs/doc-verify-model.md §9 | the model's gates, seeded (round 2) |
| R3 | design/05 §Rationale, candidates | kernel-trials preregistration §Candidates; Z3 named as an analysis stage |
| R4 | design/05 §Design, findings | kernel-trials K3 |
| R5 | design/05 §Process; AGENTS.md §Experiment programmes | kernel-trials round 1 files; round 2 preregistration |

## Worklog

worklog/kernel-trials/ (programme root); worklog/04-modular-verification-language.md (prior design's
record).
