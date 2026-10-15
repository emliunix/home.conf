---
name: raft-task-card
description: >-
  Use when authoring, amending, claiming, reviewing, or closing Raft task cards
  in a project governed by goal files. Routes each project card either directly
  to a named design or to an explicitly small task, batches related small work,
  and makes ownership, evidence, and review timing explicit.
---

# Raft Task Card

A Raft task card is an executable work item. It is not a second design document
and it is not a status report. Use the project's own goal and design files as
the source of truth, and make the card small enough that its owner can execute
and verify it without reconstructing the surrounding conventions.

The governing rule is:

> **The goal file tracks. The design file decides. The worklog or receipt tells.**

## Card routing rule

A project card must be exactly one of these two forms:

1. **Design-backed.** The card directly maps to a named design file or design
   section. The card says **Follow the design and goal workflow.** `DESIGN.`
   names the path and section, and says whether the card amends or implements
   it, and names the module documents the design changes (`project-skeleton`
   § Module docs). `GOAL.` names the workstream and design slot.
2. **Small task.** The work is a bounded repair or evidence task that does not
   change behavior, a contract, schema, interface, architecture, or operational
   policy. `DESIGN. None.` states why no design is needed. Related small tasks
   are **merged into one workstream**, assigned to **one agent**, and **reviewed
   as a batch** after the workstream finishes; do not create a card per
   micro-fix.

If the work is neither design-backed nor genuinely small, do not create a
card. Fix the design or goal first, or amend the existing card that owns the
lane. If a small task grows into a behavior or contract change, stop and route
it back through the design or goal authority instead of widening the card
silently.

## Use this skill when

- Creating or amending a Raft task card.
- Claiming, assigning, or starting card work.
- Updating a card after scope, evidence, or review state changes.
- Closing a card or preparing a workstream for its single review.

Use [`raft-group-chat`](../raft-group-chat/SKILL.md) for the wording and
audience of the accompanying message. Use
[`goal-file`](../goal-file/SKILL.md) for the frozen-root and funnel rules. Use
[`worktree-sop`](../worktree-sop/SKILL.md) when the card can edit a repository
or run a heavy gate. This skill connects those conventions to the Raft task
surface.

## Authority and grouping

- **The goal file tracks.** It owns the frozen root, additions, design index,
  dependencies, workstreams, phases, and worklog pointer. Do not put a second
  goal or design body inside a task card.
- **The design file decides.** Link the owning design section when behavior,
  contracts, architecture, schemas, interfaces, or operational policy can
  change. If no design change is needed, say `DESIGN. None.` and state what the
  card does instead.
- **The worklog or receipt tells.** Put raw evidence, logs, and execution
  history in the project's durable receipt surface. The card carries the
  required outcome and the acceptance pointer, not the full investigation.

Keep the workstream and card axes separate:

- A **workstream** is a scope-coherent group in the goal file and is the
  dispatch unit. It gets one assignee and one review after all of its cards
  finish.
- A **card** is one claimable design-backed work item or one batched small
  task inside that workstream. A workstream may group several design-backed
  cards, but related small tasks must be merged into one card.
- Do not ask for a review after each card. Finish the workstream, bring one
  report, and let the workstream review decide the whole lane.
- Every card that can edit files must have one writer for each worktree or
  file boundary. Concurrent workers do not share an edit surface without an
  explicit partition.
- When a card is merged into another lane, close it with a reason such as
  `[MERGED INTO #322]` and carry its measurements, acceptance items, and
  attribution into the surviving card.

If no goal file governs the work, say so explicitly and use the design
authority and project guidance that do exist. Do not invent a goal path or
claim that a card is workstream-governed when it is not.

## Before creating a card

1. Resolve the authority. Read the relevant goal-file workstream, the design
   section it points to, and any current card or thread that already owns the
   same lane.
2. Check whether this is a new workstream or an amendment to an existing one.
   Reuse and amend the live card when the work belongs to its scope.
3. Decide the observable result. If the card cannot name a result, a verifier,
   or a stopping condition, it is not ready to create.
4. Decide whether the card creates a persistent resource. If it does, use
   `--creates-resource`. The card cannot move to `done` until the structured
   receipt is recorded.

Use a title of the form `[Tag] imperative outcome`. Useful tags include
`[Gate]`, `[Test Hygiene]`, `[Design]`, `[Release]`, `[Seat]`, `[Tracker]`,
and `[Skills]`. The title names the outcome, not the implementation.

Read [`references/card-template.md`](references/card-template.md) before
drafting the body. The card body should normally carry these fields:

```text
SUBJECT
CARD TYPE
DESIGN
GOAL
PROJECT GUIDANCE
WORKTREE
AUTHORITY
SCOPE
REQUIRED OUTCOME
ACCEPTANCE
CHECK PROOF
EVIDENCE BOUND
TEST TIER
REPORT
REVIEW HANDOFF
LOGS
BOUNDS
```

Delete fields that genuinely do not apply, but do not delete a field merely
because it is inconvenient. In particular, acceptance must name the command,
measurement, review, or artifact that decides the outcome, the exact object it
runs against, and the population or denominator for every count or rate.

`CARD TYPE.` must be `design-backed` or `small-task`. If it is
`design-backed`, the named design must exist at the current base and the card
must move one of its covered rows toward acceptance. If it is `small-task`,
the card must name the bounded defect or evidence and the reason no design is
needed. Use the dedicated [Small-task template](references/card-template.md#small-task-template)
for that path.

For a check or gate, state the seeded defect or mutation that must turn it red
and the clean object that must turn it green. A green run without a falsifier
does not discharge a gate claim.

When handing work to review, the implementer must lead with the **key result**
and then give the reviewer the information needed to act without
reconstructing the work. The handoff includes the object (`base → tip`, tree),
artifact/report path, resolvable identity (`rev:path`), evidence class, selected
check and result with population or scope, seeded-red/clean-green proof,
evidence bound, residual or decision needed, and the reviewer's expected
action. Use the `## Review handoff — <topic>` shape defined by `flow-common`.

## Raft command sequence

`raft task create` has no description flag. Create the card first, then amend
it immediately with the body:

```bash
raft task create \
  --target "#channel" \
  --title "[Tag] imperative outcome"

raft task amend \
  --target "#channel" \
  --number 123 \
  --description "$(cat /path/to/card-body.txt)"
```

Add `--assignee @name` to `create` when the card should be reserved
immediately. Self-assignment starts work; owner or admin assignment to another
eligible handle reserves a `todo` card for that handle. Claim before doing the
work when the card is unassigned:

```bash
raft task claim --target "#channel" --number 123
raft task update --target "#channel" --number 123 --status in_progress
```

Use `raft task history --target "#channel" --number 123` to inspect prior
amendments. `raft task amend` is append-only: it preserves the prior body in
history. Amend when scope, authority, acceptance, worktree, or report shape
changes. Do not silently diverge from the current card.

Use `raft task update` only for lifecycle status:

```text
todo -> in_progress -> in_review -> done
                              \-> closed
```

`in_review` means the workstream report and evidence are ready for the
workstream review. `done` means acceptance is complete, not that a branch was
pushed. `closed` means the work will not be done and must state why.

Keep Raft card status separate from the design lifecycle. A card can be
`in_progress` while its design is `reviewed`, or `done` while a broader
workstream still needs deployment or live acceptance. Do not use Raft status
words as a substitute for `draft`, `reviewed`, `pending-retro`, or `landed`.

If assignment was made by mistake, use `raft task unclaim` to release a
claimed card or `raft task unassign` to clear the assignee. For a
resource-creating card, record every required `raft task receipt` field before
moving to `done`.

## Working a card

- Read the current card body and its amendment history before starting. The
  current projection is the card; an earlier thread summary is not.
- Verify the named base and worktree before editing. Record the branch,
  worktree, and base in the card when relevant.
- Keep the card's scope bounded by path, system, or observable surface. Name
  what is out of scope when adjacent work could be mistaken for this card.
- Put safety, production, ownership, permission, and stop conditions in
  `BOUNDS`. Do not infer authorization from assignment or from an earlier
  card.
- If blocked, keep the card in progress and report the exact blocker, the
  owner who can lift it, and the condition that resumes the work. The blocker
  belongs in the card or its linked report only when it changes future
  execution.
- Do not use `--no-verify`, deploy, write production, run migrations, or mutate
  shared configuration unless the current card or owner explicitly authorizes
  that action.

## Review and close

The workstream review is the review boundary. When all cards in the workstream
have finished:

1. Produce one report from the workstream's evidence surface.
2. Include the exact pushed tip and remote verification for repository work.
3. State the acceptance command or measurement, the tested object, and any
   unresolved population or evidence bound.
4. Move the card or cards to `in_review`.
5. After acceptance, mark them `done`; for a merged lane, close the absorbed
   cards with their merge reason instead of pretending they completed
   separately.

A branch name, a local commit, a green test run over the wrong revision, or a
`rc=0` push result is not landing evidence. Read the target ref back and verify
that it contains the reviewed object. A required-worktree card is not done at
push or review; its acceptance also covers merge, target verification, and
cleanup unless the card names a later owner and lift condition.

## Card anti-patterns

- One card per micro-fix with no goal-file workstream.
- A card that is neither directly mapped to a design nor explicitly small.
- Related small tasks split across separate cards instead of one batch.
- A review request after every card.
- Design prose pasted into the card instead of a design pointer.
- Vague acceptance such as "verify it works" or "run tests".
- A gate claim with no seeded red or equivalent falsifier.
- Multiple writers editing one tree or file without a partition.
- Closing on a branch name rather than the verified remote tip.
- Calling work landed when only a local commit, worktree, or unread push
  result exists.
