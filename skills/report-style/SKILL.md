---
name: report-style
description: >-
  Use when writing or reviewing a durable source-keyed report, a concise report
  brief, or a substantive status, decision, review, or handoff message. Route by
  the reader's dominant question, then choose whether the answer must survive the
  conversation. Not for prose polish, for performing the review or investigation
  itself, for a bare activity log, or for restructuring an existing structured
  record.
---

# Report style

This skill is a dispatcher. Every rule below is mandatory and fits on one line; the
reference named beside it carries the reasoning and the worked examples. Read the rules
here, open a reference only when you need the detail.

## Route first

Two independent choices, in this order.

**1. Kind — the reader's dominant question.** Read
[references/catalog.md](references/catalog.md) and choose exactly one:

| The reader's question | Kind | Template |
| --- | --- | --- |
| What is this system, and how does it behave? | system | [system-report.md](references/system-report.md) |
| What is different now? | change | [change-report.md](references/change-report.md) |
| What is usable now, and what is blocked? | status | [status-report.md](references/status-report.md) |
| Why was this direction chosen? | decision | [decision-report.md](references/decision-report.md) |
| Is the reviewed subject sound and ready? | review output | [review-report.md](references/review-report.md) |
| What do the sources establish? | research | [research-report.md](references/research-report.md) |
| What happened, and what should change? | retrospective | [retrospective-report.md](references/retrospective-report.md) |

Choose one primary kind. Borrow at most one secondary kind's aspects; never concatenate
every template.

**2. Shape — how long the answer must survive.**

- a **record** survives the conversation: durable, self-contained, source-keyed;
- a **brief** transfers the answer in one sitting and may assume shared context.

A message is always a brief. See [references/writing-discipline.md](references/writing-discipline.md)
for both shapes in detail.

The kind controls **what must be explained**. The shape controls **how much context and
source machinery travels with it**.

## Mandatory rules

### Locate the subject before you add to it

Name the project, the module or area, and the thing under change, **then** state the new
information. Put what the reader already holds at the front and the point at the close.

- A pointer is not a subject: write the meaning into the sentence that first uses a card
  number, SHA, branch, or path.
- Never hand the reader a lookup table to resolve on their own.

*Why, with the source:* [references/writing-discipline.md](references/writing-discipline.md#locate-the-subject).

### Orient to the reader's lookup cost

Before sending, run one thought experiment: **can this reader act without leaving the
message?** Decide which reader you have.

- **An agent reader** needs a reference plus a precise problem statement. Following the
  reference is expected work, not a cost to reduce.
- **A human reader** needs the same precision, but dislikes lookup. Put the context in the
  message.

Precision is never the thing to trade for brevity.

*Why:* [references/writing-discipline.md](references/writing-discipline.md#orient-to-the-readers-lookup-cost).

### Name what you are setting aside

Before acting, state the competing reading or the option you are **not** taking, in the
same line. A choice stated alone reads as settled, and a reader who knows the alternative
has nothing to push against.

*Why:* [references/writing-discipline.md](references/writing-discipline.md#name-what-you-are-setting-aside).

### Keep process in its place

Separate **domain or runtime flow** (included when it answers the question), **change
order** (included when order changes meaning or safety), and **work history** (omitted
unless the process is the subject, blocks something, or establishes cause).

*Why:* [references/writing-discipline.md](references/writing-discipline.md#keep-process-in-its-place).

### Make every claim checkable

- Open the source, not the sentence that names it. Mark anything unopened as reported or
  inferred.
- A universal claim ("all", "every", "none") names the members you read, or says "I read
  N of M".
- Every figure travels with its base: the population and the command or scope that
  produced it.
- Every claim names its subject: artifact versus running system, the observation window,
  your instrument versus the subject's rule, and which act an ambiguous verb denotes.
- Keep *measured*, *reproduced* and *verified* separate from inferred.
- A result names what ran, what property it tested, and what the outcome means for the
  decision — and what stays outside it.
- A correction names the belief it removes, so the reader discards the old conclusion.

*Why, with all four subject confusions:* [references/writing-discipline.md](references/writing-discipline.md#make-every-claim-checkable).

### End at a claim boundary

Close with what is established, what is designed but not observed, what is unresolved, and
what is deliberately not claimed. Do not close with another summary.

*Why:* [references/writing-discipline.md](references/writing-discipline.md#end-at-a-claim-boundary).

### Subtract before adding

Cut repeated summaries, process narration, and decorative sections. For every proposed
section ask: *"would removing this stop the reader understanding the answer, making the
decision, or trusting the boundary?"* If not, remove it.

*Why:* [references/writing-discipline.md](references/writing-discipline.md#subtract-before-adding).

## Reports that ask for a decision

`INPUT_TEST` is the quality test for a report that asks someone to decide. A list of
decisions is not decision-ready merely because each item has a name. Supply all eight
fields from the decision-request subtemplate in
[references/decision-report.md](references/decision-report.md#decision-request-subtemplate),
accepted by the `DR-*` items in [tests/rubric.yaml](tests/rubric.yaml).

The field most often omitted is **the consequence of not deciding**; when it is missing,
the reader infers that silence is safe.

## Discipline of the surface itself

- Use the active voice and name the actor: write "the sweep reopens the store", not "the
  store is reopened".
- Give link text that names its destination, so the reader can decide whether to follow it.
- Put a condition before the instruction it guards.
- When the document uses codes, symbols, or shorthand, include a **reader key** rather
  than making the reader look it up — **Glossary** for terms, **Codes, abbreviations, and
  acronyms** for project shorthand, **Notation** for symbols, **Source keys** for source
  labels. A **legend** is the narrower term for a table that decodes marks or colors.
- Preserve the source's vocabulary. Define an overloaded term rather than silently
  paraphrasing it.

*Why, with the sources:* [references/writing-discipline.md](references/writing-discipline.md#discipline-of-the-surface-itself).

## Shape of a record

Write in this order: capture sources -> select kind -> write the description -> add
diagrams -> resolve the reader key -> write the abstract last.

| Element | Optional | Carries |
| --- | --- | --- |
| Abstract | no | One page or less: the question, the load-bearing answer, the consequence. Introduces no claim the description does not expand. |
| Description | no | Numbered, claim-bearing sections from the chosen kind's aspects. |
| Diagrams | yes | One claim per diagram, named and captioned. Cut any diagram that repeats adjacent prose. |
| Reader key | no | Only the subsections the report needs, carrying only marks, codes, and terms actually used. |
| Open capture list | yes | Unreachable primary sources, the blocker, and the intended capture method. Never reconstruct an unavailable primary from memory. |

Every factual claim carries a source key; every key resolves; capture scope names the
artifact, branch or tag, date, and whether it is pinned. Verify local links against the
filesystem before finishing. The skeleton is in
[references/writing-discipline.md](references/writing-discipline.md#shape-of-a-record).

## Boundary

This skill shapes a report; it does not perform the underlying review, research, incident
response, or retrospective method. Use the applicable method first, then the kind template
to communicate its result. A structured source record that already answers the same reader
question is linked or summarized, not rewritten as a second source of truth.

[`raft-group-chat`](../raft-group-chat/SKILL.md) adapts these rules for a group-chat
surface. It does not restate them.
