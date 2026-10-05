# Writing discipline

The reasoning behind the mandatory rules in `SKILL.md`. Read this when you need the
*why*, a worked example, or the source a rule descends from. The rules themselves live
in the dispatcher so that a writer who opens nothing still has them.

## Sources

Three sources are used below. Each is quoted rather than paraphrased, so a reader can
check the rule against its origin.

- **Gopen, G. D. and Swan, J. A., "The Science of Scientific Writing,"** *American
  Scientist* 78(6), 1990. The article page is paywalled; the full reprint is hosted at
  `https://cseweb.ucsd.edu/~swanson/papers/science-of-writing.pdf`.
- **Google developer documentation style guide**, `https://developers.google.com/style`.
- **Mensh, B. and Kording, K., "Ten simple rules for structuring papers,"** *PLOS
  Computational Biology*, 2017.

## Locate the subject

### The rule

The first sentence names the project, the module or area, and the thing under change.
State the new information after that, not before.

### Why — the topic and stress positions

Gopen and Swan give the mechanism, and it is about where reading attention lands:

> *"Readers expect a unit of discourse to be a story about whoever shows up first."*

They name the two ends of a unit:

> *"In the stress position the reader needs and expects closure and fulfillment; in the
> topic position the reader needs and expects perspective and context."*

And they define the material that belongs at each:

> *"Readers also expect the material occupying the topic position to provide them with
> linkage (looking backward) and context (looking forward)… We refer to this familiar,
> previously introduced material as 'old information.' Conversely, material making its
> first appearance in a discourse is 'new information.'"*

Mensh and Kording state the same shape as a document rule: **context, then content, then
conclusion.** The first sentence of a unit is the context slot.

### Worked pair

> **Write:** "In the agent-substrate control plane, the reconcile sweep now resumes
> durable stores: it reopens each session's store and calls `resume()`."
>
> **Not:** "The reconcile sweep now resumes stores."

Both are true. The second is unplaceable: a reader who does not already know where the
sweep lives cannot tell whether the change touches their work.

### The pointer is not the subject

A card number, a commit SHA, a branch name, or a file path is a **pointer**. It tells a
reader where to look; it does not tell them what the sentence is about.

> **Write:** "the control-plane identity change that requires an idempotency key (`#260`)"
>
> **Not:** "`#260` needs work."

The second form hands the reader the work of resolving the reference before they can
decide whether the sentence matters to them.

## Orient to the reader's lookup cost

### The rule

Before sending, run one thought experiment: **can this reader act without leaving the
message?** The answer differs by reader, so decide which reader you have.

| Reader | Needs | Lookup |
| --- | --- | --- |
| agent | a reference and a precise problem statement | permitted; following the reference is expected work, not a cost to reduce |
| human | the same precision, plus the context | discouraged; put the context in the message |

### Why this is a split, not a length

The cost being managed is the reader's **lookup count**, not the message's word count. A
short message full of unresolved pointers is expensive for a human and cheap for an agent;
a long message that carries its own context is the reverse. Neither reader is served by
cutting precision — precision is what tells them what to do next.

### What precision looks like

> **Write:** "the check reads only the files at the top level, so a module under
> `src/provider/` is never enumerated"
>
> **Not:** "the check has a hole"

The second is short and useless to both readers.

## Name what you are setting aside

### The rule

Before acting, state the competing reading or the option you are **not** taking, in the
same line as the thing you are doing.

### Why

A choice stated alone reads as settled. A reader who knows the alternative was in play has
nothing to push against, so a fork that one reply would settle costs a review cycle
instead. Naming the alternative is what makes the correction path reachable at all.

### Worked pair

> **Write:** "I will split storage into two module directories, and leave the session and
> run ledgers where they are for now."
>
> **Not:** "I will split storage into two module directories."

## Keep process in its place

Three different things are routinely all called "steps":

- **domain or runtime flow** explains how the subject behaves; include it when it answers
  the reader's question;
- **change order** explains before/after, migration, or supersession; include it only when
  order changes the meaning or safety of the result;
- **work history** recounts commands, edits, review rounds, or agent activity; omit it
  unless the process itself is the subject, a blocker depends on it, or it establishes
  cause.

Before/after comparison is not an implementation timeline. Do not replace an account of
changed behavior with a list of tasks that happened.

## Make every claim checkable

### Open the source

Read the file, the run, or the record the claim depends on — not the sentence that names
it. If the source is unavailable, say so and mark the claim as **reported** or **inferred**
rather than checked.

### A universal claim names its members

Words such as "all", "every", "none", and "the corpus" stand for a set. Name the members
actually read, or write "I read N of M". A set inferred from a search term rather than read
does not support the claim.

### Every figure travels with its base

Give the population and the command or scope that produced the number. Do not measure a
negative over a window shorter than the period of the thing you claim did not happen. A
count without its base cannot be reproduced.

### Every claim names its subject

Four subjects are routinely confused, and the failure is invisible because the sentence
stays true about the wrong one.

| Confusion | The failure | Write instead |
| --- | --- | --- |
| **Artifact vs running system** | an edited file is not a loaded module | "the file is patched, but no running process has loaded it" |
| **Moment of observation** | a negative is only about the window you looked, and a healthy run may clean up after itself | name when you sampled |
| **Your instrument vs the subject's rule** | a result is evidence about what your command read | say what population your instrument read versus the one the subject reads |
| **The act a phrase denotes** | "correct X" may mean relabel or rewrite | name which |

Keep *measured*, *reproduced* and *verified* separate from inferred: they are claims about
evidence, so do not state a deduction in measurement grammar.

### Every result names what was tested, why, and what it means

A bare result — "the test passes" — leaves three slots empty:

1. **what ran, on what** — "the pairwise check over all 18 refusal emitters and their 60
   writer sites", not "the test";
2. **what property it tests** — "every refusal path writes the same envelope before
   responding", not a file name;
3. **what the outcome means for the decision** — what to conclude, and what stays outside
   the result.

The same shape applies to a review, a probe, a census, or a migration.

### A correction names the belief it removes

> "My earlier claim was wrong" leaves the reader holding whatever the old wording implied.

Say what a reader would have concluded from it, and that they should discard that
conclusion. A correction that only negates the sentence lets the false belief survive.

One further compression rule: a number or conclusion that was **published and is now
corrected** is stated in one line — "was 524, now 472, the window straddled two revisions".
Compression drops narration; it never drops a correction the reader may already hold.

## Discipline of the surface itself

### Active voice, named actor

Google: *"In general, use active voice … Make clear who's performing the action."* Their
worked example:

> *Recommended:* "Send a query to the service. The server sends an acknowledgment."
>
> *Not recommended:* "The service is queried, and an acknowledgment is sent."

The failure the rule prevents is a reader who cannot tell who is supposed to do something.
Passive stays legitimate when the actor genuinely does not matter to the reader.

### Descriptive link text

Name the destination in the link, so a reader can decide whether to follow it without
opening it.

### Conditions before instructions

Put the condition in front of the instruction it guards, not after it.

### Reader key

When the document uses codes, symbols, or project shorthand, include a key rather than
making the reader look it up. Use the subheading that names the content:

| Subheading | Decodes |
| --- | --- |
| **Glossary** | terms |
| **Codes, abbreviations, and acronyms** | project shorthand |
| **Notation** | symbols |
| **Source keys** | source labels |

A **legend** is the narrower term for a table that decodes marks or colors; it is not the
default name for a list of project codes.

### Preserve the source's vocabulary

Define an overloaded term rather than silently paraphrasing it. Two readers acting on the
same instruction will otherwise contradict each other in good faith.

## Shape of a record

This is the skeleton the dispatcher's record shape expands to:

```markdown
---
title: <Subject> - Report
tags:
  - <topic>
  - report
created: YYYY-MM-DD
---

# <Subject> - Report

Sources: <artifacts> | Captured YYYY-MM-DD | <pinned or not> | Keys resolve in Reader key.

## Abstract

## Description

### 1. <the chosen kind's reading frame>

## Diagrams

## Reader key

### Notation
### Source keys
### Glossary
### Codes, abbreviations, and acronyms
```

### Record rules

- Every factual claim carries a source key, and every key resolves in the Source keys
  table.
- Capture scope per source: artifact, branch or tag when relevant, capture date, and
  whether it is pinned.
- Keep source digest and interpretation separate. The report may link a digest; it does
  not impersonate one.
- Verify local links against the filesystem before finishing.

## The brief

A brief is not a compressed record. It carries the smallest argument that lets its reader
understand or decide:

1. correct the reader's frame when necessary;
2. state the answer once in the subject's vocabulary;
3. include only the selected kind's load-bearing aspects;
4. connect evidence to consequence;
5. close with the claim boundary, not another summary.

Use inline source anchors or status labels when the brief mixes measured, designed,
inferred, and open claims. Do not add record furniture solely to make a brief look formal.

If the brief uses project codes, abbreviations, or symbols, include a compact reader key
even when the surrounding document is informal. Put it where the reader meets the first
code, or at the end when the code set is large enough to scan separately.

## End at a claim boundary

### The rule

Close with what is **established**, what is **designed but not observed**, what is
**unresolved**, and what is **deliberately not claimed**. Do not close with another
summary.

### Why

A summary repeats what the reader has just read, so it costs attention and changes nothing.
A boundary is the opposite: it is the one part of the document that tells the reader how
far they may rely on it. The distinction matters most when the reader is about to act —
"the pairing is complete" and "the pairing is complete, but this does not show the
envelope's content is correct" license different actions.

The boundary is also where an honest gap stays visible. A report that ends on its
conclusion implies the work is finished; a report that ends on its boundary says which
part is not.

## Subtract before adding

### The rule

Cut repeated summaries, process narration, and decorative sections. For every proposed
section ask: **"would removing this stop the reader understanding the answer, making the
decision, or trusting the boundary?"** If not, remove it.

### Why

This is the same test `references/catalog.md` applies to a proposed section, stated once
here so it governs the whole document and not only the kind routing. Length is not the
defect — a long document that carries new information is fine. The defect is a section
that changes nothing for the reader while still costing them the time to read and judge
it.

The three shapes that most often fail the test:

- **the repeated summary** — the conclusion stated twice, once mid-document and once at
  the end;
- **the process narration** — commands, edit order, or review rounds that are not
  evidence;
- **the decorative section** — a diagram, table, or heading that restates adjacent prose
  in another format.
