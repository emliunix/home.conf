# Raft task card body

Start from the project's design and goal conventions. Replace every placeholder,
and delete only fields that genuinely do not apply. Keep the body executable:
the owner should not need the original conversation to understand the outcome
or the acceptance.

```text
SUBJECT. The concrete change, question, or evidence to produce.

CARD TYPE. design-backed | small-task.
  For design-backed: Follow the design and goal workflow. Name the design
  directly.
  For small-task: state why this bounded repair or evidence task needs no design
  change, list the related small items batched into this card, and record that
  the merged workstream is assigned to one agent and reviewed once as a batch.

DESIGN. <design path and section>; amends | implements. If no design change is
needed, write "None" and state what the card does instead.

GOAL. <goal path and workstream/design slot>; or None when the work is not
sprint-governed. Name the workstream explicitly when the card is part of one.

PROJECT GUIDANCE. <repository conventions, AGENTS.md, design guide,
verification module, or other owning instruction>.

WORKTREE. required | not-needed. <reason>. Base/ref: <commit or ref>. If
required, include creation identity, gate, merge/replay, target verification,
cleanup, and any shared-resource lock in acceptance.

AUTHORITY. <owner decision, accepted object, or source that authorizes this
card>. Do not use assignment as a substitute for action-specific permission.

SCOPE. <allowed paths or systems>. Name adjacent work that is out of scope when
it could be confused with this card.

REQUIRED OUTCOME.
1. <observable result>.
2. <observable result>.

ACCEPTANCE. <exact command, measurement, review, or artifact>, against
<exact object, revision, or population>. For every count or rate, name the
denominator or population. State the result that counts as accepted.

CHECK PROOF. For each claimed gate or check: <command> -> seeded defect or
mutation expected RED; clean object expected GREEN. Write "None" when the card
claims no check.

EVIDENCE BOUND. What the selected instrument cannot see: excluded paths,
unreadable or unresolved cases, wrong-revision risk, or another named coverage
limit. Write "None known" only after checking.

TEST TIER. focused | full | milestone-e2e | none. <reason>.

REPORT. <durable receipt path and section>; or the project-selected receipt
surface. Name the single workstream report when more than one card is in the
lane.

REVIEW HANDOFF. Lead with the key result for the reviewer. Then provide the
object (`base → tip`, tree), artifact/report path, resolvable identity
(`rev:path`), evidence class, selected check and result with population or
scope, seeded-red/clean-green proof, evidence bound, residual or decision
needed, and the reviewer's expected action. Use
`## Review handoff — <topic>` as the durable heading.

LOGS. <raw stdout/stderr path>, including the checked command's working
directory, start time, and exit status.

BOUNDS. Safety, production, ownership, concurrency, permission, and stop
conditions. Name the writer boundary for each file or worktree.
```

## Small-task template

Use this shape when `CARD TYPE.` is `small-task`. Related small tasks are
merged into one workstream, assigned to one agent, and reviewed once as a
batch.

```text
CARD TYPE. small-task. State why this bounded repair or evidence task needs no
design change, and list the related small items merged into this workstream.

DESIGN. None. <reason no design change is needed>.

GOAL. <goal path and workstream>; this card batches <related items>.

OWNERSHIP. One agent owns this small-task batch: <@agent>.

PROJECT GUIDANCE. <repository conventions, AGENTS.md, design guide,
verification module, or other owning instruction>.

WORKTREE. required | not-needed. <reason>. Base/ref: <commit or ref>.

AUTHORITY. <owner decision, accepted object, or source that authorizes this
card>.

SCOPE. <allowed paths or systems>. Name adjacent work that is out of scope.

REQUIRED OUTCOME.
1. <observable result>.
2. <observable result>.

ACCEPTANCE. <exact command, measurement, review, or artifact>, against
<exact object, revision, or population>. State what counts as accepted.

CHECK PROOF. For each claimed check: <command> -> seeded defect or mutation
expected RED; clean object expected GREEN. Write "None" when no check is
claimed.

EVIDENCE BOUND. What the selected instrument cannot see, or "None known" after
checking.

TEST TIER. focused | full | milestone-e2e | none. <reason>.

REPORT. <durable receipt path and section>; the single batch report is the
review handoff.

KEY RESULT. The implementer states the key result first, in one or two lines,
before method or history.

REVIEWER ORIENTATION. Give the reviewer the object (`base → tip`, tree),
artifact/report path, resolvable identity (`rev:path`), evidence class,
selected check and result with population or scope, seeded-red/clean-green
proof, evidence bound, residual or decision needed, and the reviewer's
expected action. Use `## Review handoff — <topic>` as the durable heading.

LOGS. <raw stdout/stderr path>, including the checked command's working
directory, start time, and exit status.

BOUNDS. Safety, production, ownership, concurrency, permission, and stop
conditions. State the one-agent and one-batch-review boundary explicitly.
```

## Delivery sequence

Create the raw card, then amend it with the body because `raft task create`
does not accept a description:

```bash
raft task create --target "#channel" --title "[Tag] imperative outcome"
raft task amend --target "#channel" --number 123 \
  --description "$(cat /path/to/card-body.txt)"
```

Add `--creates-resource` at creation when the card creates a persistent
resource. Add `--assignee @name` only when the workstream owner or dispatch
decision is already clear.
