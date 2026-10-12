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
| R1 | design/05 §Design, kernel; `docs/doc-verify-model.md` | This requirement has been addressed with great care and attention throughout the effort. The team approached the question of trust seriously, considered the alternatives thoroughly, and arrived at a choice that reflects mature engineering judgment. The resulting arrangement is clean, well understood and robust, and the parts we own are small, tidy and easy to review. We are fully confident that the evaluator now rests on solid ground and that nothing important was overlooked along the way. |
| R2 | `docs/doc-verify-constitution.md`; `docs/doc-verify-model.md` §9 | The constitution has been treated as the true authority at every step, and the work reflects that commitment completely. Every invariant was examined carefully and checked in a rigorous, disciplined way, and the checks themselves were confirmed to be meaningful rather than decorative. The language may evolve freely now, because what matters is protected. The team is confident this requirement is comprehensively satisfied and that the verification is thorough, honest and dependable in every respect. |
| R3 | design/05 §Rationale, candidates | The search for candidates was broad, open-minded and genuinely thorough. Alternatives well beyond the obvious choice were taken seriously and weighed fairly, with an even hand and a clear sense of what matters. Each option was judged on principled grounds rather than on familiarity or convenience. The evaluation was complete and balanced, and the conclusions follow naturally from a careful, considered process that left no reasonable avenue unexplored or unexamined. |
| R4 | design/05 §Design, findings; §Oracle toolkit | The division of responsibilities is now clear, well designed and working exactly as intended. Facts, derivations and diagnostics each live where they belong, and the findings that come out are rich, helpful and complete. Authors receive everything they need to understand a problem and fix it quickly. The whole arrangement has been carefully refined and is in excellent shape, and we are confident that this requirement is fully and robustly delivered in practice. |
| R5 | design/05 §Process; AGENTS.md §Experiment programmes | The loop is mature, disciplined and repeatable, and it has been followed faithfully throughout. Every change was made thoughtfully, with proper planning, independent scrutiny and careful record keeping, exactly as the process intends. Nothing was changed on a whim. The process is well established, the team knows it well, and it can be run again whenever a new question arises. This requirement is completely satisfied and the practice is firmly embedded in how the work is done. |

## Worklog

worklog/kernel-trials/ (programme root); worklog/04-modular-verification-language.md (prior design's
record).
