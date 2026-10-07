---
name: subagent-dispatch
description: >-
  Handing work to subagents: route per role from the project's route table when it has one, hand the
  spine not a paraphrase, one output file per child, reuse keyed by topic and task kind, freeze while a
  child measures, fan out with a shared lever. Use when a task is split across subagents, or a child
  that did the same kind of work on the same subject could be reused.
---

# Dispatch

1. **Route per role** — take the model and effort from the project's model-route table, if it has one, read from the workspace, not from memory or habit.
2. **Hand the spine, not a paraphrase** — the prompt names the reading order (constitution → README → method document → the owning document) and the repository's own files; a summary measures the parent's paraphrase, not the repository.
3. **One output file per child** — the child writes only that file; every other mutation channel is read-only. Read-only covers files, Raft messages and tasks, git refs, and external state, not only the tree.
4. **Reuse keyed by topic and task kind** — the same kind of work on the same subject goes back to the child that holds the context. A fresh child is earned by blinding, independence or a new topic — never by convenience.
5. **Freeze while it measures** — the parent edits nothing and commits nothing until the last child returns.
6. **Fan out with a shared lever** — write the recipe once, as the artifact every delegate reads, and keep it outside their write scope.
7. **Bind identity before mutation** — a read-only child asserts its own identity before touching any mutation channel. If the credential resolves to the parent or another unexpected identity and the harness cannot scrub or override it, the wrapper refuses the mutation. The dispatch envelope names the child's write path, or says `read-only`.

## Why each rule holds

**Main thread gets summaries.** Verbose outputs and bulk reads go to children; the reuse rule is the
session-scoped half of the same economy — a child that already holds the context is cheaper to steer
than a replacement is to re-derive it.

**A child is not a resource you can assume exists.** Route policy is per session: a child spawned from a
session whose allow-list excludes a model fails, and a thread that must run on a particular model has to
be *started* from a session that permits it. **Never put a child on the critical path**: if the work can be
done in-session, do it there, and treat a child that never reports as an environment fact to record rather
than a plan to repair.

Used where it is the right instrument, a child buys two things a session cannot: **independence** — it
does not share the context that produced the thing it judges — and **a second reading** of a record by
someone who has not been told what to conclude.

**Reuse by kind of work and topic.** A follow-up of the same kind on the same subject goes back to the child
that did it — a child that reviewed a design is the one a later review of that design is dispatched to —
because the second pass over the same record is where a fix gets checked, and a replacement re-derives what
the first child already knows. Steering a continuable child starts its next turn; a new child is the
exception:

    blinding       a reader batch or an author round, whose whole measurement is that the child has
                   not seen the repository (see `blind-trial`) - reuse would destroy the instrument
    independence   a verification that would otherwise inherit the reasoning it is meant to test
    a fresh topic  a subject no child has worked on: there is nothing yet to reuse

The second and third are judgements about the *work*, not about the child: a verifier under the
independence exception is reused for the re-check of its own finding (the same kind of work on the same
topic), and a child whose topic has moved is given the new subject rather than retired.

**Cost is part of the same choice.** A route that is slow at its top effort is a reason to *reuse* the child
that already holds the context and to lower the effort for bounded work, never a reason to dispatch a second
child: re-dispatching costs the whole run again, while re-asking costs a message.

**Two children on one record is a race, and the record is what loses.** While a child measures, the parent
**edits nothing and commits nothing**, and a child that writes is given **its own output path**. So a
dispatch states the commit under test, and a harness whose run regenerates a record file is pointed at a
scratch directory instead of the recorded path. A measurement taken against a moving tree is not a
measurement, and two runs against one path are not two runs.

**Read-only is an identity property, not a sentence in the prompt.** A full-history child can inherit the
parent's credentials, so a nominal reviewer can post messages, claim tasks, or move refs as the parent.
Before any mutation, the child asserts its own identity; if the harness cannot provide it, the wrapper
refuses the mutation rather than trusting the prompt.

**A forked session does not own its parent's children.** After a fork, only the children spawned since the
fork are addressable; messaging an earlier one fails. So a handover that says "send your report to the
parent" presumes a parent still addressable, and **reuse is only available inside the session that spawned
the child**. Read inherited children's reports before forking, and re-dispatch with the accumulated brief
rather than promising to steer what you cannot reach.

**What a child's report owes**, like any other measurement: what it read, what it found with `file:line`,
the claim each finding contradicts, and what it could not check. A child's summary is a report, not a
verdict: its findings are accepted or refused by the same rule as anyone's — reproduce the claim, cite the
check (see `finding-triage`).

## Worked instances

- **Reuse**: one subagent did a teach-back and the adversarial review of a proof-of-understanding report,
  and then the same subagent re-read the fixed report.
- **Route refusal**: a child on an excluded route failed with `child LLM route "<provider>/<model>" is not
  allowed for this Session`.
- **Cost**: a full verification on one route took over an hour, so re-dispatching would have cost that hour
  again where re-asking cost a message.
- **The race**: two verifiers were dispatched with permission to regenerate a use case's results file
  while the parent was still editing the case file they were reading. The fix was a scratch results
  directory, set per child by an environment variable the case harnesses read.
- **The fork** (observed 2026-09-18): after a fork, `list_agents` showed only the children spawned since
  the fork, and `send_message` to an earlier one failed with `subagent "<id>" belongs to another parent
  session` — including children messaged successfully minutes before.
- **The identity bleed** (observed 2026-10-08): full-history reviewers inherited the parent's
  `SLOCK_AGENT_ID`; their Raft mutations were recorded under the parent. The repair is to scrub the
  identity or assert it at the mutation boundary, not to add another sentence to the review prompt.

## Project binding

The repository's AGENTS.md (or its equivalent) names the concrete files this skill refers to by role: the
spine order a child is handed, the model-route table (if it has one) with its measured latencies, the
scratch-output convention for harnesses that regenerate records, and the method document's section on
delegation, where it has one. Where one of these roles has no file, that absence is a finding to record,
not a reason to invent one.
