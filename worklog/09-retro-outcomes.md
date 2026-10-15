# Worklog - retro outcomes

## C1 - Draft (2026-10-16)

Bob drafted design 09 after the owner found that the retro step has no defined
output. Evidence on `main` at `54eb07c`:

- `skills/flow-retro/SKILL.md` §3 rewrites the design body, §2 and the done checklist
  apply removals, §4 holds `pending-retro` while corrections return to implementation,
  and §5 (design 08) corrects module documents in place.
- `flow-skills-eval/src/eval/cases.ts`: `fork-bounded-correction-trap` scores opening
  a new design for a bounded correction as wrong, so the L1 corpus encodes the old
  route.
- `skills/flow-grill-review/SKILL.md` already defines `Status: draft-followup` for a
  follow-up design at the next free number.

## C2 - Peer review round 1 (2026-10-16)

The owner approved the direction ("sounds good, worth refine"). The Claude seat
reviewed `b85f7c6`: 1 blocking, 5 should-fix, 3 notes
(https://github.com/emliunix/home.conf/pull/16).

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | blocking: a redesign route back at `pending-retro` has no lifecycle row; breakout already triggers on a retro design mismatch; a redesign has no implementer round | Taken: verdict 3 (implementation defect, counts a round) and verdict 4 (design defect, breakout now) |
| 2 | should-fix: "stops it from solving its Problem statement" is a judgement, and the "wrong assumption" example contradicts it | Taken: the test is the design's own Covers or Verification-design rows; an assumption counts only if a row depends on it |
| 3 | should-fix: a P0 violation found at retro has no route | Taken: a P0 hit always routes back (verdict 3) |
| 4 | should-fix: `draft-followup` is one sweep file per review with no heads, not one design per finding | Taken: one follow-up file per retro in the sweep shape, with a back-pointer |
| 5 | should-fix: L1 changes need tuples, the two-act verdict does not fit the schema, two routes lack cases | Taken: tuples named for `fork-retro-followup-*`, `fork-retro-design-defect-*`, `fork-retro-p0-*`; each act scored by its own case; schema unchanged |
| 6 | should-fix: goal-file missing | Taken: a follow-up file is an open thread of the goal, not a Design-files row |
| 7 | note: flow-supervise's inventory | Taken: one line |
| 8 | note: learning-loop correctly out of scope | Kept out |
| 9 | note: design 08's retro-stage case | Recorded as a follow-up for design 08 |
