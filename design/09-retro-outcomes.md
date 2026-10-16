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

Bob proposed a test that separates the two: a finding that stops the design from
delivering what it promised routes back, and anything beyond it is follow-up work.

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
with no review gate. The route back, which is a valid outcome, has no test for when
it applies instead of new work, and a P0 violation found at retro has no route
once the retro stops editing. Its changes skip the order design 08 sets, design → module docs
→ code, and nothing records what kind of follow-up work the retro found.

## Scope - what we touch

- `skills/flow-retro/SKILL.md`:
  - **Record.** Every retro writes a dated `## Retrospective` entry in the design's
    worklog, with the first-principles bottom line, the classified divergences and
    the verdict.
  - **The test.** A finding *blocks* the design when it makes one of the design's
    own falsifiable rows fail or become unprovable: the **Covers** acceptance rows
    when the design belongs to a goal, otherwise the rows of its **Verification
    design**. An assumption is inside the design only when one of those rows
    depends on it.
  - **Verdict, one of four:**
    1. **land**: no finding blocks, and nothing needs further work;
    2. **land with follow-ups**: no finding blocks, and the further findings go to
       one follow-up file (below);
    3. **route back to implementation**: a blocking finding is an implementation
       defect, or a P0 project-contract violation carried by the code. The status
       stays `pending-retro`, the design returns to implementation, and the cycle
       counts one round of `flow-common`'s round budget;
    4. **breakout**: a blocking finding is a design defect, or a P0 violation the
       design body itself prescribes. It is a `flow-common`
       breakout adjudication now, not at the round ceiling: halt, name the cause
       in the worklog, and let the manager revert the impacted designs to `draft`
       for re-review.
    A wrong machine stays supersession.
  - **The follow-up file.** Verdict 2 writes one `draft-followup` file per retro, in
    the shape `flow-grill-review` §3 defines for review sweeps: the next free
    `design/NN-<topic>.md`, findings grouped into units, no three heads and no
    obligation until someone picks it up. It points back to the worklog entry. Each
    unit names its kind from an open list of examples: clean-up or refactor,
    process or docs optimization, re-architecture, new feature, a retro of the
    retro process. A retro names whatever kind a unit needs.
  - **No direct edits.** The retro changes no code, no design body and no module
    document. Verdicts 3 and 4 redo work through implementation or through review;
    a follow-up unit becomes work only when someone picks it up as a design.
  - **Landing.** Verdicts 1 and 2 set `landed` once the worklog entry exists and,
    for 2, the follow-up file exists.
  - §5's module-docs check: a module document that contradicts one of the design's
    rows is a blocking finding (verdict 3 or 4). Any other mismatch is a follow-up
    unit.
  - The done checklist follows the above.
- `skills/flow-common/SKILL.md`: the "only route back out of `pending-retro`" rule
  names verdicts 3 and 4. Breakout adjudication's trigger (When 1) names a retro
  design defect explicitly. The `landed` lifecycle row says a retro may land with a
  follow-up file.
- `skills/flow-grill-review/SKILL.md` §3: the `draft-followup` shape is also what a
  retro writes, with a back-pointer to the retro's worklog entry.
- `skills/goal-file/SKILL.md`: a retro's follow-up file is an open thread of the
  goal (or the seed of a new goal). It is not a Design-files row, so the goal's
  close does not wait on it.
- `skills/flow-supervise/SKILL.md`: the design inventory includes `draft-followup`
  files.
- `flow-skills-eval/src/eval/cases.ts`. Each triplet gets a canonical, trap and
  paraphrase fixture; the expected tuples are `decision(next_action, status,
  write_target, opens_new_design)`:
  - `fork-bounded-correction-*` is replaced by `fork-retro-followup-*`: a finding
    no row depends on (the UTF-8-only assumption in a design whose rows are about
    export timeouts) expects `decision("set_status", "draft-followup",
    "followup_design_file", false)`. The landing act is scored by
    `gate-pending-landed-*`, which stays as it is;
  - new `fork-retro-design-defect-*`: a Verification-design row fails because the
    design's premise is wrong, expecting `decision("halt_structural",
    "unchanged", "worklog", false)`;
  - new `fork-retro-p0-*`: a P0 hit carried by the code only, found at retro, that
    no row depends on,
    expecting `decision("remediate", "unchanged", "none", false)`;
  - `fork-impl-defect-*` and `gate-pending-landed-*` stay valid as they are.
- `flow-skills-eval/tests/contract-lint.test.ts`: an L0 assertion that flow-retro
  states the record, the test, the four verdicts and the no-direct-edits rule.
- `flow-skills-eval/frozen-prefix.lock.json` is re-approved.

Follow-up for design 08: its retro-stage L1 case (a build that drifted from its
module documents) is written against this design's §5 wording.

Non-goals:
- Changing the first-principles bottom line or the divergence classes. They decide
  what the retro finds; this design decides where the findings go.
- A closed list or a checked type field for follow-up kinds.
- `skills/learning-loop`, which has no lifecycle status and defers
  `pending-retro → landed` to flow-retro.
- Extending the decision schema. "Land with follow-ups" is two acts, and each is
  scored by its own case.

## Rationale

A retro's job is to judge a finished loop against what the loop was opened to
deliver. Doing the fixes in the same step makes the retro both author and reviewer
of those fixes.

The design's own falsifiable rows are the test because they are what the loop
promised, in a form that can be checked. A finding that breaks one means the loop
is not finished, so landing would be false. A finding that breaks none is new work,
and new work belongs to whoever picks it up.

The two kinds of blocking finding go to the routes the lifecycle already has. An
implementation defect is a round of implementation. A design defect is a breakout,
which reverts the design to `draft` and re-reviews it; the status table has no row
for a reviewed body sitting at `pending-retro`. A P0 violation routes back whatever
the test says, as it is a blocker at review too: to implementation when only the
code carries it, to breakout when the design body prescribes it.

The follow-up file reuses the review sweep's shape, so a light retro with three
small findings writes one file, not three designs. The kinds are examples because
the useful set is not known in advance; the owner added two as the list was
discussed.

A landed design stays frozen. A design that has not landed is not frozen, so a
breakout may revise its body through review.

## Verification design

| Property | Failure witness | Command |
| --- | --- | --- |
| The retro states its record, test and verdicts | flow-retro does not name the worklog entry, the row-based test, the four verdicts, or the no-direct-edits rule | new L0 assertion in `flow-skills-eval/tests/contract-lint.test.ts`, `vp test` |
| No direct-edit wording is left | flow-retro still contains "rewrite the design body", "complexity removals applied" or "bounded correction to the documents or the code" | the same L0 test |
| The routes match the lifecycle | flow-common's "only route back" rule does not name verdicts 3 and 4, or breakout's trigger does not name a retro design defect | the same L0 test |
| The cases are well-formed | a new or replaced case lacks a full triplet or uses a value outside the schema | `vp test` (`cases.test.ts`) |
| The cases agree with the skill | a model following the edited skills answers a new case with a different tuple | `vp run eval:full` with the eval key; citation comments are checked by review |
| The lock matches | the frozen-prefix lock is stale after the skill edits | `prek run --all-files` (flow-skills-eval frozen prefix lock) |

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

landed
