---
name: goal-file
description: >
  Write and maintain compact project sprint goal files that freeze a user
  requirements description as the root, then construct the hierarchical funnel
  (additions, scoped designs, dependencies, impl waves, per-design workflows).
---

# Goal file

Use for a project goal/sprint file: `goals/*.md`.

## Purpose

A goal file is the **administrative source** for a sprint. At draft, **reconcile one of three inputs into a frozen user-requirements description — that freeze is the root.** Then construct the funnel.

**Freeze (exactly one input class):**

| Input at draft | What is copied into this file |
| --- | --- |
| A direct user-requirements description | That description, verbatim. |
| A set of design files **with** User inputs | Those User inputs, copied verbatim. |
| A set of design files **without** User inputs | Those Problem statements (treated as already user-confirmed). |

Do not mix a direct description with a design-file set. If a design set is mixed (some files have User inputs, some do not), copy User inputs where present and Problem statements where not — still one freeze. After freeze, this file is the root; do not re-read the source designs as the root.

Then it answers: what is the frozen root (and which later additions still bind); which well-scoped designs exist to satisfy which rows, and how they depend; which impl waves follow; which review/impl workflow is populated on each design; what is complete, open, or blocked.

The discipline rule: **the goal file tracks, the design file decides, the worklog tells.** A status change never requires editing prose; a ruling never lives only here (it dies when the goal closes).

**Layers.** This skill is generic authoring — shape only. Loop machinery (`flow-grill-review`, `flow-common` implementation gate, `flow-retro`) is not restated here. The project `AGENTS.md` adds that repo’s floor (standing skills, how Prep is filled). Do not bake project skill names into this file.

## Required shape

Section order is fixed. **Freeze, then funnel.** Do not write additions, scoped designs, waves, or workflows before the root is frozen. Keep every section small and factual.

1. **Title / status** — `# <goal> — OPEN|BLOCKED|CLOSED-GREEN (date)`.
2. **Goal** — the owner's words, verbatim. **NO EDIT once written.** If the target moves, that is a new goal file, or a dated owner re-state appended below the original. Never silently "refine" it.
3. **User requirements (frozen root)** — the vendored description from the freeze table. **NO EDIT once frozen.** One-line provenance at freeze (`frozen from: direct | design/NN User inputs | design/NN Problem statement`) is a label, not a live citation. Numbered `R1`… rows partition that freeze for covering and checkboxes; they do not rewrite it. Handles are never reused. Checkbox law: the goal is DONE exactly when every live root box is checked with an evidence line, not narration. Dual-gate: a scoped design names the rows it covers (design gate); the final review re-walks the same rows with live evidence (final gate). Optional sub-parts:
   - *Analysis* — working read of the frozen root. **Append-and-amend.**
   - *Working background* — fact map (paths, seams, designs in force, live-world facts). **Kept current.**

Then construct the **funnel**, in this order:

4. **Additions to the root** — later numbered rows (`A11`… or any unused handle after the root). Each addition is a binding extension or `obsoleted` (date + why-one-liner + worklog pointer). Obsolete in place; do not delete or reuse the handle. Live additions participate in the path-to-root; obsoleted ones do not.
5. **Design files** — the **new well-scoped** set produced by the funnel, each linked back here as admin source. One line: path — status word — **covers** `R#`/`A#` — **admin source:** this goal file. Status words only, no design-body prose.
6. **Dependencies** — among those scoped design files only. **Scope analysis first**, then edges (template below). No edge = independent. Not a second task list.
7. **Impl waves** — the ONE active plan, **derived from (6)** (template below). A superseded plan moves to the worklog with the pointer left behind; this section never holds two.
8. **Workflows** — one populated slot per design in (5) (template below). Inner loop and wrong-design exit are `flow-*`; this section only fills the slots.
9. **Rulings in force** — dated one-liners, each with its design-file pointer (`2026-08-19 — editor is coded-against-schema → design/47 §3`). The ruling word itself, never the rationale.
10. **Review outcome** — verdict + findings table (id, severity, item, disposition), one line each. Evidence lives in the worklog.
11. **Open threads** — what / who rules / blocks what, one line each. The next goal file seeds from here.
12. **Worklog** — path pointer (section-anchored, e.g. `worklog/x.md §C1-receipt`).

## Dependencies template

```markdown
## Dependencies

**Scope analysis** (one impl scope per design in (5) that has an impl
slice; a design that spans two scopes is not well-scoped — split it in
(5) first. Architecture is **not** a scope — design-time only; no impl
wave, no landing edge):
- design/NN — core-schema (cross-module data structure)
- design/PP — module:<name>
- design/QQ — ui-ux
- design/MM — design-time (architecture); not a scope

**Edges** (landing order; implied by scope unless a tighter edge exists):
- design/PP after design/NN
- design/QQ after design/PP
```

Scope analysis is part of this step, not a later wave. Example impl scopes (not a closed set): **core-schema** (cross-module data structure), **ui-ux**, **module:\<name\>**. Architecture is a design-time consideration only — not an impl bucket. It is **not** scheduled as a wave. It activates only when an inner impl loop **breaks out**; then `flow-common` breakout adjudication runs (propagate up these edges, validate against the frozen root with **no root edit**, status-revert impacted designs to fold the change). Default edge direction: core-schema → module → ui-ux. Record only real exceptions (a named reason). A module must not land before the core-schema it consumes.

## Impl-wave template

```markdown
## Impl waves — <wave name> (YYYY-MM-DD)

**Acceptance criteria** (this wave is DONE exactly when every box
is checked with evidence) — references frozen root/addition rows
(`R2 rides wave C1's gate`):
- [ ] R2 — <operator-visible or wire-provable outcome>
- [ ] R4 — <suites/pins state that must hold>

### Wave X0 — <name> (<one-line purpose>; from deps: design/NN after design/MM)
0. **Prep:** <skill paths executors read before any work leg;
   omit this line if nothing beyond the project’s standing set>
1. **<Leg name>:** <what changes, where> — `<real/path.ts:NN>`,
   `<design/NN §k>` governs.
2. **<Leg name>:** …
Gate: <what must be green to leave the wave — named suites,
deploy id class, walk surface>.

**Risk notes:** <what this wave destroys/refuses; which open
question rides which leg>.
```

Plan-leg rules:

- Waves are a topological cut of (6), including the scope-analysis order. Independent designs may share a wave only if they share a scope and have no edge; a blocked edge never runs in the same wave as its predecessor unless the predecessor is already `landed`.
- **Prep** is work preparation: skill paths only, plus this goal file (frozen root + funnel). Empty / omitted extras = standing set + this goal file. Prep may differ by seat (implementor vs reviewer). Do not restate design body here.
- Legs name real files with line anchors and the governing design section — executable, not aspirational.
- One gate line per wave: named suites, deploy finish-probe class, walk surface. The gate is what the reviewer re-runs.
- Wave ordering is (6). Do not invent a second rail.
- Risk notes carry destruction and open questions — what an executor must know before starting, not after.

## Per-design workflow slot

```markdown
### design/NN-<topic> — <draft|reviewed|pending-retro|landed|superseded>
- **Admin source:** `goals/<this-file>.md`
- **Covers:** R# (path: A# → R# when an addition is live)
- **Scope:** core-schema | module:<name> | ui-ux | <named> | design-time (not an impl scope)
- **Depends on:** design/MM | none
- **Loop:** `flow-grill-review` → `flow:impl` (`flow-common`) → `flow-retro`
- **Gate:** AC check along **Covers** to the frozen root; a green design that does not move those rows is not done
- **Exit:** impl-loop breakout → `flow-common` breakout adjudication (architecture, upward, root unchanged, status revert of impacted files). Proved wrong machine → supersede this file, do not revert it.
```

Populate one slot per design in (5). Do not paste grill transcripts, round ledgers, or role manuals here.

## Status rules

- A design, probe, discovery pass, or starting assessment does not complete its named task.
- Do not call an epic complete until implementation, deployment, live verification, and acceptance are complete.
- State closed work briefly; do not repeat its history.
- Keep open designs visible even when no wave is currently dispatched.
- If work is not active, say the next action is prioritization → execution planning → dispatch. Do not imply that a heartbeat is progress.

## Compactness rules

- Rulings live in design files, dated; the goal file references them by path.
- RCA narratives, current-state dumps, receipt detail, rejected alternatives, and superseded plans go to the worklog. Load-bearing test: **if a resuming agent must read it to act correctly, it stays; if it only explains why, it moves.**
- Receipts shrink to one headline line (`DONE (sha, deploy-id)`); full receipts live in the worklog.
- No "Next action" section — Open threads + the active waves answer it structurally.
- Do not add role definitions, process manuals, review transcripts, or historical narrative.
- Use design-file links as the task source of truth; do not duplicate design contents. The frozen root is the vendored copy; after freeze, source designs are not the root.

## Completion language

Use direct states:

- `CLOSED-GREEN` — implementation, deployment, live verification, and acceptance are complete.
- `OPEN` — work remains.
- `BLOCKED` — name the concrete dependency.
- `PARKED` — optional shorthand for not dispatched; do not treat it as complete.

## Accompanying ledger

Every substantial goal file links its worklog ledger:

`[worklog ledger](../worklog/<topic>-YYYY-MM-DD.md)`

The ledger carries receipts, decisions, findings, dispatches, RCA evidence, and superseded plans. The goal file carries only the execution summary and pointers.
