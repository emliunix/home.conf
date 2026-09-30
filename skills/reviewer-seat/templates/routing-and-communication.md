# Routing and communication — template

How a seat's output reaches the people who act on it. The rules below are about *placement*: the
same sentence lands very differently in a lane thread, a tracker thread, and a channel.

## State has no latency budget

Route state to the periodic pass; only **action-now** pierces a seat as a message. This is the
single biggest lever on the churn a team generates, and it cuts both ways:

- A seat on a scheduled pass should not narrate its progress turn by turn. The pass is where
  state accumulates, and a reader who wants state knows where to look.
- Anything that changes what someone else must do *now* is not state — it pierces immediately,
  even mid-pass.

Per-seat routing: seats whose work is deep and interruptible mute the channel and follow their
lane threads; a seat whose job *is* watching keeps delivery. Name the cost of each choice — a
muted channel misses unassigned-card announcements, which is right for a seated lane and wrong
for a seat hunting work.

## Marks and lanes

A message carries exactly one delivery class, and **the lane is chosen before the message is
written**. Most team-chat systems offer two:

- **Interrupt** — an addressed notification that pierces mutes and quiet (a mention, in most
  systems). Use it only when the recipient owes something *now*.
- **Awareness** — a plain post, delivered on the recipient's periodic read, or addressed quietly
  (a DM, or a thread the recipient follows). This is the CC lane; it needs no prefix.

**Marks (`FYI:`, `CC:`, and friends) are courtesies on top of that decision, not a substitute for
it.** Test any mark you invent against one question: *can the delivery layer read it?* If not, it is
read by people only, and it changes nothing about who sees what or when. A mark is real only when
something mechanical enforces it.

The one combination to avoid: **an interrupt that then says no action is wanted.** It costs the
recipient the interruption and gives them nothing to do — the worst of both lanes. If a message needs
no action, it takes no interrupt.

Where a system has no separate "copied" field, that is usually by design: one target per message,
audience derived from membership. "Quietly addressed" is then spelled with the venue (a DM or a
followed thread), never with a prefix.

## Venues

| Output | Venue |
| --- | --- |
| State, drift, the pass itself | the tracker thread — the standing record |
| A correction to a specific claim | the thread where the claim was made, one message |
| Something that only the owner can decide | the owner's thread, stated as a decision, not a status |
| Work on a card | that card's thread |
| A request for an independent read | the tracker thread, naming the artifact and the commit |

Reply where the conversation is. A correction does not get its own announcement in a second
venue; the thread that carries the claim carries the correction.

## Message discipline

- **Lead with the answer.** The first sentence should be the thing the reader would ask for.
- **One message per correction**, with the verification of the correction attached. A correction
  is a claim like any other and ships with its own measurement.
- **Concede precisely, and in the same register.** Withdraw a false framing explicitly rather than
  softening it; a softened error survives in the reader's memory as true.
- **Batch the rest into the pass.** Several small findings are one message, not several.
- **Write for the reader you have.** Human: the answer first, plain sentences, no internal
  shorthand. Agent: the artifact, the commit, the command — the things it will re-run.
- **Say what you measured versus what you read.** "Reproduced" and "as reported" are different
  claims and should never share a sentence.

## Three numbers, no single grade

Report latency, overhead, and the instrument-repair ratio — never one aggregate score:

- **Latency** — report → closed, per arc.
- **Overhead** — churn-to-work: messages and coordination per unit of commissioned work.
- **Instrument-repair ratio** — how much of the effort went into fixing the tools that check the
  work rather than the work itself.

The diagnostic pair is overhead against ratio. High overhead with a **moving** ratio is a process
paying for its own improvement; high overhead with a **static** ratio is the same work being
rediscovered. Latency alone hides both, and a single grade hides which of the three moved.
