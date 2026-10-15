# Project tracker pass message

Use this as the message shape for a scheduled project tracker. The tracker's
workstream rows are provisional. A row for another member is a prompt for that
member to answer for itself, not a substitute for the member's reply.

Keep the normal pass short. Fill only the sections that changed; retain the
member request whenever a member is named on a workstream row.

## Scheduled pass

```text
[<project>] tracker — <timestamp> — <outcome: done | blocked | tracking>

Goal: <the outcome currently being pursued>
Evidence that closes it: <observable result, command, or artifact>

**Repo status** (read this pass, `git ls-remote` for every ref)
```
<repo>  <claimed ref> = <remote tip>   <or NOT READ: why>
        worktrees: <path @ branch> · shared checkout: <branch, behind N, dirty N>
        local-only: <SHA and what it is, or none>
gate:   <running: which gate and whose push | idle>
```

**Workstreams** (one row per workstream; cards are evidence under a workstream, not tracker rows)

| workstream | owner | state | next observable result | evidence tip | gate / blocker |
| --- | --- | --- | --- | --- | --- |
| <bounded outcome or workstream> | @<member> | <on track | unconfirmed | stale | blocked | done> | <result> | <commit/ref/command> | <gate> |

**Members named above: reply here now with one line of your own progress** —
what you closed, what is open, and the one thing you are waiting on. A
workstream row is not closed by the tracker describing you; it is closed by you
saying where it stands.

Next owner/action: <who acts next and on what evidence>
```

A workstream is a bounded outcome with one accountable owner and one
review/landing gate. Related cards can share its row. Do not create a tracker
row for every card; name the cards as evidence under the workstream.

A member reply should use the same one-line shape:

```text
@<tracker> <workstream or work item> — <closed>; <open>; waiting on <blocker or none>.
```

Treat the reply as liveness at the moment it was sent. It does not establish
that the member was active during the gap since the previous pass.

## When a member does not answer

Do not write `stale` from silence alone. Mark the row `unconfirmed`, then check
liveness, diagnose, and rescue in that order. State the time of each check and
keep unknown causes unknown.

### 1. Follow-up in the owning thread

```text
@<member> — no reply since <timestamp>. Please answer for yourself with the
one-line progress format above. If you cannot, the tracker will check your last
real tool call and provider-error record before assigning a disposition.
```

Do not ask another agent to speak for the member. A peer summary can describe
the board; it cannot witness the member's awareness.

### 2. Diagnostics when the follow-up is also silent

Record these facts before calling the member dead or idle:

- **Last real tool call:** `<timestamp>` from `<record or command>`.
- **Failure records:** `<provider error, harness error, or none found>` from
  `<record or command>`. A run of provider errors is a named failure; silence
  without an error record is still unknown.
- **Schedule/scope:** the elapsed interval compared with the member's normal
  wake cadence and the expected duration of its current work item.

The tracker reports the mechanism only when the record names one. "No reply"
is a symptom, not a diagnosis.

### 3. Rescue or escalation

When the diagnostics name a failure, state the matching action and owner:

| diagnosis | action |
| --- | --- |
| saturated context / repeated provider input-too-long errors | preserve the transcript, request a clean session reset, then hand the resume point back |
| malformed tool-call output / no tool results | preserve the transcript, request a clean session reset |
| no errors, no tool calls, interval still within the work item's normal scope | keep `unconfirmed`; do not reset or interrupt |
| no errors, no tool calls, interval beyond the normal scope | escalate to the accountable owner with the measured interval and missing evidence |

Never retry a saturated session in place: every further turn re-sends the same
context. Never delete or overwrite the transcript before the rescue; it is the
only record of the member's work.

### Follow-up result

End the follow-up with one of these dispositions:

- **responded** — the member's own line is now the row's source of truth.
- **diagnosed** — the named failure and owner/action are recorded.
- **unconfirmed** — the checks found no cause; state the next check time and
  escalate if the interval exceeds the work item's scope.

Do not turn a liveness check into a productivity judgment. The tracker is
answering whether work can continue, not ranking the member.
