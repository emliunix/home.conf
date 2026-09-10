# Goal-file workstreams & phases — OPEN (2026-09-09)

## User requirements — frozen root

R1 — Restructure the goal file's planning sections so that workstreams (scope
cohesion) and phases (spec-readiness) are two distinct cuts, instead of a single
impl-wave axis that conflates them.

R2 — Define the generative-edge rule that determines which designs must defer
detailed design/review/impl until after an upstream outcome, with an explicit
volatility rubric (V-realization, V-open-decision, V-unknown-behavior,
V-unfrozen-contract, V-transitive).

R3 — Add a parallelizability analysis after workstreams are defined, driven by
dependency edges plus a resource check (env-setup/teardown/leave-it-there/
env-share), reported as a per-phase workstream-level DAG.

R4 — Accept "process is recommendation, not ceremony" as a standing law:
requirements and efficiency toward the goal win over process. Skips/merges/
fastpaths/extra steps are allowed with a one-line reason.

R5 — Provide a copyable template goal file in the goal-file skill that carries
opinionated presets in the root-requirements section — a context compilation for
working agents, not a duplication of the skill.

_frozen from: direct (user refinement of the goal-file skill, 2026-09-09)_

## Analysis

Phase topology is provisional until confirmed; phases are populated one at a
time, not all in one go. The goal file is bookkeeping that is progressively
populated.

## Working background

- Existing target document: `skills/goal-file/goal-authoring.md` (currently has
  `## Impl waves`).
- Related skills referenced, not edited: `flow-common` (lifecycle vocabulary,
  implementation gate, roles, "defines bounded workstreams"),
  `flow-grill-review` (single-reviewer batching, angle tables),
  `flow-retro` (closing pass).
- Demo artifact: this file is written in the structure it defines.

## Additions to the root

(none)

## Design files

- `design/01-goal-file-workstreams-phases.md` — covers R1–R5 — admin
  source: this goal file.

(one design)

## Dependencies

**Scope analysis** (one impl scope per design; a design spanning two scopes is
not well-scoped):

- design/01 — module:goal-file-skill (single design in this sprint)

**Edges:** none (single design). No dependency graph beyond this design.

## Workstreams

## Phase P1 — goal-file-funnel — `populated`

- design/01-goal-file-workstreams-phases — draft — covers R1–R5 — scope
  module:goal-file-skill

There is one workstream in this phase. No parallelizability partition applies
(single workstream). Phase DAG:

```mermaid
flowchart LR
    D[design/01 goal-file-funnel] --> RT[apply change to SKILL.md]
```

**Resource analysis:** none needed beyond the editor; env-setup/teardown not
required for a single-document skill edit.

**Workflow:** Prep → Grill → Defend → (Rematch?) → Implement → Verify → Retro.
Hooks: `[+] template-goal.md` — the copyable template (R5) rides this workstream
as an extra deliverable; `[-] none`.

## Workflow

### design/01-goal-file-workstreams-phases — draft
- **Covers:** R1, R2, R3, R4, R5
- **Scope:** module:goal-file-skill
- **Loop:** `flow-grill-review` → `flow:impl` (`flow-common`) → `flow-retro`
- **Gate:** AC check along Covers to the frozen root (R1–R5)
- **Exit:** impl-loop breakout → `flow-common` breakout adjudication

## Rulings in force

(none yet)

## Review outcome

(pending grill)

## Open threads

- Grill review of design 01 (per `flow-grill-review`) is the next action.

## Worklog

worklog/01-goal-file-workstreams-phases.md

## Worklog ledger

[worklog ledger](worklog/01-goal-file-workstreams-phases.md)
