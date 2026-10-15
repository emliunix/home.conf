# 09 - Retro outcomes

## User inputs

The owner found that the retro step has no defined output, and named where its
outcome goes:

> Retro lacks well definition: it's outcome goes to worklog new design file of either
> clean up refactor or process docs optimization

The owner made the kinds of follow-up an open list of examples:

> and the 3 be just example cases not limited to and subject to expansion say retro itself

> Or rearchitect and new feature

The owner kept the route back as a valid outcome:

> But that retro goes back to redesign and impl is also a valid case how do you think

Bob proposed the test that separates the two: a finding that stops the design from
solving its own Problem statement routes back; anything beyond it becomes a
follow-up design.

## Problem statement

`skills/flow-retro` closes a design's loop, but it does not say what a retro
produces. Its outcomes are spread across four places, and three of them change
artifacts from inside the retro:
- §3 has "bounded corrections rewrite the design body as current speech", which
  edits a design in place at the point it is about to be frozen;
- §2 and the done checklist have the retro apply accretion removals itself;
- §4 sends a correction back to implementation while the status stays
  `pending-retro`, so one design's loop can reopen without bound;
- §5, added by design 08, makes a module-docs mismatch "a bounded correction to the
  documents or the code".

A retro that edits code, designs and module documents is an implementation stage
with no review gate. The route back, which is a valid outcome, has no bound and no
test for when it applies instead of a new design. Its changes skip the order design 08 sets, design → module docs
→ code, and nothing records what kind of follow-up work the retro found.

## Scope - what we touch

- `skills/flow-retro/SKILL.md`:
  - **Record.** Every retro writes a dated `## Retrospective` entry in the design's
    worklog, with the first-principles bottom line, the classified divergences and
    the verdict.
  - **Verdict, one of three:**
    1. **land**: the design solves its Problem statement and nothing needs work;
    2. **land with follow-ups**: it solves its Problem statement, and each further
       finding becomes a follow-up design, a new `design/NN-<topic>.md` with
       `Status: draft-followup` whose Problem statement cites the worklog entry;
    3. **route back**: a finding stops the design from solving its own Problem
       statement (an acceptance criterion not met, an implementation defect against
       it, a wrong assumption inside its scope). The design returns to redesign or
       implementation, stays `pending-retro`, and the retro runs again afterwards.
  - **The test** between 2 and 3: does the finding stop this design from solving its
    own Problem statement? Yes routes back; no is a follow-up.
  - **Bound.** A route back counts against `flow-common`'s round budget. At the
    ceiling it goes to breakout adjudication.
  - **Follow-up kinds, as examples.** Clean-up or refactor (accretions and known
    debt), process or docs optimization (skills, documents, conventions, module
    documents), re-architecture, new feature, and a retro of the retro process
    itself. The list is open: a retro names the kind its follow-up needs.
  - **No direct edits.** The retro changes no code, no design body and no module
    document. A route back is redone through review, module docs and code; a
    follow-up goes through its own design's cycle.
  - **Landing.** Verdicts 1 and 2 set `landed` once the worklog entry exists and
    every follow-up has its design file.
  - **Wrong machine.** Supersession stays: the follow-up is the superseding design.
  - §5's module-docs check: a mismatch with the design's own module documents
    routes back; a mismatch elsewhere becomes a follow-up design.
  - The done checklist follows the above.
- `skills/flow-common/SKILL.md`: the lifecycle rows for `pending-retro` and `landed`,
  and the "only route back out of `pending-retro`" rule, which now names the
  route-back verdict and its round budget.
- `skills/flow-grill-review/SKILL.md`: `draft-followup` is named as the status of a
  retro's follow-up designs as well as of accepted-but-unfixed review findings.
- `flow-skills-eval/src/eval/cases.ts`: the L1 cases that encode the old routes flip.
  The `fork-bounded-correction-*` triplet scores opening a new design as wrong and
  expects a direct `design_body` rewrite.
  `fork-bounded-correction-*` is re-split by the test: a correction inside the
  design's own problem routes back, one beyond it opens a follow-up design.
  `fork-impl-defect-*` keeps its route back. `gate-pending-landed-*` is re-checked
  against the new landing rule. Their citations move to the new line numbers.
- `flow-skills-eval/tests/contract-lint.test.ts`: an L0 assertion that flow-retro
  states the two outcomes and the no-direct-edits rule.
- `flow-skills-eval/frozen-prefix.lock.json` is re-approved.

Non-goals:
- Changing the first-principles bottom line or the divergence classes. They decide
  what the retro finds; this design decides where the findings go.
- A closed list or a checked type field for follow-up kinds.
- `skills/learning-loop`, which has no lifecycle status and only supports a retro.

## Rationale

A retro's job is to judge a finished loop against its problem statement. Doing the
fixes in the same step makes the retro both author and reviewer of those fixes.

The Problem statement is the test because it is what the loop was opened to solve.
A finding inside it means the loop is not finished, so landing would be false and
the design goes back. A finding beyond it is new work, and new work gets a new
design. The round budget bounds the route back, as it bounds implementation. Splitting judgement from
change gives every fix the gates any other change gets: a design, a review, the
module documents first, then the code.

The worklog already owns the retro record (§3), and `draft-followup` already exists
as the status of a design opened to hold accepted-but-unfixed work. The retro reuses
both, so the change adds no new artifact type or status word.

The follow-up kinds are examples because the useful set is not known in advance.
A closed enum would force a mis-filed kind or an edit to the skill each time a new
kind appears; the owner named a sixth kind, a retro of the retro, as the list grew.

A landed design stays frozen. A design that has not landed is not frozen, so a
route back may revise its body through review.

## Verification design

| Property | Failure witness | Command |
| --- | --- | --- |
| The retro states its two outcomes | flow-retro does not name the worklog entry and follow-up designs as its outcome, or does not state that it makes no direct edits | new L0 assertion in `flow-skills-eval/tests/contract-lint.test.ts`, `vp test` |
| No direct-edit wording is left | flow-retro still contains "rewrite the design body", "complexity removals applied" or "bounded correction to the documents or the code" | the same L0 test |
| The three verdicts and the test are stated | flow-retro does not name land, land with follow-ups and route back, the Problem-statement test, or the round budget on the route back | the same L0 test |
| The flipped cases agree with the skill | an L1 case in `cases.ts` still expects `remediate` with `design_body` for a retro finding | `vp run eval:full` with the eval key; `vp test` (`cases.test.ts`) checks only that expected decisions are schema-valid and coherent. Citation comments are checked by review |
| The lock matches | the frozen-prefix lock is stale after the skill edits | `prek run --all-files` (flow-skills-eval frozen prefix lock) |
| The status vocabulary is unchanged | a status word other than the four plus `draft-followup` appears | the existing L0 status-word tests |

Each witness is first observed failing on a seeded defect. The L1 run needs the
eval model key; without it the gap is recorded.

## Open questions

- **Inline correction of a landed design's sentence.** Bob's reading is that a landed
  design is frozen, so it is a follow-up design. The owner has not ruled.

## Goal

This design has no goal file. The owner's request is quoted in User inputs.

## Review

worklog/09-retro-outcomes.md

## Status

draft
