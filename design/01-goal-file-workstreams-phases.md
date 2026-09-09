# 01 — Workstreams, phases, and the three-graph funnel

## Problem statement

The goal file's planning sections model one axis — impl waves — that conflates
two different partial orders. Structural cohesion (which designs belong together
by scope) and spec-readiness (which designs can be fully specified now versus
must wait for an upstream outcome) are treated as one, so either the schedule is
written speculatively or volatile designs are forced to be fully specified too
early and then redone. Planning needs two cuts: workstreams (scope) and phases
(spec-readiness), expressed as a small set of rendered graphs with per-workstream
hooks — while staying compact enough to remain a ledger, not a second design doc.

## Scope — what we touch

- `skills/goal-file/SKILL.md` — restructure Impl waves → Workstreams + Phases;
  add the three-graph model, generative-edge rule, resource/parallelizability
  partition, phase states and owner, AC coverage matrix, opt-out clause.
- `skills/goal-file/template-goal.md` — new copyable template with opinionated
  presets in the root requirements section.
- `goals/2026-09-09-goal-file-funnel.md` — this refinement's own goal file
  (demonstrates the new structure).
- `design/01-goal-file-workstreams-phases.md` and
  `worklog/01-goal-file-workstreams-phases.md` — this refinement's design + worklog.

- Non-goals: the `flow-*` skills themselves (referenced, not edited), the flow
  edge-label vocabulary (owned by `flow-common`), the freeze semantics of user
  requirements (unchanged), and the design-body content of any live sprint.

## Rationale

The split is necessary because workstream cohesion and spec-maturity are
genuinely different partial orders: a design can be contract-specifiable early
but land late, and a design can be scope-adjacent yet generatively dependent on
an upstream outcome. Modeling phases as the spec timeline, workstreams as the
structural and dispatch unit, and a rendered graph per phase as the
parallelizability view gives each axis its own artifact. Rendered graphs serve
the supervisor's need to see sequence and parallelism at a glance; hooks carry
"process is recommendation, not ceremony" as a structural feature rather than a
verbal admonition.

## Generative edge rule

An edge is **generative** when the downstream design's body cannot be written
truthfully until the upstream produces a fact. This is the only rule that moves
a design between phases.

**Interface dependency (not generative):** downstream consumes the upstream's
declared contract — names, types, wire shape, object-model identity. If that
contract is frozen in the root, or stated non-volatile in the upstream, the
design is specifiable now against the contract.

**Realization dependency (generative):** downstream consumes a fact the upstream
produces — the actual semantics, a concrete algorithm's behavior, a downstream
artifact it emits, a measured value on real data.

Volatility rubric — mark generative if ANY is true:

| Signal | Generative when |
| --- | --- |
| V-realization | downstream consumes the realization, not the contract (decisive) |
| V-open-decision | upstream carries an unresolved named defer/P1 that changes its shape |
| V-unknown-behavior | upstream behavior on real data is uncertain until built |
| V-unfrozen-contract | upstream's contract is not frozen; can change during impl without a goal amendment |
| V-transitive | upstream is itself downstream of a generative edge |

## Order of passes

1. **Generative analysis** → spec timeline (phases). Topological order of the
   generative graph. The only rule that moves a design between phases.
2. **Landing analysis** → structural edges (generative + interface-only). The
   impl/dispatch order; independent of phase.
3. **Scope merge** → within a phase, coalesce by scope bucket into workstreams.
   Never across a generative edge. A workstream's designs must share one phase;
   if a merge spans phases, it did not cohere — split it.
4. **Resource analysis** → parallelizability partition.

Property this buys: a design can be spec-early, land-late (interface-only
dependency) — full body in phase 1, implemented in phase 3.

## Three-graph layering

| Graph | Nodes | Edges | When rendered | Edge label |
| --- | --- | --- | --- | --- |
| Phase spine | phases | generative order | once, top of funnel | phase name + state (brief/populated/closed) |
| Per-phase workstream DAG | workstreams | inter-workstream dependency | one per phase | dependency reason / scope |
| Per-workstream workflow flowchart | lifecycle steps | gate transitions | inside each workstream | PASS / FAIL / ESCALATE / ROUTE: / SKIP |

The phase DAG is inter-workstream only; intra-workstream design edges live in
that workstream's own flowchart. Cross-phase edges are not drawn in a phase — the
phase ordering encodes them; a trailing workstream carries a one-line
"feeds phase Y" pointer.

A `brief` phase renders as a skeleton DAG (workstream nodes + edges, no workflow
detail), so the whole funnel is visible as a spine of phase skeletons at a
glance; only the current phase blossoms into full per-workstream flowcharts.

## Per-workstream workflow flowchart

A flowchart over process steps, not a lifecycle state machine. The four-word
status table stays the source of truth for status; the flowchart shows route.

**Node vocabulary** (fixed set; omit what does not apply, never pad):

| Node | Type | What it is |
| --- | --- | --- |
| Prep | action | read goals/root + Prep skills + this design's Covers path |
| Grill | decision | independent review; angle batch runs here |
| Defend | decision | adjudicate findings; fix accepted P1s (smallest correction) |
| Rematch | action | P1-triggered re-review only |
| Implement | decision | implementation gate (round budget, slices) |
| Verify | action | fresh evidence for covered AC rows |
| Retro | action | closing pass; first-principles bottom line |

Spine: `Prep → Grill → Defend → (Rematch?) → Implement → Verify → Retro`.

**Edge labels** (match condition):

| Label | From | Routes to |
| --- | --- | --- |
| PASS | any decision | next spine step |
| NEEDS-FIX | Grill | Defend |
| FAIL | Grill (blocker) / Defend (wrong-scope) / Implement (design mismatch) | Defend / adjudication / appropriate loop |
| ESCALATE | Defend / Verify / Implement | supervisor gate (re-warm + dispatch decision) |
| ROUTE: BREAKOUT | Implement | flow-common breakout adjudication |
| ROUTE: SUPERSEDE | Implement / retro | new design/NN; old file notes Superseded by: |
| ROUTE: DEFER | Defend | named-missing-evidence decision; a P1 defer blocks the gate |
| SKIP | any | step omitted; one-line reason in worklog |

**Status mapping** (flow exits → lifecycle table): Grill pass → `reviewed`;
Implement pass → `pending-retro`; Retro pass → `landed`; BREAKOUT revert →
`draft`; SUPERSEDE keeps last status + `Superseded by:`. **FAIL never sets a
status** — it routes to adjudication, still inside `draft`.

**Hooks** are typed slots on an edge: `[+step]` injection or `[-step]` skip,
annotated with the goal/scope reason.

**Legend is mandatory** (flow-common reporting convention): node-shape meaning,
edge-label meaning, status-code mapping, abbreviations.

## Phase states, owner, transitions

States: `brief` (one-line purpose + design list only — no bodies/grill/impl) →
`populated` (brief expanded to full design bodies) → `closed` (all designs landed;
the phase's work is done).

Owner: the manager, holding the supervisor/orchestrator duty — the seat that
defines bounded workstreams and gates `reviewed`/`pending-retro`.

Trigger `brief`→`populated`: all upstream generative deps at their threshold —
`landed` for outcome-volatile (V-realization), `reviewed` for content-volatile.
Recorded in the worklog with which upstream stabilized.

Reversion `populated`→`brief`: replan after a breach or supersession — when a
design turns out volatile late, escalate, replan the phase, move the design to a
later phase, and revert the current phase to `brief` if its brief was built on a
now-dead assumption.

Each transition is a dated worklog entry with the triggering evidence.

## Resource analysis and parallelizability

The phase DAG's edges are typed. Two classes: **structural** (dependency) and
**resource** (env/state constraint). Resource analysis adds nodes and edges:

| Resource node | Position | Purpose |
| --- | --- | --- |
| env-setup | pre-fan-out | provision test/mock env before parallel dispatch |
| env-teardown | post-fan-in | restore/clean after the phase's workstreams finish |
| leave-it-there | annotation | which residue persists (or is required) for the next phase |
| env-share (edge) | between workstreams | shared writable env/resource → serialize, or snapshot per seat |

**Parallelizability = no structural edge AND no resource edge** between two
workstreams. This closes the default-consistency bug class (two workstreams
editing one shared file with no edge between them). Also cap practical
parallelism (2–3): one manager cannot deeply re-warm on many concurrent
workstreams.

## Opt-out and proportionality

Standing clause: process is recommendation, not ceremony; requirements and
efficiency toward the goal win over process. Skips need a recorded one-line
reason (worklog). Proportionality: a one-workstream, low-volatility goal renders
no phase spine, no partition, no per-workstream graphs beyond what is needed —
that explicit decision, not an omission.

## LAW tier: vendoring

The goal file vendors the project + goal tier of standing law for agent context;
references the `flow-*` process tier and design bodies by pointer. User
requirements freeze; principles re-compile on project-law change. Vendored law
carries `vendored from: <path> (date, ref)`.

## Status-word home

The status word lives on the per-design line inside its workstream:
`design/NN — <status> — covers R#/A# — scope`. §5 Design files is a pure index
(path — name — workstream — phase). Phase state lives on the phase line. One
canonical home per status word.

## AC coverage matrix

Admin-owned. The design names the rows it covers (a/b/c); the admin maintains
which rows are covered by which designs across which phases. A row locks when all
its covering designs across all phases land — not when one slice lands. Workers
check only their design's covered rows; the admin reconciles full coverage at
close.

## Review

worklog/01-goal-file-workstreams-phases.md

## Status

draft
