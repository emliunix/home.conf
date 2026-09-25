---
name: goal-authoring
description: >
  The full author definition for a goal file: anchor the user-requirements
  description as the root, then construct the funnel — additions, scoped
  designs, dependencies, workstreams, phases, per-design workflows. The
  orientation-layer SKILL.md points here for the shape rules.
---

# Goal file

Use for a project goal/sprint file: `goals/*.md`.

## Purpose

A goal file is the **administrative source** for a sprint. At draft, **reconcile one of three inputs into an anchored user-requirements description — that anchor is the root.** Then construct the funnel.

**Anchor (exactly one input class):** Copy the owner's words exactly in `>`
blockquotes. Group related excerpts under meaningful headings and put the
context and analysis needed to understand each excerpt in normal prose beside
it. This accompanying prose preserves meaning but is agent annotation, not a
new owner requirement.

| Input at draft | What is copied into this file |
| --- | --- |
| A direct user-requirements description | That description, verbatim. |
| A set of design files **with** User inputs | Those User inputs, copied verbatim. |
| A set of design files **without** User inputs | Those Problem statements (treated as already user-confirmed). |

Do not mix a direct description with a design-file set. If a design set is mixed (some files have User inputs, some do not), copy User inputs where present and Problem statements where not — still one anchor. After anchoring, this file is the root; do not re-read the source designs as the root.

Then it answers: what is the anchored root (and which later additions still bind); which well-scoped designs exist to satisfy which rows, and how they depend; how those designs group into **workstreams** (structural/scope cohesion) and **phases** (spec-readiness); which design is being populated right now; what is complete, open, or blocked. A copyable starting point with opinionated presets lives in `template-goal.md`.

The discipline rule: **the goal file tracks, the design file decides, the worklog tells.** A status change never requires editing prose; a ruling never lives only here (it dies when the goal closes).

**Standing law (compiled, not duplicated).** *Process is recommendation, not ceremony.* Steps may be skipped, simplified, merged, fast-pathed, or extended when the change serves the target. **Requirements & efficiency toward the goal always win over process.** A skip records a one-line reason in the worklog; a checklist completed is not success. Do not write designs, grills, or receipts whose only job is to bless work already specified.

**Layers.** This skill is generic authoring — shape only. Loop machinery (`flow-grill-review`, `flow-common` implementation gate, `flow-retro`) is not restated here. The project `AGENTS.md` adds that repo’s floor (standing skills, how Prep is filled). The goal file vendors the **project + goal** tier of standing law for agent context, and references the **flow-* process tier** and design bodies by pointer — it never restates them.

## Required shape

Section order is fixed. **Anchor, then funnel.** Do not write additions, scoped designs, workstreams, phases, or workflows before the root is anchored. Keep every section small and factual.

1. **Title / status** — `# <goal> — OPEN|BLOCKED|CLOSED-GREEN (date)`.
2. **Goal** — the owner's words, verbatim in `>` blockquotes, grouped under
   useful headings when there are several related excerpts. Keep context and
   analysis in adjacent normal prose so the relationship between chunks is
   recoverable. Quotes are never rewritten. If the target moves, append a dated owner
   restatement below the original and record it with a re-anchor entry, or open
   a new goal file.
3. **User requirements (anchored root)** — the vendored owner excerpts from the anchor table, in `>` blockquotes with their accompanying context and analysis. **Anchored:** owner-confirmed intent. Change it only by a dated re-anchor entry that says what changed and why. The entry names the affected rows and designs. The prose is annotation and never silently becomes an owner requirement. One-line provenance at anchoring (`anchored from: direct | design/NN User inputs | design/NN Problem statement`) is a label, not a live citation. Numbered `R1`… rows partition that anchor for covering and checkboxes; they do not rewrite it. Handles are never reused. Checkbox law: the goal is DONE exactly when every live root box is checked with an evidence line, not narration. Dual-gate: a scoped design names the rows it covers (design gate); the final review re-walks the same rows with live evidence (final gate). Optional sub-parts:
   - *Analysis* — working read of the anchored root. **Append-and-amend.**
   - *Working background* — fact map (paths, seams, designs in force, live-world facts). **Kept current.**

Then construct the **funnel**, in this order:

4. **Additions to the root** — later numbered rows (`A11`… or any unused handle after the root). Each addition is a binding extension or `obsoleted` (date + why-one-liner + worklog pointer). Obsolete in place; do not delete or reuse the handle. Live additions participate in the path-to-root; obsoleted ones do not.
5. **Design files** — the **new well-scoped** set produced by the funnel, each linked back here as admin source. One line: path — **covers** `R#`/`A#` — **admin source:** this goal file. No design-body prose. **This is a pure index; the canonical status word lives on the per-design line inside its Workstream, never here.**
6. **Dependencies** — among those scoped design files only. **Scope analysis first**, then edges (template below). No edge = independent. Not a second task list. If a design spans two scopes it is not well-scoped — split it in (5) first. Architecture is **design-time** — not a scope, no impl bucket, no landing edge.
7. **Workstreams** — the ONE active dispatch structure, **derived from (6)**. Workstreams are scope-coherent groups of designs that share one **phase**; phases are the spec-readiness timeline. (Sections below.)
8. **Workflows** — one populated slot per design in (5) (template below). Inner loop and wrong-design exit are `flow-*`; this section only fills the slots.
9. **AC coverage matrix** — admin-owned map of which rows are covered by which design(s) across which phase(s) (below). A row locks when all covering designs land.
10. **Rulings in force** — dated one-liners, each with its design-file pointer (`2026-08-19 — editor is coded-against-schema → design/47 §3`). The ruling word itself, never the rationale.
11. **Review outcome** — verdict + findings table (id, severity, item, disposition), one line each. Evidence lives in the worklog.
12. **Open threads** — what / who rules / blocks what, one line each. The next goal file seeds from here.
13. **Worklog** — path pointer (section-anchored, e.g. `worklog/x.md §C1-receipt`).

## Dependencies template

```markdown
## Dependencies

**Scope analysis** (one impl scope per design in (5) that has an impl
slice; a design that spans two scopes is not well-scoped — split it in
(5) first. Architecture is **not** a scope — design-time only):
- design/NN — core-schema (cross-module data structure)
- design/PP — module:<name>
- design/QQ — ui-ux
- design/MM — design-time (architecture); not a scope

**Edges** (landing order; implied by scope unless a tighter edge exists):
- design/PP after design/NN
- design/QQ after design/PP
```

Scope analysis is part of this step, not a later phase. Example impl scopes (not a closed set): **core-schema** (cross-module data structure), **ui-ux**, **module:\<name\>**. Architecture is a design-time consideration only — not an impl bucket, not a phase, not a workstream. It activates only when an inner impl loop **breaks out**; then `flow-common` breakout adjudication runs. Default edge direction: core-schema → module → ui-ux. Record only real exceptions (a named reason). A module must not land before the core-schema it consumes.

## Workstreams and phases

Two distinct cuts of the same design set. **Do not conflate them** — the old `impl waves` did, forcing either a speculative schedule or premature full spec.

- **Workstream** = *structural*. Which designs cohere by scope (`core-schema`, `module:<name>`, `ui-ux`). Answers *what belongs together*; it is the **dispatch unit**.
- **Phase** = *epistemic*. Which designs can be fully specified now vs. must wait for an upstream outcome. Answers *when it is safe to write the design body*; populate one phase at a time, not all at once.

A workstream is **well-formed iff all its designs share one phase.** Merge by scope (from `Dependencies`), **never across a generative edge** (below). A merge that spans phases did not cohere — split it.

### Generative edge rule

An edge is **generative** when the downstream design's body cannot be written truthfully until the upstream produces a fact. This is the **only** rule that moves a design between phases.

- **Interface dependency** (not generative): downstream consumes the upstream's *declared contract* — names, types, wire shape, object-model identity. If that contract is anchored in the root, or stated non-volatile in the upstream, the design is specifiable now against the contract.
- **Realization dependency** (generative): downstream consumes a *fact the upstream produces* — the actual semantics, a concrete algorithm's behavior, a downstream artifact it emits, a measured value on real data.

Volatility rubric — mark generative if **any** is true:

| Signal | Generative when |
| --- | --- |
| **V-realization** | downstream consumes the realization, not the contract (decisive) |
| **V-open-decision** | upstream carries an unresolved named defer/P1 that changes its shape |
| **V-unknown-behavior** | upstream behavior on real data is uncertain until built |
| **V-unfrozen-contract** | upstream contract is not frozen; can change during impl without a goal amendment |
| **V-transitive** | upstream is itself the downstream of a generative edge |

**Order of passes** — generative analysis (phases), then landing analysis (structural edges, both generative and interface-only), then scope merge (workstreams inside a phase). Property this buys: a design can be **spec-early, land-late** — full body written in an early phase, implemented in a later one.

### Phase states, owner, transitions

| State | Meaning | Set by |
| --- | --- | --- |
| `brief` | one-line purpose + design list only (names, scope, dependency pointer). No bodies, no grill, no impl. | manager |
| `populated` | brief expanded to full design bodies, ready to flow through grill → impl. | manager |
| `closed` | all designs in the phase landed; the phase's work is done. | manager |

Owner: the **manager**, holding the supervisor/orchestrator duty — the seat that defines bounded workstreams and gates `reviewed`/`pending-retro`.

- `brief` → `populated` trigger: all **upstream generative deps** at their threshold — `landed` for outcome-volatile (V-realization), `reviewed` for content-volatile. Record which upstream stabilized, one line, in the worklog.
- `populated` → `brief` reversion: replan after a breach or supersession. When a design turns out volatile late, escalate → replan the phase → move the design to a later phase, and revert the current phase to `brief` if its brief was built on a now-dead assumption. Volatility discovered late is a refinement, not a failure.

Every transition is a dated worklog entry with the triggering evidence.

### Per-phase workstream DAG

One rendered DAG per phase, **inter-workstream only**. Nodes are workstreams; edges are inter-workstream dependency. Intra-workstream design edges live in that workstream's own workflow flow chart — never on the phase DAG. Cross-phase edges are not drawn (the phase ordering encodes them); a trailing workstream carries a one-line "feeds phase Y" pointer.

A `brief` phase renders as a **skeleton DAG** (workstream nodes + edges, no workflow detail), so the whole funnel is visible as a spine of phase skeletons at a glance; only the current phase blossoms into full per-workstream flow charts.

### Resource analysis and parallelizability

The phase DAG's edges are **typed** — two classes:

- **Structural** — dependency (generative/landing): "A's outcome feeds B."
- **Resource** — env/state constraint.

Resource analysis adds nodes and edges to the phase DAG:

| Resource node | Position | Purpose |
| --- | --- | --- |
| `env-setup` | pre-fan-out | provision test/mock env before parallel dispatch |
| `env-teardown` | post-fan-in | restore/clean after the phase's workstreams finish |
| `leave-it-there` | annotation | which residue persists (or is required) for the next phase |
| `env-share` (edge) | between workstreams | shared writable env/resource → serialize, or snapshot per seat |

**Parallelizability = no structural edge AND no resource edge** between two workstreams. This closes the default-consistency bug class (two workstreams editing one shared file with no graph edge between them). Also cap practical parallelism (2–3): one manager cannot deeply re-warm on many concurrent workstreams.

## Per-workstream workflow flow chart

This is a **flow chart over process steps**, not a lifecycle state machine. The four-word status table (in `flow-common`) stays the source of truth for *status*; the flow chart shows *route*.

**Node vocabulary** (fixed set; omit what does not apply, never pad):

| Node | Type | What it is |
| --- | --- | --- |
| **Prep** | action | read goals/root + Prep skills + this design's Covers path |
| **Grill** | decision | independent review; angle batch runs here |
| **Defend** | decision | adjudicate findings; fix accepted P1s (smallest correction) |
| **Rematch** | action | P1-triggered re-review only |
| **Implement** | decision | implementation gate (round budget, slices) |
| **Verify** | action | fresh evidence for covered AC rows |
| **Retro** | action | closing pass; first-principles bottom line |

Spine: `Prep → Grill → Defend → (Rematch?) → Implement → Verify → Retro`.

**Edge labels** (the match condition):

| Label | From | Routes to |
| --- | --- | --- |
| `PASS` | any decision | next spine step |
| `NEEDS-FIX` | Grill | Defend |
| `FAIL` | Grill (blocker) / Defend (wrong-scope) / Implement (design mismatch) | Defend / adjudication / appropriate loop |
| `ESCALATE` | Defend / Verify / Implement | supervisor gate (re-warm + dispatch decision) |
| `ROUTE: BREAKOUT` | Implement | `flow-common` breakout adjudication |
| `ROUTE: SUPERSEDE` | Implement / retro | new `design/NN`; old file notes `Superseded by:` |
| `ROUTE: DEFER` | Defend | named-missing-evidence decision; a P1 defer blocks the gate |
| `SKIP` | any | step omitted; one-line reason in worklog |

**Status mapping** (flow exits → lifecycle table): Grill pass → `reviewed`; Implement pass → `pending-retro`; Retro pass → `landed`; BREAKOUT revert → `draft`; SUPERSEDE keeps last status + `Superseded by:`. **`FAIL` never sets a status** — it routes to adjudication, still inside `draft`.

**Hooks** are typed slots on an edge: `[+step]` injection or `[-step]` skip, annotated with the goal/scope reason. This is where "process is recommendation" becomes structural.

**Legend is mandatory** (reporting convention): node-shape meaning, edge-label meaning, status-code mapping, abbreviations. The edge-label vocabulary and the per-workstream workflow flowchart are defined here, in `goal-authoring.md` — the `flow-*` skills reference them and reconcile toward this skill; they do not restate them. (`flow-common` separately owns the four-word design status table and the roles.)

The copyable full-document template (with the phase-DAG mermaid, presets, and every section below in place) lives in **`template-goal.md`** inside this skill folder — reference it, don't duplicate it. The Workstream/template shapes above are the *rules*; the template file is the *startable artifact* an agent copies and fills. Phase list + states are the source of truth for *order and state*; the DAGs are the *shape*. Both derive from one dependency analysis, so they cannot disagree. Workstream entries and phases stay **one line each**; a phase `brief` must stay a brief — if it gains scope prose, it has become a second design doc.

## Per-design workflow slot

```markdown
### design/NN-<topic> — <draft|reviewed|pending-retro|landed|superseded>
- **Admin source:** `goals/<this-file>.md`
- **Covers:** R# (path: A# → R# when an addition is live)
- **Scope:** core-schema | module:<name> | ui-ux | <named> | design-time (not an impl scope)
- **Depends on:** design/MM | none
- **Loop:** `flow-grill-review` → `flow:impl` (`flow-common`) → `flow-retro`
- **Gate:** AC check along **Covers** to the anchored root; a green design that does not move those rows is not done
- **Exit:** impl-loop breakout → `flow-common` breakout adjudication (architecture, upward, root unchanged, status revert of impacted files). Proved wrong machine → supersede this file, do not revert it.
```

Populate one slot per design in (5). Do not paste grill transcripts, round ledgers, or role manuals here. **The status word's one canonical home is this per-design line** (or its Workstream line); it is never duplicated into the Design-files index.

## AC coverage matrix

Admin-owned, row-oriented. Each design names the rows it **Covers** (a/b/c); the admin maintains which rows are covered by which design(s) across which phase(s). **A row locks when all its covering designs across all phases land**, not when one slice lands. Workers check only their design's covered rows; the admin reconciles full coverage at close. This prevents the "my slice landed, box still unchecked" mismatch.

```markdown
## AC coverage
| Row | Covering design(s) | Phase | Locks when |
| --- | --- | --- | --- |
| R1 | design/02 | P1 | design/02 landed |
| R2 | design/01, design/05 | P1, P3 | both landed |
```

## Status rules

- A design, probe, discovery pass, or starting assessment does not complete its named task.
- Do not call an epic complete until implementation, deployment, live verification, and acceptance are complete.
- State closed work briefly; do not repeat its history.
- Keep open designs visible even when no phase is currently being populated.
- If work is not active, say the next action is prioritization → execution planning → dispatch. Do not imply that a heartbeat is progress.

## Proportionality

Phases, workstream DAGs, and the parallelizability partition come into play only when there are genuinely **multiple volatile designs**. A one-workstream, low-volatility goal renders **no phase spine, no per-phase DAG beyond what is needed, no partition** — that is an explicit decision, not an omission. Process is recommendation; requirements and efficiency toward the goal always win.

## Compactness rules

- Rulings live in design files, dated; the goal file references them by path.
- RCA narratives, current-state dumps, receipt detail, rejected alternatives, and superseded plans go to the worklog. Load-bearing test: **if a resuming agent must read it to act correctly, it stays; if it only explains why, it moves.**
- Receipts shrink to one headline line (`DONE (sha, deploy-id)`); full receipts live in the worklog.
- No "Next action" section — Open threads + the active phase answer it structurally.
- Do not add role definitions, process manuals, review transcripts, or historical narrative.
- Use design-file links as the task source of truth; do not duplicate design contents. The anchored root is the vendored copy; after anchoring, source designs are not the root.
- Vendored law carries `vendored from: <path> (date, ref)` — and **re-compiles** on project-law change (it is not anchored). User requirements anchor; principles re-compile.

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
