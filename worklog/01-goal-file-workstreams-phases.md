# Worklog — goal-file workstreams & phases

## C1 — Draft and design rationale

Goal file `goals/2026-09-09-goal-file-funnel.md` records this refinement's
freeze and funnel. Design `design/01-goal-file-workstreams-phases.md` is law
for the workstream/phase model. This ledger holds the decisions and the
trajectory.

## Decisions in force

- **Workstreams vs phases are two cuts.** Workstream = structural/scope
  cohesion (dispatch unit). Phase = epistemic/spec-readiness timeline
  (generative order). Waves are dropped — they conflated both axes.
- **Generative edge wins.** The generative analysis (phases) precedes the scope
  merge (workstreams), and a generative dependency forces a design out into a
  later phase. Phase order: generative → landing → scope merge → resource.
- **Phase states:** `brief` → `populated` → `closed`. Owner = manager
  (supervisor/orchestrator duty). `populated`→`brief` reversion on replan.
- **Three-graph layering:** phase spine (phases, once), per-phase workstream DAG
  (structural, one per phase), per-workstream workflow flowchart (control-flow,
  PASS/FAIL/ESCALATE/ROUTE:/SKIP). Edge vocabulary referenced from `flow-common`,
  not restated.
- **Parallelizability = no structural edge AND no resource edge.** Resource
  analysis adds env-setup/teardown/leave-it-there/env-share. Practical cap 2–3.
- **Status-word home:** per-design line inside its workstream; §5 is a pure
  index. Exactly one home.
- **AC coverage matrix:** admin-owned; a row locks when all covering designs
  across all phases land.
- **Opt-out:** standing clause + proportionality guard; a skip needs a one-line
  reason.
- **Vendoring:** goal file vendors project+goal law for agent context; user
  requirements freeze, principles re-compile.

## Open questions

- None blocking. Design is draft; next step is grill review per
  `flow-grill-review`.
