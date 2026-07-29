---
name: flow-impl
description: >-
  Implementation cycle for one design number: land design and commit, execute and
  commit, retro and commit, then first-principles refined re-execution and commit.
  Composes flow-grill-review and flow-retro. Use when the user says flow:impl or
  asks to run the design→execute→retro→refine loop for a design NN.
---

# Flow: Impl

**One job:** Orchestrate the **design → execute → retro → refine** commit cycle for one design number `NN`.

**Landed** means the design passed `flow-grill-review` and shows `Status: landed`.

This skill **composes** other skills — read and follow them; do not restate their internals:

- `flow-grill-review` — land a draft (plan attack angles → multi-angle review → defend)
- `flow-retro` — run a retrospective and refine the design after execution

## Preconditions

- Design draft path (default convention `design/NN-<topic>.md`). **If no draft exists, stop and ask the caller** who should write it — do not invent a draft inside this flow, and do not call `flow-grill-review` on a missing file.
- Design number `NN` (from filename or caller)
- Whether commits are **pre-authorized** (project `AGENTS.md` / user rules). If not pre-authorized, **pause and ask** before each commit.

## Workflow (four commits)

| Step | Action | Commit message |
| --- | --- | --- |
| 1 | Confirm draft exists → invoke **`flow-grill-review`** until `Status: landed` → commit | `design(NN): initial` |
| 2 | Implement according to the landed design (code, UI, artifacts) → commit | `impl(NN): execution` |
| 3 | Invoke **`flow-retro`** → commit the refined design doc | `retro(NN): refine design` |
| 4 | First-principles re-implement from the refined design (goal → constraints → minimal correct impl). Reconcile implementation with the refined design; fix remaining design↔code mismatches, or record **Design holds** under the retro’s **Design revisions** (with evidence) if they already match → commit | `impl(NN): refined execution` |

### Step rules

1. **Step 1** — A draft alone is not enough; the design must be **landed** (`Status: landed`) via `flow-grill-review` before `design(NN): initial`.
2. **Step 2** — Implement only what the landed design requires; do not expand scope mid-flight.
3. **Step 3** — Always run `flow-retro` after execution; do not skip to step 4. Commit the design doc only (no silent AGENTS/`rules/` edits unless the caller authorized them).
4. **Step 4 is mandatory** — Re-derive from first principles against the refined design. If implementation already matches, still verify and ensure **Design holds** is recorded under **Design revisions** before committing (the commit may have no code changes, but the step must not be skipped). Prefer a real commit when there are fixes.

### Exit / redesign

If execution or retro shows the design cannot stand:

- Stop the cycle
- Fix or rewrite the design (often another `flow-grill-review`)
- Resume from the appropriate step — **do not skip commit points** once work for that step is done

### Commits

When commits are pre-authorized (or the user approved), use the exact message templates above (`NN` substituted). Follow the user’s git safety rules (no force push, no config changes, etc.).

## Out of scope

- Rewriting grill/review/defend or retro section formats (owned by the composed skills)
- Project-specific product logic beyond following the design doc
- Creating the initial design draft

## Done checklist

- [ ] `design(NN): initial` after `Status: landed`
- [ ] `impl(NN): execution` after first build
- [ ] `retro(NN): refine design` after `flow-retro`
- [ ] `impl(NN): refined execution` after first-principles pass (or **Design holds**)
