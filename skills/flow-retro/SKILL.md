---
name: flow-retro
description: >-
  Run a retrospective after execution: keep what worked, surface design errors and
  rework, extract lessons and patterns, then refine the design doc with corrections
  and supporting facts. Use when the user says flow:retro, asks for a design
  retrospective, or after an impl execution pass before refined re-execution.
---

# Flow: Retro

**One job:** After execution against a design, run a retrospective and **refine the design document** with corrections backed by reasoning and facts.

Does not run the full impl cycle or grill a brand-new draft (use `flow-grill-review` for that).

## Section map

| Section | Owns |
| --- | --- |
| **`## Retrospective`** | Parent for each retro pass (append a dated entry; do not overwrite prior passes) |
| **Keep / Problems / Lessons / Design revisions** | Four required subsections under that entry |
| **Design revisions** | Concrete design edits **or** the marker **Design holds** (with evidence) |

`Revision history` / `Review log` belong to `flow-grill-review`, not this skill.

## Preconditions

- A design doc path (typically `design/NN-<topic>.md`)
- Execution has happened (code, UI, or other artifacts exist to compare against the design)
- Access to what was built and what failed / was reworked

## Workflow

### 1. Gather evidence

Compare design claims to what execution actually produced:

- What matched the design
- What required rework, hacks, or silent deviation
- Where the **design itself was wrong** (wrong assumption, missing constraint, unmeasurable verification criteria, bad API shape, etc.)
- Patterns that emerged in the implementation (reusable structure, naming, pipeline)

Prefer file paths, test results, and concrete diffs over memory.

### 2. Write the retrospective into the design doc

Append a dated entry under **`## Retrospective`** with **exactly these four subsections**:

#### Keep

Practices and design choices validated by execution — keep them.

#### Problems

What went wrong and where rework happened. Call out explicitly when the root cause was a **design error** (not just a coding bug).

#### Lessons

- **In-execution:** reusable takeaways and patterns from this build
- **Promotion candidates:** rules worth promoting to `AGENTS.md` (or similar) and/or archiving in `rules/` when fully settled

List promotion candidates clearly. Do not edit those files unless the caller asks.

#### Design revisions

Concrete list of edits to make to the design body, each with **supporting reasoning / facts** (paths, measurements, failed attempts).

Then **apply** those edits to the design (goals, scope, verification criteria, decisions, etc.). This is first-principles correction of the design, not cosmetic rewording.

### 3. No-diff case

If execution confirmed the design and no design edits are needed:

- Still write the four subsections
- In **Design revisions**, record **Design holds** and why (evidence)

Skipping the retro is not allowed.

### 4. Exit when design is invalid

If the design is fundamentally broken and cannot be patched in place:

```
Exit reason: cannot complete directly
Completed: … (evidence gathered)
Missing / blocked: design needs a rewrite / another flow-grill-review
Suggested fix: main session revises or rewrites the draft, then re-dispatch
```

Do not fake a refined design.

## Out of scope

- `flow-impl` orchestration and commit messages
- Parallel attack-angle review of a fresh draft (`flow-grill-review`)
- Mandatory promotion into AGENTS/`rules/` (recommend only unless asked)

## Done checklist

- [ ] Evidence gathered against the design
- [ ] Dated `## Retrospective` entry with Keep / Problems / Lessons / Design revisions
- [ ] Design body updated (or **Design holds** recorded under Design revisions)
- [ ] Ready for caller/`flow-impl` commit: `retro(NN): refine design`
