---
name: learning-loop
description: >-
  Run a user-requested learning loop over completed work: inspect the actual transcript and
  artifacts, select the relevant retrospective concerns, separate evidence from inference,
  distill reusable lessons, route each lesson to the strongest durable home, encode authorized
  low-risk changes, and verify transfer. Use when the user says "run the learning loop", "do a
  process retrospective", "extract lessons learned", or asks to preserve project learning from
  completed work. Do not trigger for ordinary implementation, code review, status summaries, or
  the flow lifecycle's routine pending-retro closure.
---

# Learning loop

Turn completed work into durable project learning only when the user asks. A valid result may be
"no durable lesson". Do not manufacture policy to justify the invocation.

`flow-retro` owns the flow lifecycle and the `pending-retro -> landed` transition. This skill has
no lifecycle status and may support a flow retro without replacing it.

## Authorization boundary

The invocation authorizes evidence gathering and low-risk edits inside the current project's
existing worklog, open-work register, environment record, and already-authorized test or lint
surface. Propose a disposition before changing global agent instructions, reusable skills,
architecture authority, cross-project records, or destructive mechanisms unless the user already
requested that destination.

## Procedure

### 1. Establish the evidence set

Read the actual transcript window first. Add the stated intent, frozen requirements, diffs,
artifacts, test output, timings, user corrections, and relevant logs. Do not ask the author to
reconstruct events that the transcript or repository can answer.

Pin the evidence window and artifact revision or digest. Redact credentials and unrelated private
content before handing evidence to another agent. If evidence is missing, name the gap.

### 2. Compare intent with outcome

State what the work meant to achieve, what happened, and what remains unresolved. Keep direct
observations separate from causal inferences. Quantify time or repeated work only when timestamps,
logs, or command durations support the number.

### 3. Select concern packs

Choose one to four applicable entries from [the concern catalog](references/concern-catalog.md).
Add another only when the evidence activates its `applies_when` condition. Do not run the catalog
as a universal checklist.

### 4. Distill candidates

For each candidate, record:

- **Observation:** a direct transcript, artifact, command, or test reference.
- **Inference:** the explanation, its confidence, and competing explanations.
- **Lesson:** a reusable rule with an explicit scope. One incident stays local unless recurrence
  or a strong failure mechanism supports promotion.
- **Destination:** the owner that future work will actually consult.
- **Mechanism:** the edit, test, type, lint, script, hook, or decision that carries the lesson.
- **Freshness:** when to re-check it and, for temporary guidance, when to remove it.

Reject candidates that only restate the event, lack evidence, duplicate current authority, or add
ceremony without lowering future cost.

### 5. Route and encode

Read [routing and disposition](references/routing.md). Prefer the strongest mechanism the project
can support. Use prose only for facts or judgments that cannot be enforced mechanically. Preserve
provenance at the destination.

Apply authorized low-risk changes. For changes outside the authorization boundary, return a
proposed disposition with the exact destination and patch intent. Never create a generic
`lessons.md` when an owning record exists.

Do not invent an exact file path that the evidence or source tree does not establish. Name the
owning directory or role, mark the route `BLOCKED`, and state what lookup would resolve it.

### 6. Verify the loop

First verify each changed path, link, test, lint, or script directly. Then choose the cheapest
transfer check from [transfer checks](references/transfer-checks.md). Most runs need only a
mechanical walk. Use one fresh reader when the lesson changes future-agent judgment or document
authority. Use a reader batch only for an explicit onboarding experiment or a claim about reader
cost.

During any fresh-reader trial, freeze the tree until every reader returns. Keep the answer key and
predictions outside the tree, pin the material digests, and separate subjects from scorers.

### 7. Report

Keep the report proportional and under 900 words unless the user requests more detail. By default,
write one outcome paragraph, one lesson table, and short lists for unresolved and rejected
candidates. Put the six lesson fields in that table and do not repeat its content in later sections.
Add only the following sections that carry new information:

1. Outcome against intent
2. Lessons learned
3. Architecture consequences
4. Verification consequences
5. Process cost
6. Unnecessary work and trap paths
7. Structural follow-through

For every accepted lesson, name the evidence, destination, mechanism, verification, and freshness
condition. List rejected candidates and unresolved decisions briefly. Stop when every accepted
lesson has a disposition and its applied mechanism has been checked.

## Required checks

- The transcript and artifacts, not recollection, ground the result.
- Concern selection is explicit and scenario-specific.
- Observations, inferences, and lessons are not collapsed into one claim.
- Every accepted lesson has one owner and one mechanism.
- A recurring detectable failure is not routed only to prose.
- Low-learning work can end with a worklog note or no durable change.
- Transfer verification is proportional; no reader batch runs by default.
