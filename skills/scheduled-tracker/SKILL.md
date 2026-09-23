---
name: scheduled-tracker
description: Maintain a recurring 20-minute tracker for active project work. Use when the user asks to arm, run, or resume a scheduled work tracker, periodic project checkpoint, or recurring progress/defect review. The tracker keeps high-level project understanding, the current goal, work-item progress, and process defects aligned; requires a first-principles rethink after one hour in the same state; and ends every wake as done or blocked.
---

# Scheduled Tracker

Use this skill when active work needs a recurring external checkpoint. The
tracker is a lightweight control loop, not a second project plan.

## Arm

Anchor the reminder to the message or thread that owns the work:

```sh
raft reminder schedule \
  --title "Scheduled tracker: <current work>" \
  --repeat every:20m \
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
   action.

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
state, then the next owner and action. Do not paste routine command logs.
