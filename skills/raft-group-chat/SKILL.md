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
reader's lookup cost, name what you are setting aside, keep process in its place,
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

## Handoffs: state the reading, do not wait

When a message hands you work, send **one short line before you start**: what you
understood and the first thing you will do. This makes the reading visible while
it can still be corrected.

The line carries three things, all from `report-style`:

1. **The located subject** — project, module or area, and the thing under change
   (`../report-style/SKILL.md`, *Locate the subject before you add to it*).
   "Session storage: the installed and hosted ledgers" locates the problem; "the
   two worlds" does not.
2. **What you are setting aside** — the competing reading or the option you are
   not taking, in the same line (`../report-style/SKILL.md`, *Name what you are
   setting aside*). This is what lets a peer who knows the other option correct
   you in one reply.
3. **Precision over brevity** — the problem statement is as precise as the reader
   needs, because brevity is never the thing to trade it for.

> "In `agent-substrate`, I will split storage into two module directories, and leave
> the `session` and `run` ledgers where they are for now."

Do not hold for confirmation because the reading might vary. If the reading
conflicts with another one in the thread, the group can point that out from the
visible statement; waiting turns collaboration into ceremony.

## Messaging commands: classify the result before retrying

Raft command success is not `exit == 0`. A non-zero result can be a delivered
failure, a safe hold, or a refusal, and each needs a different response.

- `SEND_HELD_AS_DRAFT` means the message is safely saved but not delivered.
  Read the pending message to clear the freshness hold, then send the
  unchanged draft. Do not compose the message again: a second composition can
  create a duplicate.
- `PROXY_5XX` and connection failures are transport failures. The command may
  still have saved a draft; check that state, then retry the operation.
- A refusal caused by invalid input needs the input corrected. Retrying it
  unchanged repeats the refusal.

Discriminate on the command's structured status code or `--json` output, not
on a substring such as "draft". A transport failure can also print that a
draft was saved. `$?` alone does not identify the recovery.

The observed sequence is:

```text
send                 -> transport failure; draft saved
send --send-draft    -> SEND_HELD_AS_DRAFT; read pending message to clear hold
send --send-draft    -> delivered
```

Three non-zero exits can therefore produce one delivery and no duplicate.
Read [`references/messaging-results.md`](references/messaging-results.md) for
the full classification and recovery table.

## Completion check

A task card is ready when its design line, acceptance criteria, and named owner
are visible. A message is ready when a reader who knows the goal but not the
participants' private shorthand can identify what happened, what state it is
actually in, what it means, and who acts next.
