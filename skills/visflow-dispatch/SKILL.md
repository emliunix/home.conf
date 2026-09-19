---
name: visflow-dispatch
description: >-
  Project specific method on handing work to children in visflow: fan-out with shared levers,
  one output file per child, adversarial red team, blinding, freeze while they measure, reuse
  keyed by topic and task kind. Use in visflow when a task is split across subagents, or a
  child that did the same kind of work on the same subject is reused.
---

# Dispatch

1. **Route per role** — take the model and effort from `pstack/pstack-models.md`, not from habit.
2. **Hand the spine, not a paraphrase** — the prompt names the reading order (constitution → README → method → the owning doc) and the repository’s own files; a summary measures the parent’s paraphrase, not the repo.
3. **One output file per child** — the child writes only that file; the tree is otherwise read-only.
4. **Reuse keyed by topic and task kind** — the same work on the same subject goes back to the child that holds the context. A fresh child is earned by blinding, independence, or a new topic — never convenience.
5. **Freeze while it measures** — edit nothing and commit nothing until the last child returns.
6. **Fan out with a shared lever** — write the recipe once as the artifact every delegate reads, and keep it outside their write scope.

## Handing work to children (the full protocol)

*Moved here from `method.md` when that file became a manifest (2026-09-19): the procedure lives
with the skill, and the manifest points at it.*

**The route is per role, and the mapping has one home:** `pstack/pstack-models.md` (the project's
single copy; it is read from the workspace, not from memory).

*(pstack: `principle-guard-the-context-window` -- the main thread gets summaries, not raw
payloads; verbose outputs and bulk reads are routed to children. The reuse rule below is the
session-scoped half of the same economy: a child that already holds the context is cheaper to
steer than a replacement is to re-derive it.)*

**A child is not a resource you can assume exists.** Route policy is per session: a child spawned from a
session whose allow-list excludes a model fails with `child LLM route "<provider>/<model>" is not allowed
for this Session`, and a thread that must run on a particular model has to be *started* from a session
that permits it. **Never put a child on the critical path**: if the work can be done in-session, do it there,
and treat a child that never reports as an environment fact to record rather than a plan to repair.

Used where it is the right instrument, a child buys two things a session cannot: **independence** -- it does
not share the context that produced the thing it judges -- and **a second reading** of a record by someone
who has not been told what to conclude.

**A child is reused by the kind of work it did, on the topic it did it on.** A follow-up of the same kind on
the same subject goes back to the child that did it -- a child that reviewed the core IR design is the one a
later core-IR review is dispatched to -- rather than to a new child, because the second pass over the same
record is where a fix gets checked, and a replacement re-derives what the first child already knows:
`worklog/proof/proof-of-understanding.md` used one subagent for the teach-back and the adversarial
review, and then **the same subagent re-read the fixed report** (line 372). Steering a continuable child
starts its next turn; a new child is the exception, and it is earned by a principle or a design, never by
convenience:

    blinding       a reader batch or an author round, whose whole measurement is that the child has not
                   seen the repository (the two sections below) -- reuse would destroy the instrument
    independence   a verification that would otherwise inherit the reasoning it is meant to test
    a fresh topic  a subject no child has worked on: there is nothing yet to reuse

The second and third are judgements about the *work*, not about the child: a verifier under the independence
exception is reused for the re-check of its own finding (that is the same kind of work on the same topic), and
a child whose topic has moved is given the new subject rather than retired.

**Cost is part of the same choice.** A route that is slow at its top effort is a reason to *reuse* the child
that already holds the context and to lower the effort for bounded work, never a reason to dispatch a second
child for it: measured here, a full verification on one route took over an hour, so re-dispatching costs that
hour again while re-asking costs a message. Role-by-role routes and their measured latency are in
`pstack/pstack-models.md`.

**Two children on one record is a race, and the record is what loses.** The reader batch's freeze rule
generalises: while a child measures, the parent **edits nothing and commits nothing**, and a child that
writes is given **its own output path**. So a dispatch states the commit under test, and a harness whose run
regenerates a record file is pointed at a scratch directory (`CASE_RESULTS_DIR` for the case harnesses
here) instead of the recorded path. A measurement taken against a moving tree is not a measurement, and two
runs against one path are not two runs. The failure this comes from: two verifiers were dispatched with
permission to regenerate `use-cases/results/UC-02.json` while the parent was still editing the case
file they were reading.

**A forked session does not own its parent's children.** Observed 2026-09-18: after a fork,
`list_agents` showed only the children spawned since the fork, and `send_message` to an earlier one
failed with `subagent "<id>" belongs to another parent session` -- including children that had been
messaged successfully minutes before. Two consequences for anything workflow-shaped: a handover that says "send
your report to the parent" presumes a parent still addressable, and **reuse is only available inside the session
that spawned the child**. Read inherited children's reports before forking, and re-dispatch with the accumulated
brief rather than promising to steer what you cannot reach.

**What a child's report owes**, like any other measurement: what it read, what it found with `file:line`,
the claim each finding contradicts, and what it could not check. A child's summary is a report, not a verdict:
its findings are accepted or refused by the same rule as anyone's -- reproduce the claim, cite the check.

## References
`method.md` · *Delegating work, and reusing a child*; `AGENTS.md` grounding rules; `pstack/pstack-models.md`.
