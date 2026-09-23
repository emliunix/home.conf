---
name: goal-file
description: >
  Orient on a project sprint goal file: what it is, the frozen-root + funnel
  concepts, and what to do with one. Points to the authoring spec
  (goal-authoring.md) for the full shape rules and to template-goal.md for the
  copyable start.
---

# Goal file

A goal file is the **administrative source** for a project sprint: a compact
`goals/*.md` that freezes a user-requirements description as the root, then
constructs the funnel on top of it.

This skill is the **orientation layer** — it tells you what a goal file is and
what to do with one. If you are the **author** populating a goal file, use the
full definition in `goal-authoring.md` (same skill folder) for the required
shape, templates, DAG rules, and workflow slots, and start from the copyable
`template-goal.md`.

## What a goal file is for

A sprint needs one place that answers, administratively:

- What is the frozen user requirement (**the root**), and which later additions
  still bind to it?
- Which well-scoped **designs** exist to satisfy which rows, and how do they
  **depend**?
- How do those designs group into **workstreams** (structural/scope cohesion)
  and **phases** (spec-readiness)?
- Which design is being populated right now?
- What is complete, open, or blocked?

The goal file answers all of that in one view. It is **not** a design doc, a
process manual, or a worklog — those live elsewhere.

## The core concept: freeze, then funnel

**Freeze first.** At draft, reconcile exactly one input class into the frozen
user-requirements description. Copy the owner's words in `>` blockquotes, then
keep the context and analysis that make each excerpt meaningful in ordinary
prose beside it, grouped under useful headings. That freeze is the root
— it is the single source of truth and is **never edited** once written. If the
target moves, that is a new goal file (or a dated owner re-statement appended
below the original), not a silent "refinement."

**Then construct the funnel.** On top of the frozen root, build, in order:
additions, scoped designs, dependencies, workstreams, phases, per-design
workflows, AC coverage matrix, rulings, review outcome, open threads, worklog.
Do not write anything before the root is frozen.

## The discipline rules

- **The goal file tracks, the design file decides, the worklog tells.** A status
  change never requires editing prose; a ruling never lives only here (it dies
  when the goal closes).
- **Standing law:** *Process is recommendation, not ceremony.* Steps may be
  skipped, simplified, merged, fast-pathed, or extended when the change serves
  the target. **Requirements & efficiency toward the goal always win over
  process.** A skip records a one-line reason in the worklog; a checklist
  completed is not success. Do not write designs, grills, or receipts whose only
  job is to bless work already specified.
- **Proportionality:** a one-workstream, low-volatility goal renders no phase
  spine, no per-phase DAG beyond what is needed, no partition. That is an
  explicit decision, not an omission.

## What to do with a goal file

1. **Freeze the root** — copy the user-requirements description verbatim in
   `>` blockquotes, with its adjacent context and analysis
   (or the User inputs / Problem statement, per the freeze rule). Number it
   `R1`… and mark the provenance at freeze.
2. **Build the funnel** — additions, then design files (one line each, with
   their `covers` and admin source), then dependencies (scope analysis first,
   then edges), then workstreams + phases, then per-design workflow slots, then
   the AC coverage matrix, then dated rulings, review outcome, open threads, and
   the worklog pointer.
3. **Keep it compact** — sections stay small and factual. Detailed receipts,
   RCA narratives, rejected alternatives, and superseded plans go to the worklog
   ledger. If a resuming agent must read it to act correctly, it stays; if it
   only explains why, it moves.
4. **Use direct states** — `CLOSED-GREEN` (impl + deploy + live verify +
   acceptance all complete), `OPEN`, or `BLOCKED` (name the concrete
   dependency). `PARKED` is shorthand for not dispatched; do not treat it as
   complete.

## Where the detail lives

- **`goal-authoring.md`** — the full author definition: required section order,
  the dependencies template, workstream/phase rules, the generative-edge rule,
  the per-phase workstream DAG, the per-workstream workflow flow chart, the
  per-design workflow slot, and the AC coverage matrix. Referenced by the
  `flow-*` skills; read it if you are populating a goal file.
- **`template-goal.md`** — the copyable full-document template, with the
  opinionated presets and every section in place. Start an agent from here and
  fill it in.

The full definition lives with the author; this file is the orientation.
