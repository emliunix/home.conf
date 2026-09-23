---
name: report-style
description: >-
  Use when writing a durable, source-keyed report or a concise report brief. Route
  first by the reader's question - system, change, status, decision, review output,
  research, or retrospective - and then by the report's lifetime. Not for prose
  polish, performing a review, a bare activity log, or duplicating an existing
  structured record.
---

# Report style

A report has two independent dimensions:

- its **kind** answers the reader's question;
- its **shape** decides how long the answer must survive.

Do not use one universal report outline. A feature inventory may suit a change report;
it does not suit every report. Likewise, the steps taken to produce the work are rarely
the subject.

## Route the report

1. Read [references/catalog.md](references/catalog.md) and select the one dominant
   report kind.
2. Read only that kind's reference. If the request genuinely spans two questions,
   choose a primary kind and borrow only the necessary aspects from one secondary kind;
   do not concatenate templates.
3. Choose the shape:
   - a **record** survives the conversation: durable, self-contained, source-keyed;
   - a **brief** transfers the answer in one sitting and may assume shared context.

The kind controls **what must be explained**. The shape controls **how much context and
source machinery must travel with it**.

## Keep process in its place

Distinguish three different things that are often all called "steps":

- **domain or runtime flow** explains how the subject behaves and is included when it
  answers the reader's question;
- **change order** explains before/after, migration, or supersession and is included
  only when order changes the meaning or safety of the result;
- **work history** recounts commands, edits, review rounds, or agent activity and is
  omitted unless the process itself is the subject, a blocker depends on it, or it is
  needed to establish cause.

Before/after comparison is not an implementation timeline. Do not replace an account of
changed behavior with a list of tasks that happened.

## Shared discipline

- State the reader's question and answer it early.
- Anchor scope: subject, relevant version or state, and capture date when facts can
  change.
- Keep observed facts, source-backed design, analysis, and open questions visibly
  distinct.
- Preserve the source's vocabulary. Define overloaded terms instead of silently
  paraphrasing them.
- Give every load-bearing assertion a warrant: measured, derived, source-backed, or
  explicitly open.
- End at an honest claim boundary: what is established, designed but not observed,
  unresolved, and deliberately not claimed.
- Use a diagram only when it carries a relationship, boundary, flow, or comparison that
  prose would make harder to inspect.
- Subtract before adding. Cut repeated summaries, process narration, and decorative
  sections.

## Shape A - the record

Write in this order: capture sources -> select kind and reading frame -> write the
description -> add useful diagrams -> resolve the legend -> write the abstract last.

| Element | Optional | Description |
| --- | --- | --- |
| Abstract | no | One page or less: the question, load-bearing answer, and consequence for the reader. Introduces no claim the description does not expand. |
| Description | no | Numbered, claim-bearing sections selected from the chosen kind's aspects. Inventories use tables when comparison matters. |
| Diagrams | yes | Mermaid; one claim per diagram, with a name and caption. Cut any diagram that only repeats adjacent prose. |
| Legend | no | Exactly three tables: Notation, Source keys, and Terms. Include only marks and terms actually used. |
| Open capture list | yes | Unreachable primary sources, the blocker, and the intended capture method. Never reconstruct an unavailable primary from memory. |

Record rules:

- Every factual claim carries a source key, and every key resolves in the Source keys
  table.
- Record capture scope per source: artifact, branch or tag when relevant, capture date,
  and whether it is pinned.
- Keep source digest and interpretation separate. The report may link a digest; it does
  not impersonate one.
- Verify local links against the filesystem before finishing.

```markdown
---
title: <Subject> - Report
tags:
  - <topic>
  - report
created: YYYY-MM-DD
---

# <Subject> - Report

Sources: <artifacts> | Captured YYYY-MM-DD | <pinned or not> | Keys resolve in Legend.

## Abstract

## Description

### 1. <the chosen kind's reading frame>

## Diagrams

## Legend

### Notation
### Source keys
### Terms
```

## Shape B - the brief

A brief is not a compressed record. It carries the smallest argument that lets its
reader understand or decide:

1. correct the reader's frame when necessary;
2. state the answer once in the subject's vocabulary;
3. include only the selected kind's load-bearing aspects;
4. connect evidence to consequence;
5. close with the claim boundary, not another summary.

Use inline source anchors or status labels when the brief mixes measured, designed,
inferred, and open claims. Do not add record furniture solely to make a brief look
formal.

## Boundary

This skill shapes a report; it does not perform the underlying review, research,
incident response, or retrospective method. Use the applicable method first, then use
the corresponding report-kind reference to communicate its result. A structured source
record that already answers the same reader question should be linked or summarized,
not rewritten as a second source of truth.
