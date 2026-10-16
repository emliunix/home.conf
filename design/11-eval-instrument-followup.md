# 11 - Eval instrument follow-ups

Follow-up file from the retro of design 10 (eval corpus triage):
[worklog/10-eval-corpus-triage.md](../worklog/10-eval-corpus-triage.md), § Retrospective (2026-10-16). It carries no
obligation until someone picks it up; a unit picked up becomes the scope of a normal
design, and the heads are written then.

## Unit 1 - Split stage from act in the decision schema

Kind: re-architecture (the L1 instrument).

`submit_decision.next_action` holds both *which stage runs* (`run_retro`) and *what
act it takes* (`set_status`, `remediate`, `halt_structural`). Inside a retro,
`run_retro` is a true answer for any decision, so no situation-free definition
separates the two. Cases it explains (design 10 C6, "2 (deferred)" rows and the
deferred remainders):
- `gate-reviewed-pending-paraphrase` (pro 0/3), `gate-pending-landed-canonical` (pro 2/3);
- `fork-retro-design-defect-paraphrase` and `fork-retro-p0-design-paraphrase` (pro 0/3);
- `fork-impl-defect-canonical` (flash 2/3), `write-target-retro-canonical` (flash 2/3);
- `fork-p0-violation-trap` (pro 1/3) and `sweep-destination-trap` (both 0/3), where
  rejecting a proposal in the fixture is an act of its own (`reject_finding`).
- `fork-retro-followup-*` (both 0/3): a prose probe gives verdict 2 with the
  follow-up file every time; the tuple can carry the landing or the file, not both
  (design 10 retro, correction to C6);
- `budget-paraphrase` on pro: its prose rewrites the brief and resumes, but
  "halt dispatch" maps onto `halt_structural`.

Candidate shapes: score `act` only, or add a `stage` field. Either one changes the
tool schema and so the frozen-prefix lock; the expected tuples' meaning must not move
(design 10's rule).

## Unit 2 - flow-common round budget: "rewrite the brief" vs "the brief is wrong"

Kind: process or docs optimization (skill text).

`budget-paraphrase` stays disposition 1 on flash only: its prose answer at round 3
of a loop whose brief is misread mixes "rewrite the brief" with breakout
adjudication. `flow-common` gives rounds 3–4 "Rewrite the brief", but its round-5
sentence lists "the brief is wrong" as a halt cause. Pro's prose is right (its miss
is unit 1), so the finding is weak and unconfirmed. The case stays red; a fix goes
to the skill text, and the case re-runs.

## Unit 3 - Confirm single-family findings

Kind: process optimization (eval practice).

Both models used so far are deepseek. Disposition-1 rows, and the one-model rows,
are unconfirmed by another family:
- run the full profile on one non-deepseek model and record it beside the
  deepseek runs;
- `sweep-destination-canonical` and `-paraphrase` (flash 0/3, pro 3/3) and
  `gate-draft-reviewed-trap` (pro 2/3) stay labelled until then;
- the guide's "1 (one model)" label reads as a finding; relabel it "unconfirmed",
  so the count of skill findings stays honest (design 10 implementation-review note).

## Unit 4 - Design 10's body: two sentences the implementation outgrew

Kind: docs clean-up.

- Scope, *The cases*, gives "what file does the retro create for these findings,
  and with what status?" as the example of a question that names the scored act.
  The implementation review (C7, finding 1) showed that question presupposes the
  answer; the as-built neutral form is "setting aside the retro's own worklog entry,
  what does the verdict do with this finding?".
- The consistent-tuples table calls `remediate, unchanged, worklog` "a
  disposition-3 candidate". The case (`budget-paraphrase`) ended as disposition 1;
  no case took disposition 3.
- Verification design names the decisions unit test without its
  `flow-skills-eval/` prefix, so the path does not resolve (`module.paths-resolve` WARN).

Design 10 is landed, so these move only through a design, or through a rule that
admits non-semantic corrections in place if one lands.

## Unit 5 - A per-case report from the harness

Kind: clean-up (eval tooling).

Design 10's raw runs were made by an uncommitted script that prints one row per
case (`k/n`, expected, first miss). `vp run eval:full` reports totals only, so a
committed run cannot be reproduced from the repository. Add the per-case report to
the harness, with the provenance `runProvenance` already records.

## Unit 6 - A prose probe before disposition 1

Kind: process optimization (the triage rule in `ref-eval-design-guide.md`).

At design 10's retro, a no-tool probe (the case's frozen prompt, fixture and
question, the model asked to explain its decision) overturned two of the three
disposition-1 labels: both models reasoned to the expected decision and lost it in
the tuple. The guide's rule checks a second reading only by model agreement. Add
the probe as the step before labelling a miss 1, keep its answers with the run, and
commit the probe script with the per-case report (unit 5).

## Status

draft-followup
