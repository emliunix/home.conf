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

## C3 - Design passes (2026-10-16)

The Claude seat re-reviewed `befc852`: design passes, nothing blocking. One new
should-fix, taken into the design and the implementation:

| # | Finding | Disposition |
| --- | --- | --- |
| 10 | should-fix: a P0 the design body prescribes cannot be fixed in implementation | Taken: a P0 carried only by the code is verdict 3; a P0 the body prescribes is verdict 4. The `fork-retro-p0-*` fixtures state the violation is in the code only |

## C4 - Implementation (2026-10-16)

- `skills/flow-retro/SKILL.md`: One job, §2 P0 and accretion routing, the no-direct-
  edits rule in §3, §4 rewritten as the row test and four verdicts, §5's module-docs
  check and landing rule, stop condition and done checklist.
- `skills/flow-common/SKILL.md`: the `landed` row, the route-back rule naming
  verdicts 3 and 4, breakout's trigger naming a retro verdict 4.
- `skills/flow-grill-review/SKILL.md`, `skills/goal-file/SKILL.md`,
  `skills/flow-supervise/SKILL.md`: one line each.
- `flow-skills-eval`: `fork-bounded-correction-*` replaced by
  `fork-retro-followup-*`; new `fork-retro-design-defect-*` and `fork-retro-p0-*`;
  flow-retro citations moved to the new lines; three L0 assertions; the lock
  re-approved.

Witnesses, each seen red first:

| Witness | Red | Green |
| --- | --- | --- |
| L0: no direct-edit wording | "rewrite the design body" appended to flow-retro: 1 failed / 13 | 13/13 |
| L0: test and four verdicts | `**Breakout**` unbolded: 1 failed / 13 | 13/13 |
| L0: flow-common routes | the verdict 4 trigger removed: 1 failed / 13 | 13/13 |
| Case triplets complete | a paraphrase id renamed: 2 failed | `vp test` 50/50 |
| Typecheck | — | `tsc --noEmit` clean |

Not run: `vp run eval:full`, as no eval model key is configured here. The new
cases' expected tuples are checked for schema and coherence only, and design 09
stays `pending-retro` until they run.

## C5 - Implementation review (2026-10-16)

The Claude seat passed `210a766`: no blocking findings; `eval:full` blocks `landed`,
not the merge (https://github.com/emliunix/home.conf/pull/16).

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | should-fix: `goal-file/goal-authoring.md`'s edge table lacks the retro's routes back | Taken: `ROUTE: BREAKOUT` from Implement / Retro (verdict 4); new `ROUTE: BACK` Retro → Implement (verdict 3); status mapping updated |
| 2 | should-fix: stale citations in the changed cases | Taken for this PR's cases (`gate-pending-landed-*`, `fork-impl-defect-*`, `fork-arch-failure-*`). Recorded, not fixed: `write-target-retro-*` cite `:52` (now `:59`), and every older `flow-common` citation drifted as that skill grew. Follow-up: an L0 check that each `Cite:` quote occurs in the cited skill by text |
| 3 | should-fix: leftover wording has the retro making changes | Taken: §3 record headings are proposals routed by the verdict; the done checklist's module-docs line matches §5; flow-common's commit sentence names the retro's worklog entry and follow-up file. The three old strings join the L0 stale list (seeded red: 1 failed / 13) |
| 4 | note: no case for a design-prescribed P0 | Taken: `fork-retro-p0-design-*`, expecting `halt_structural/unchanged/worklog` |

`vp test` 50/50 after the lock re-approval; `tsc --noEmit` clean.
