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

**Heads.** The Problem statement holds. Scope held, with one gap: it puts the
follow-up file at `design/NN-<topic>.md` but leaves the repository's document gate,
which governs every `design/NN-*.md` as a lifecycle design (finding 2). The
Rationale survives. Its open question (inline correction of a landed sentence) has
since been ruled by the owner, who allows non-semantic fixes in place; that refines
the no-direct-edits rule rather than failing a row, so it is follow-up work.

### Evidence

- Final L1 runs (`worklog/10-eval-corpus-triage/final-*.tsv`), neutral questions:
  `fork-retro-design-defect-*`, `fork-retro-p0-*`, `fork-retro-p0-design-*` 3/3 on
  flash; pro misses only the two paraphrases (`run_retro`), dispositioned 2
  (deferred, schema). `fork-retro-followup-*` 0/3 on both (`run_retro, landed,
  worklog` or `reject_finding`), although the question sets aside the status line
  and the worklog entry.
- Prose probe, `flow-skills-eval/scripts/prose-probe.ts`: the case's own prompt,
  fixture and neutral question, no tool. All six runs (three cases, both models)
  name verdict 2 with one follow-up file; the trap answers also refuse the in-place
  edit. Output: `worklog/09-retro-outcomes/probe-neutral.md`. A first probe, which
  asked "which verdict applies and what the retro writes", cued the answer and is
  not used.
- The follow-up file written for design 10's retro was NO-GO under
  `check --all --profile draft` on `main`: status not in the design vocabulary, and
  no `Goal`, `Problem statement`, `Rationale` or `Review`. The template's
  `.doc-verify.yaml` governs `design/[0-9][0-9]-*.md` the same way.

### Findings and routes

1. **Blocking.** Row "the cases agree with the skill" fails on
   `fork-retro-followup-*`: with the edited skills, both models answer with a
   different tuple, including the two fields the question sets aside, so no second
   reading makes the answer correct. The probe and the tool run disagree, which
   makes the case "1, unconfirmed (probe disagrees)" (peer review, PR #19), not a
   disposition 2. The cause is either the verdict-2 wording or the single-act schema
   (design 11 unit 1), and the evidence does not yet separate them.
2. **Not blocking.** The document gate rejected the follow-up file. Fixed outside
   this retro as a small task (`8b39d38`: the `-followup` name, the follow-up
   module, the line in `design/00`). The skills still give the name as
   `design/NN-<topic>.md`; that disagreement is a follow-up unit.
3. Follow-up units, filed in `design/11-eval-instrument-followup.md` (design 10's
   follow-up file; this retro has no verdict 2): the template's document gate; the
   skills on the `-followup` name; the owner's inline-correction ruling; a route
   for a row made unprovable by a broken instrument.

### Verdict

**None yet; status stays `pending-retro`.** Finding 1 blocks. If design 11 unit 1
(stage vs act) lands and the cases still miss, it is verdict 3, a round on the
verdict-2 wording; if they pass, this flow re-closes with verdict 1 or 2. The four
verdicts have no route for a row the instrument cannot yet measure, so this
waits, recorded, rather than taking verdict 3 on unseparated evidence.
