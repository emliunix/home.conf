---
name: reviewer-seat
description: >-
  Use when serving as an independent reviewer or continuous high-level observer on work run by
  other agents: recurring pass cadence, drift surfacing, independent verification sized to a
  claim's shape, and no implementation. The general, portable form — a project that adopts it
  keeps its own instances and inherits this. Not for performing the work under review, and not
  a substitute for a unit's own adversarial verdict.
---

# Reviewer Seat

The general form of a review seat. **This skill travels; the instances that earned it do not.**
A project adopting it writes its own extension — conventionally `<project>-reviewer-seat` — that
declares itself an extension of this one and keeps the cases, names, and dates that made each rule
real. An instance is evidence, and evidence belongs to the project that paid for it.

## The role

- **Watch from outside the implementation lanes.** The reviewer surfaces drift, verifies claims,
  and sizes work; lane owners land fixes. Nothing here is an implementation procedure.
- **One exception, and it is load-bearing:** files that name the reviewer as their author.
  The implementer never authors the test that gates their own work — when a landed change breaks
  such a test's drive, its named author fixes the drive, assertions unchanged.
- **Withdraw a false framing explicitly rather than softening it.** A correction is a claim like
  any other: it ships with its own measurement.
- **The pass is the deliverable.** A pass nobody sends is indistinguishable from a quiet day.

## The recurring pass

A pass is a scheduled read of the whole board, not of whatever spoke last. Fill every row or say
which row you could not fill and why — **an unfilled row is a finding, not a gap in the form.**

The rows, what each catches, and per-seat subsets:
[`templates/pass-checklist.md`](templates/pass-checklist.md). The rows written from a watching
seat's position are the whole surface; other seats read a subset, and **each seat's procedure has
an owning surface that wins over this template** — the template says what a pass is *for*, the
owning surface says what it *is*.

A per-seat checklist is a **row-subset**, never a new document: add it as a variant rather than
growing this file.

## Verification

Choose the check by the claim's shape, not by how much it matters. Two levels — a **witness**
(the default: name the artifact and revision, open it there, spot-review it) and a
**confirmation** (independent re-derivation, earned by specific claim shapes) — are set out in
[`templates/verification-discipline.md`](templates/verification-discipline.md) with the rest of
the rules. That file is the substance of this skill; read it before reviewing.

Three habits worth stating here, because reviewers skip them first:

- **Check the surface the claim is ABOUT.** Ask which artifact would have to be different for the
  sentence to be false, and verify that one. A claim verified on one surface and stated about
  another is wrong even when every check ran.
- **Counts derive from the population the sentence names**, and travel with the command that
  produced them.
- **Predict, then measure**, with the prediction landed in a dated surface before the output
  arrives. Otherwise measure-then-narrate read backwards is indistinguishable from prediction.

## Routing and communication

Where a seat's output goes, and why the same sentence lands differently in a lane thread, a
tracker thread, and a channel: [`templates/routing-and-communication.md`](templates/routing-and-communication.md).
The governing rule is that **state has no latency budget** — route state to the periodic pass,
and let only action-now pierce a seat as a message. Report latency, overhead, and an
instrument-repair ratio; never one aggregate grade.

## Evidence and memory

- **Durable findings go where a future reader finds them** — the repository and its worklog, not
  only chat and a reviewer's own notes. Backup refs are recorded with the commands that
  re-derive every number.
- **A rule is owned once.** If a project states a rule in its own governing document, that
  document wins; this skill is the portable form, not a competing copy. When the two disagree,
  the project's own surface is the authority and the disagreement is the finding.
- **Prefer the project's own words in the project's own surfaces.** A reviewer who keeps a
  parallel copy of another team's rules becomes a second, silently drifting authority.
