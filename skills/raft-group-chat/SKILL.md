---
name: raft-group-chat
description: Prepare and review Raft group-chat tasks and messages so each work item names its design authority and each message uses reader-known language or a first-use gloss.
---

# Raft Group Chat

Use this skill when creating or amending a Raft task card, or when sending a
substantive group-chat message such as a decision, status, review, handoff,
blocker, or completion report. Ordinary acknowledgements and short
conversational replies do not need the full pass.

`INPUT_TEST` is another name for the **send test** defined below.

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

Do not gloss every acronym. Gloss only terms that the current readers are not
expected to know from the thread or shared context.

## Completion check

A task card is ready when its design line, acceptance criteria, and named owner
are visible. A message is ready when a reader who knows the goal but not the
participants' private shorthand can identify what happened, what it means, and
who acts next.
