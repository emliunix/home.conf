---
name: raft-group-chat
description: Prepare and review Raft group-chat tasks and messages, including ordinary status, result, and progress messages - so each work item names its design authority and each message uses reader-known language or a first-use gloss. Status and result messages are written in the `report-style` brief form by default - outcome and its number first, what it changes, what the reader must do.
---

# Raft Group Chat

Use this skill when creating or amending a Raft task card, or when sending a
substantive group-chat message such as a decision, status, review, handoff,
blocker, or completion report. Ordinary acknowledgements and short
conversational replies do not need the full pass.

## Status and result messages default to brief

A result, status, or progress message is written in the `report-style` brief form:
outcome and its number first, what it changes, what the
reader must do. Do not narrate the investigation ("I checked X, found Y, which
turned out to be Z") and do not recount a discarded hypothesis unless the
reader's decision depends on it. Method goes in the card or the report file, with
a one-line pointer.

One exception, and it is not optional: **a number or conclusion that was
previously published and is now corrected is stated in one line** ("was 524, now
472 - the window straddled two revisions"). Compression drops narration, never a
correction the reader may already be holding.

## Section labels are headers

When a message has sections, write each label as a Markdown heading on its own
line (`## What the problem is`), not as an inline lead-in with the first
sentence on the same line (`**What the problem is.** ...`). The header form
scans, and it lets a reader jump between parts; the inline form buries the label
in the paragraph it is supposed to precede.

## Task cards: name the design authority

Every task that can change behavior, a contract, schema, interface,
architecture, or an operational policy must carry a `DESIGN.` line in its body.
"Design authority" means the file that owns the decision. Link to that file and
name the relevant section when one exists.

Every task that can edit a repository also carries a `WORKTREE.` line:
`required | not-needed`, the reason, and the base/ref. When a worktree is
required, merge/replay, target verification, and cleanup are acceptance items.
The owning definition is
[`../worktree-sop/SKILL.md`](../worktree-sop/SKILL.md), including the
heavy-gate lock; this skill does not restate the lifecycle.

- If a numbered design exists, link it and say whether this task amends it or
  implements it.
- If no numbered design exists, link the project's design staging or archive
  file and state the graduation path. For example: "staging: `path`; graduate
  by allocating or amending a numbered design before implementation."
- If the task needs no design change, write `DESIGN. None.` and say what the
  task does instead. For example: "DESIGN. None. This card verifies ancestry
  and does not change behavior."

Do not invent a design path or cite an index as though it were a design. Before
creating or amending a card, read the current task body and verify that the
linked file exists at the named base.

## Messages: the send test

Before drafting a message, apply the send test. Send only when the message
changes a decision, answers a question that was asked, carries a result someone
is waiting for, or raises a problem. Do not send a message that only repeats a
settled fact, narrates process, or reports that someone already did the work.

A message that passes the send test follows **`report-style`**. Read it, or its
discipline reference, rather than a copy: locate the subject first, orient to the
reader's lookup cost, state what you are not doing, keep process in its place,
make every claim checkable, and end at a claim boundary. The rules and their
sources live at
[`../report-style/SKILL.md`](../report-style/SKILL.md) and
[`../report-style/references/writing-discipline.md`](../report-style/references/writing-discipline.md).

Two clauses bind harder in a group chat than in a document, because the reader
cannot see the rest of your context:

- **A bare identifier is not a gloss.** Card numbers, commit SHAs, branch names,
  file paths, and internal status words are private shorthand unless the reader
  already uses them in the same thread. Write the meaning into the sentence that
  first uses the identifier — "the control-plane identity change that requires an
  idempotency key (`#260`)" — and never hand the reader a lookup table, a glossary
  posted afterward, or a list of numbers to resolve on their own. The owner named
  this failure directly on 2026-09-30: "I know they are card numbers, you expect me
  to lookup each one every time?"
- **Name the specific event or object.** Write "the paused-to-ready goal
  transition started a second run," not "the flip collided."

Do not gloss every acronym. Gloss only terms the current readers are not expected
to know from the thread or shared context.

### Claims: open the source, name the members, carry the base

- **Open the source the message depends on.** Open and read the file, run,
  record, or decision the message relies on; do not review only the sentence
  that names it. If the source is not available, mark the claim reported or
  inferred, not checked.
- **A universal claim names the members you read.** "All", "every", "none" and
  "the corpus" stand for a set: name the members actually read, or write "I read
  N of M". A set inferred from a search term rather than read does not support
  the claim.
- **Every figure travels with its base.** Give the population and the command or
  scope that produced the number, and do not measure a negative over a window
  shorter than the period of the thing you claim did not happen. A count without
  its base cannot be reproduced.

## Handoffs: state the reading, do not wait

When a message hands you work, send **one short line before you start**: what you
understood and the first thing you will do. This makes the reading visible while
it can still be corrected.

The line carries three things, all from `report-style`:

1. **The located subject** — project, module or area, and the thing under change
   (`../report-style/SKILL.md`, *Locate the subject before you add to it*).
   "Session storage: the installed and hosted ledgers" locates the problem; "the
   two worlds" does not.
2. **What you are not doing** — the option or competing reading you are not
   taking, in the same line (`../report-style/SKILL.md`, *State what you are not
   doing*). Say it next to what you *are* doing. This is what lets a peer who
   knows the other option correct you in one reply.
3. **Precision over brevity** — the problem statement is as precise as the reader
   needs, because brevity is never the thing to trade it for.

> "In `agent-substrate`, I will split storage into two module directories, and leave
> the `session` and `run` ledgers where they are for now."

Do not hold for confirmation because the reading might vary. If the reading
conflicts with another one in the thread, the group can point that out from the
visible statement; waiting turns collaboration into ceremony.

## Operational recipes

Use [`raft-cookbook`](../raft-cookbook/SKILL.md) for message delivery recovery
and bounded inbox checks. The cookbook owns the canonical send wrapper, the
structured result classification, the freshness-hold sequence, and the poll
bound; this skill does not restate that operational table.

## Completion check

A task card is ready when its design line, acceptance criteria, and named owner
are visible. A message is ready when a reader who knows the goal but not the
participants' private shorthand can identify what happened, what state it is
actually in, what it means, and who acts next.
