# Task card template

Delete fields that do not apply; keep the owning references rather than copying
their content into the card.

```text
SUBJECT. The concrete change, question, or evidence to produce.

DESIGN. <design path §section>; amends | implements. If no design change is
needed, state "None" and what the card does instead.

GOAL. <goal path §workflow slot>; or None when the work is not sprint-governed.

PROJECT GUIDANCE. <project conventions, AGENTS.md, design guide, verification
module, or other owning instruction that governs this card>.

WORKTREE. required | not-needed. <reason>. Base/ref: <commit or ref>.

AUTHORITY. The owner decision, accepted object, or source that authorizes this
card.

SCOPE. Allowed paths or systems. Name what is out of scope when adjacent work is
likely to be mistaken for this card.

REQUIRED OUTCOME.
1. Observable result.
2. Observable result.

ACCEPTANCE. The command, review, or measurement that decides the result, and
the exact object it runs against. For every count or rate, name the population
or denominator the figure is over.

CHECK PROOF. For each claimed gate or check: the command, the seeded defect or
mutation that must make it red, and the clean object that must make it green.
Write "None" when the card claims no check.

EVIDENCE BOUND. What the selected instrument cannot see: excluded paths,
unresolved or unreadable cases, wrong-revision subject, or another named
coverage limit. Write "None known" only after checking.

TEST TIER. focused | full | milestone-e2e | none; reason.

REPORT. receipts/<topic>/<report>.md §Review handoff — <topic>; or the
project-selected durable receipt surface. This is the review handoff and
supersedes a legacy task worklog pointer; a worklog remains narrative history,
not a second handoff.

LOGS. receipts/<topic>/logs/<check>.log; raw stdout/stderr and the checked
command's exit status.

BOUNDS. Safety, production, ownership, and stop conditions.
```
