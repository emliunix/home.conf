---
name: scheduled-tracker
description: Maintain a recurring 30-minute tracker for active project work. Use when the user asks to arm, run, or resume a scheduled work tracker, periodic project checkpoint, or recurring progress/defect review. The tracker keeps high-level project understanding, the current goal, work-item progress, and process defects aligned; guards against over-engineering and ceremonial over-review; requires a first-principles rethink after one hour in the same state; and ends every wake as done or blocked.
---

# Scheduled Tracker

Use this skill when active work needs a recurring external checkpoint. The
tracker is a lightweight control loop, not a second project plan.

## Arm

Anchor the reminder to the message or thread that owns the work:

```sh
raft reminder schedule \
  --title "Scheduled tracker: <current work>" \
  --repeat every:30m \
  --channel "<channel-or-thread>" \
  --message-id "<anchor-message-id>" \
  --tz Asia/Shanghai
```

Use one reminder for the active work item. Update its title or cadence when the
work changes. Cancel it only when the work is done or explicitly paused.

## Each wake

Run these checks in order and keep notes brief:

1. **Routine check.** Read the owning thread and task board. Identify new
   instructions, changed state, and unowned or stale work.
2. **High-level understanding.** Re-state the system boundary and ownership in
   one or two sentences. If that cannot be done from the current record, treat
   the missing context as a documentation or onboarding defect.
3. **Goal clarity.** State the outcome currently being pursued and the evidence
   that would close it. Distinguish landed behavior from proposed work.
4. **Work-item progress.** Mark each active item `on track`, `stale`, `blocked`,
   or `done`. Name the owner and the next observable result.
5. **Process defect review.** Look for drift, duplicated authority, unsupported
   status claims, unverifiable work, hidden compatibility, or a check that does
   not fail on the defect it claims to catch. Record the smallest corrective
   action. Run the lead template's over-engineering and over-review stop checks
   before proposing more work, more review, or another check.

## Per-seat checklists

The five checks above are the general control loop. What each one means for a
particular seat is a checklist in
[`templates/`](templates/) — pick the one that matches the seat, do not invent a
sixth:

- [`templates/observer-pass.md`](templates/observer-pass.md) — a seat whose job is
  watching. Expands the routine check into a nine-row pass, and names the two
  things an observer must not do (land fixes in another seat's lane; report an
  unfilled row as clean).
- [`templates/implementer-wake.md`](templates/implementer-wake.md) — a seat that
  lands work: one writer per tree, hand off by commit id, exit on evidence.
- [`templates/tracker-wake.md`](templates/tracker-wake.md) — a seat that owns the
  board: dispositions, ownership, reachability by tip, labels traceable to
  measurements.

A project that runs one of these seats usually keeps its own local extension — the
same checklist with the *instances that earned each rule* attributed, plus that
project's routing. Keep the general form here; keep the instances there, because an
instance is evidence and evidence belongs to the project that paid for it.

## One-hour rethink

If one work item has remained in the same state for more than one hour:

1. Stop adding implementation.
2. Step back and re-derive the outcome from first principles.
3. Run an ablation thought experiment: remove the proposed component, layer,
   step, or feature and test whether the outcome still holds.
4. Decide: continue, narrow, replace, or escalate. Record the evidence and the
   decision.

Do not treat elapsed time alone as proof of overengineering. The trigger opens a
review; the evidence decides.

## Scope, review, and task-track guards

These are standing lead checks, not a second methodology:

- **Over-engineering guard.** Before adding a component, layer, gate, migration,
  compatibility path, or process step, name the current outcome, the smallest
  change that reaches it, and the credible do-less alternative. If the addition
  does not change a decision or observed result, do not add it. An explicit
  owner requirement is a constraint, not something to vote away.
- **Over-review guard.** One review pass per landing decision. Stop when further
  reading cannot change that decision. A second pass needs new evidence, a
  consequential unresolved disagreement, or a required independent seat; more
  ceremony is not more confidence. A reader who touched the work discloses the
  overlap instead of recusing, and the result is called a cross-check.
- **Task-track guard.** Reconcile every active card against the tree and the goal
  it serves. Finished and quality-met work is merged, and its worktree is removed
  or its holder states why it cannot be. Unfinished work names its owner, next
  observable result, and review condition. Blocked work names the blocker, owner,
  and lift condition. Unowned work is assigned or escalated, never left as a
  resting state. **Claim or notify before acting on a shared or live surface** —
  a service probe, live database read, credential use, or machine-level operation
  is work, and a one-line claim or notice goes out before it starts.

When either the engineering or review guard trips, the lead posts one short,
specific reminder to the owning thread: the action being added, the outcome it
does not change, and the smaller action to take instead.

## Exit condition

Every wake ends with the tracked work either:

- **done**: the claimed result has direct evidence and the owning task can move
  to `in_review` or `done`; or
- **blocked**: the exact blocker, accountable owner, and lift condition are
  stated, and the next action is assigned.

Do not leave an item indefinitely `in progress` without one of those outcomes.

## Output

Post one short update in the owning channel or thread only when there is a
material change, decision, blocker, or required review. Lead with the exit
state, then the next owner and action. Include the concrete task-track
disposition when a card moved, stalled, landed, or became blocked. Do not paste
routine command logs.
