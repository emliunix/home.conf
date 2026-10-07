---
name: blind-trial
description: >-
  Blinded trials as the measurement of a record or a surface: reader batches over the spine (trajectory,
  per-reader metrics) and author rounds (blind and assisted arms, acceptance implies execution), handed
  the repository's own files, tagged and frozen while measuring, every finding dispositioned, no blanket
  remediation. Use when measuring whether the record onboards a newcomer, or whether the authoring
  surface lets someone produce a working program; not when the evidence is one reader's impressions
  rather than a batch, the measurement is compile counts, or the material is a summary rather than the
  surface.
---

# Blind trials

A record is measured by readers and a surface by authors: give someone the thing, let them use it, and
count what happens. Both instruments share five rules.

## Shared rules

1. **Hand the repository's own files, never a summary.** A trial whose material is the trial's own
   rendering measures the person who wrote the summary. Where the files do not exist, say so in the
   trial's record and treat the result as being about the summary as much as about the subject.
2. **Blind the participants** — no priming, no guided tour; each is a fresh child (see `subagent-dispatch`: blinding
   is the case where reuse would destroy the instrument).
3. **Three to five per batch**, each with one topic and the same prompt shape. One participant is an
   impression, not a measurement.
4. **Tag and freeze.** Tag the tree at dispatch — one tag family per instrument (`reader-batch-<n>`,
   `author-round-<n>`), its name written into the trial's record — and commit nothing until the last
   participant is back (the freeze rule of `subagent-dispatch`). A trial without a tag leaves its freeze unwitnessed
   and its findings unattributable to a revision. Correct in one batch afterwards.
5. **Disposition every finding** (see `finding-triage`) — including one only a single participant reports.
   **Blanket remediation is banned**: a single confusion is data about that path, not a consensus, and a
   fix applied to every document someone complained about recreates the defect. State a fact once and
   check it.

## Reader batch — does the record onboard a newcomer?

1. **Choose the corpus** under test (usually the spine: the README, the method document, the design
   documents) and freeze it.
2. **Dispatch the readers** read-only, each with one topic: start wherever you would naturally start, no
   entry point prescribed, read at most 25 files, stop when you can answer.
3. **Bound the report** so the batch is affordable: at most 10 trajectory lines (path, why, what you took,
   where it sent you; listings and searches marked), at most 5 answer bullets naming file and line, then the
   metrics, then the friction, then the single edit that would have made it fastest.
4. **Metrics per reader**, never averaged: files read before the answer; whether a document routed the
   reader or they inferred the route; whether they read the design as settled or open, naming the sentence
   that decided it; questions the record could not answer; defects found.
5. **Stop** when a further reader against the same tree reproduces the shape with no new defect.

## Author round — does the surface let someone produce a working program?

1. **Two arms**, which measure different things:
   - **blind** — documentation only, no tool, one attempt: does the documentation alone lead to a
     document the checker accepts, and which constructs does the author have to guess;
   - **assisted** — documentation and the checker's command-line tool, up to a stated number of runs per
     document: iterations to acceptance, which diagnostics are actionable, which constructs the author
     abandons to get there.
2. **One topic per author**, drawn from the project's use cases or the owning programme's corpus; authors are
   forbidden to read the repository beyond a stated command.
3. **Record one line per run per document**: the diagnostic received and the change made.
4. **Report** the iteration count (or "never accepted"), the most and least useful diagnostic quoted, what
   was abandoned, whether the spec was expressible at all, and anything in the messages that was wrong or
   missing.
5. **Acceptance implies execution** — a document that compiles but cannot run is not accepted; the trial
   runs what it accepts. A count of successful compiles is not this measurement.

## Worked instances

- **Six reader rounds** found every defect at a point where a reader was slowed or misled, none of them a
  design defect: sixteen record defects in round 1, eleven more in round 2 (three readings of one
  well-formedness rule, two implementations that disagreed), a reading order stated three times with the
  copies disagreeing in round 4. By round 6 a reader was routed in one hop and answerable after four files,
  and a fourth reader on the same tree found nothing new, so the loop stopped (reader step 5).
- **The freeze rule's origin**: round two ran while five commits landed mid-batch and one reader said so;
  its comparison is confounded. Two tag families (`reader-round-N`, `reader-batch-N`) were used in the
  first rounds, which is why rule 4 fixes one family per instrument.
- **Blanket remediation's origin**: the open list's pointer was added to three files because three readers
  asked where it was; the fourth reader measured three contradictory orders.
- **The first author round**: three authors, two documentation sets, one checker, **0 of 6 documents
  accepted** — three distinct rules, not one repeated: a documented construct had no implementation, the
  checker refused a form the documentation showed, and the gate accepted only one kind of condition, so
  the trial's own spec was refused three ways.

## Project binding

The repository's AGENTS.md (or its equivalent) names the concrete files this skill refers to by role: the
spine a reader batch tests, the surface documentation and the checker an author round tests, the use-case
or corpus directory topics are drawn from, the tag families, and where prior trial records live. Where one
of these roles has no file, that absence is a finding to record, not a reason to invent one.
