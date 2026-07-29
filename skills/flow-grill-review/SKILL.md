---
name: flow-grill-review
description: >-
  Plan attack angles, run parallel multi-angle reviews, then defend and adjudicate
  until the design is landed. Use when the user says flow:grill-review, asks to
  grill/review/defend a design, or needs to turn a draft into a finalized design
  before implementation.
---

# Flow: Grill → Review → Defend

**One job:** Turn an existing design draft into a **landed** design. Does not write the initial draft, implement, or commit.

Default design path convention: `design/NN-<topic>.md` (project may differ; use the path the caller gives).

## Section map

| Section | Owns |
| --- | --- |
| **Review log** | Attack angles, findings, rejects, deferred items, exit outcomes |
| **Revision history** | Accepted design edits from defend (what changed and why) |
| **Status** | `draft` → `landed` when this flow completes |

## Preconditions

- Design draft exists on disk
- Draft has (or will receive) sections: **Goal / Scope / Verification criteria / Key decisions / Review log / Revision history** (or equivalents)
- Assumptions are listed: facts (with source) vs inferences vs TBD

## Workflow

### 1. Plan attack angles

The main agent writes a set of **attack angles** into the design’s **Review log**. (This step prepares the grill; the adversarial work is Step 2.)

Rules for angles:

- Concrete and testable (not vague “is this good?”)
- Typical angles: source/doc consistency · measurable verification criteria · scope gaps · fragile assumptions · conflict with `rules/` if the project has a decision library
- Each angle gets **one** independent reviewer subagent

### 2. Review (parallel)

Spawn **one subagent per angle**. Reviewers must not share findings with each other.

Each reviewer receives only:

- Path to the design draft
- Their single attack angle (verbatim)
- Explicit source file paths needed for that angle

**Finding format** (one block per finding):

```
Finding: …
Evidence: (file path + location)
Severity: blocking | suggestion | question
```

**Exit option (mandatory):** If the angle is invalid, context is incomplete, or evidence cannot be obtained without guessing, the subagent must **exit** with this report — never invent findings:

```
Exit reason: (incomplete context / cannot complete directly)
Completed: …
Missing / blocked: …
Suggested fix: …
```

Forbidden: fabricating data, skipping verification, scope creep outside the attack angle, editing out-of-scope files.

### 3. Defend

Adjudicate **findings** and **exits** separately.

**Findings** — every finding gets a verdict:

| Verdict | Action |
| --- | --- |
| **Accept** | Finding stands → revise the design; log in **Revision history** |
| **Reject** | Finding does not stand → write rejection reason + evidence in **Review log** |
| **Defer** | Insufficient evidence both ways → record as open verification in **Review log** |

**Exits** — not findings. Each exit is **blocking** until one of:

- Context is fixed and the same angle is re-reviewed, or
- The angle is reframed / dropped (log why in **Review log**), or
- The design is revised so the angle no longer applies (log in **Revision history**, then rematch if still needed)

**Landed** only when:

1. All findings have a verdict
2. All exits are resolved (rematch done, or angle dropped/reframed with a logged reason)
3. Accepted revisions are merged into the design body
4. Open deferred items are explicitly listed (do not pretend they are closed)
5. Set **`Status: landed`** at the top of the design doc (or equivalent clear marker)

## Out of scope

- Writing the first draft of the design
- Implementation / execution
- Git commits (caller or `flow-impl` commits)

## Done checklist

- [ ] Attack angles written into Review log
- [ ] One review pass per angle (or structured exit + rematch / drop)
- [ ] Every finding adjudicated; every exit resolved
- [ ] Design body updated for accepted findings
- [ ] `Status: landed` set; ready for `design(NN): initial` commit by caller
