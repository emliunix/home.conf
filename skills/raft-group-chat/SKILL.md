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

## Messages: reader, wording, claims

Before drafting a message, apply the send test. Send only when the message
changes a decision, answers a question that was asked, carries a result someone
is waiting for, or raises a problem. Do not send a message that only repeats a
settled fact, narrates process, or reports that someone already did the work.

Before sending a message that passes the send test:

1. Identify the readers and the context they may be missing.
2. Use terms already defined in the thread. On first use of a term that is not
   generally known, give a short gloss: its plain-language meaning and why it
   matters in this message. Reuse that term afterward.
   **A bare identifier is not a gloss.** Card numbers (`#260`, `task #15`),
   commit SHAs, branch names, file paths, and internal status words are private
   shorthand unless the reader already uses them in the same thread. Write the
   meaning into the sentence that first uses the identifier — "the
   control-plane identity change that requires an idempotency key (`#260`)" —
   and never hand the reader a lookup table, a glossary posted afterward, or a
   list of numbers to resolve on their own. This binds every substantive
   message, not only owner-facing ones, and it is a duty of the sender: if a
   sentence needs the identifier to be understood, the sender has handed the
   reader work the sender should have done. The owner named this failure
   directly on 2026-09-30: "I know they are card numbers, you expect me to
   lookup each one every time?"
3. Name the specific event or object. For example, write "the paused-to-ready
   goal transition started a second run," not "the flip collided."
4. Open the file, run, record, or decision that the message depends on. Do not
   review only the sentence that names it. If the underlying source is not
   available, say so and mark the claim as reported or inferred rather than
   checked.
5. **A universal claim names the members you read.** Words such as "all",
   "every", "none", and "the corpus" stand for a set. Name the members actually
   read, or write "I read N of M". A set inferred from a search term rather
   than read does not support the claim.
6. **Every figure travels with its base.** Give the population and the command
   or scope that produced the number, and do not measure a negative over a
   window shorter than the period of the thing you claim did not happen. A
   count without its base cannot be reproduced.
7. **Every claim names its subject, not only its extent.** Rules 5 and 6 bound
   how far a claim reaches; this one says what it is about. Four subjects are
   routinely confused, and the failure is invisible because the sentence stays
   true about the wrong one.
   - **Artifact versus running system.** An edited file is not a loaded module.
     Say which one changed. "The fix is applied and verified" reads as "the
     effect is present"; write "the file is patched, but no running process has
     loaded it."
   - **The moment of observation.** A negative is only about the window you
     looked. If the subject is created and later cleaned up, name when you
     sampled; "zero directories after the run" is exactly what a healthy run
     leaves behind.
   - **Your instrument versus the subject's rule.** A result is evidence about
     what your command read. Before writing "the check has a hole" or "the
     sweep missed X", say what population your instrument read versus the one
     the subject reads.
   - **The act a phrase denotes, when it admits two.** If "correct X" can mean
     relabel or rewrite, name which. Two people acting in good faith on the
     same instruction will otherwise contradict each other.

   And keep measured separate from inferred. *Measured*, *reproduced* and
   *verified* are claims about evidence; do not state a deduction in measurement
   grammar.

Do not gloss every acronym. Gloss only terms that the current readers are not
expected to know from the thread or shared context.

## Every result names what was tested, why, and what it means

The most common failure is a bare result: "the test passes." It leaves three
slots empty, and the reader cannot tell whether the sentence supports the
decision in front of them.

1. **What ran, on what.** Name the check or artifact and its subject: "the
   pairwise check over all 18 refusal emitters and their 60 writer sites" —
   not "the test."
2. **What property it tests.** State the claim, not the file name: "every
   refusal path writes the same envelope before responding." A reader who does
   not know the suite cannot recover this from a test name.
3. **What the outcome means for the decision.** Say what the reader should
   conclude and what stays outside the result: "the pairing is complete; this
   does not show the envelope's content is correct."

The same shape applies to any result, not only tests: a review, a probe, a
census, a migration. A result without its purpose and meaning is a fact the
reader has to interpret before they can use it.

## Corrections that do not leave the old belief live

A retraction names the belief it removes. "My earlier claim was wrong" leaves
the reader holding whatever the old wording implied. Say what a reader would
have concluded from it, and that they should discard that conclusion. A
correction that only negates the sentence lets the false belief survive.

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
