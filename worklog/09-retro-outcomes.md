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

## Retrospective (2026-10-16)

Closing pass by Bob on `main` at `f9af433`. Trigger: closing stage, and a
Verification-design row first measured by design 10's L1 runs.

### First-principles bottom line

**Derivation.** The problem: a retro has no defined output and edits artifacts
with no review gate. The minimal machine: (1) one place the retro writes (the
worklog entry); (2) one test that says when a finding stops the loop (the design's
own falsifiable rows); (3) a verdict per outcome, mapped onto routes the lifecycle
already has; (4) a container for non-blocking findings, so they are tracked without
being done by the retro.

**Diff against the as-built** (`skills/flow-retro` §3–§5, `flow-common` lifecycle
and breakout, the one-liners in flow-grill-review, goal-file, flow-supervise):
items (1)–(4) are present, and no direct-edit wording remains (L0 stale list).
- (P0) none.
- (a) the `goal-authoring.md` `ROUTE: BACK` edge (C5 finding 1): needed because the
  goal file's edge table is the routing surface the supervisor reads. Constraint:
  `goal-file` owns routing.
- (b) none.
- (c) none.

**Heads.** The Problem statement holds. Scope held, with one gap: the scope puts
the follow-up file at `design/NN-<topic>.md` but does not touch the repository's
document gate, which governs every `design/NN-*.md` as a lifecycle design (finding
2). The Rationale survives; the open question it carried (inline correction of a
landed sentence) has since been ruled by the owner, who allows non-semantic fixes
in place. That ruling refines the no-direct-edits rule rather than contradicting a
row, so it goes to its own design, not to this one.

### Evidence

- Final L1 runs (design 10, `worklog/10-eval-corpus-triage/final-*.tsv`), the cases
  this design added, with neutral questions: `fork-retro-design-defect-*`,
  `fork-retro-p0-*`, `fork-retro-p0-design-*` 3/3 on flash; pro misses only the two
  paraphrases (`run_retro`), dispositioned 2 (deferred, schema). `fork-retro-followup-*`
  0/3 on both models (design 10 C6, disposition 1): both land and record the finding
  in the worklog; none opens the follow-up file. The trap's in-place edit is rejected
  correctly, but again no file is opened.
- A `draft-followup` file written for design 10's retro
  (`design/11-eval-instrument-followup.md`) is NO-GO under
  `check --all --profile draft`: status not in `[draft, reviewed, pending-retro,
  landed]`, and no `Goal`, `Problem statement`, `Rationale` or `Review` section.

### Findings and routes

1. **Blocking.** Row "the cases agree with the skill" fails for
   `fork-retro-followup-*`: a model following the edited skills answers with a
   different tuple. The verdict-2 rule itself is sound (both models reach the right
   *judgement*: the finding does not block, and the in-place edit is wrong); the
   as-built text does not lead to the act. That is an implementation defect in
   `flow-retro`'s wording, not a design defect.
2. **Blocking in practice.** The output verdict 2 prescribes cannot be committed in
   this repository: the document gate rejects it. No row names the gate, so by the
   row test this is not blocking; it is routed with finding 1 because verdict 2 is
   unusable here until it is fixed, and design 10's landing waits on it. The
   reviewer may overrule this to a follow-up.

### Verdict

**3 - route back to implementation.** Status stays `pending-retro`; round 2 of
`flow-common`'s round budget. The round:
- reword `flow-retro` §4 verdict 2 (and its done-checklist line) so the act is
  stated: the retro writes the follow-up file, then lands; the case stays as it is
  and re-runs;
- make the document gate admit a `draft-followup` file: a name the gate can tell
  apart, and a module that checks only the shape `flow-grill-review` §3 defines
  (status word, back-pointer);
- re-run `fork-retro-followup-*` on both models; this flow re-closes afterwards.
