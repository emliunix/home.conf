# 11 - Eval instrument follow-ups

Follow-up file from the retro of design 10 (eval corpus triage):
[worklog/10-eval-corpus-triage.md](../worklog/10-eval-corpus-triage.md), § Retrospective (2026-10-16).
Units 7–10 come from the retro of design 09
([worklog/09-retro-outcomes.md](../worklog/09-retro-outcomes.md), § Retrospective),
which has no verdict 2 and so no follow-up file of its own. The file carries no
obligation until someone picks it up; a unit picked up becomes the scope of a normal
design, and the heads are written then.

## Unit 1 - Split stage from act in the decision schema

Kind: re-architecture (the L1 instrument).

`submit_decision.next_action` holds both *which stage runs* (`run_retro`) and *what
act it takes* (`set_status`, `remediate`, `halt_structural`). Inside a retro,
`run_retro` is a true answer for any decision, so no situation-free definition
separates the two. Cases it explains (design 10 C6, "2 (deferred)" rows and the
deferred remainders):
- `gate-reviewed-pending-paraphrase` (pro 0/3; flash 0/3 after design 08's §0 sentence), `gate-pending-landed-canonical` (pro 2/3);
- `fork-retro-design-defect-paraphrase` and `fork-retro-p0-design-paraphrase` (pro 0/3);
- `fork-impl-defect-canonical` (flash 2/3), `write-target-retro-canonical` (flash 2/3);
- `fork-p0-violation-trap` (pro 1/3) and `sweep-destination-trap` (both 0/3), where
  rejecting a proposal in the fixture is an act of its own (`reject_finding`).
- `fork-retro-followup-*` (both 0/3, "1, unconfirmed (probe disagrees)"): the
  prose probe gives verdict 2 with the follow-up file 6/6; whether the single-act
  tuple or the skill wording causes the miss is what this unit would settle;
- `budget-paraphrase` (both 0/3, "1, unconfirmed (probe disagrees)"): both prose
  answers rewrite the brief; both tuples say `halt_structural`.

Design 08's round 2 already added one value, `write_target: module_docs`, because
the schema could not name a module document at all; this unit owns the schema
from here, and a full-corpus run on both models after that change is owed.

The class is sensitive to the prompt: after `module_docs` was added, pro's older
cases fell from 98 to 91, and after one sentence in flow-grill-review they rose to
100, every move in the stage-vs-act answers (worklog/08 C7–C8).

Candidate shapes: score `act` only, or add a `stage` field. Either one changes the
tool schema and so the frozen-prefix lock; the expected tuples' meaning must not move
(design 10's rule).

## Unit 2 - flow-common round budget: "rewrite the brief" vs "the brief is wrong"

Kind: process or docs optimization (skill text).

`budget-paraphrase` is "1, unconfirmed (probe disagrees)": both models' tuples halt
at round 3 of a loop whose brief is misread (0/3 each), while both prose answers
rewrite the brief. `flow-common` gives rounds 3–4 "Rewrite the brief", but its
round-5 sentence lists "the brief is wrong" as a halt cause, which may pull the act
toward `halt_structural`. Settle with unit 1 first; if the miss survives, the fix
goes to the skill text and the case re-runs.

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

`vp run eval:full` reports totals only. The committed per-case TSVs come from
`scripts/per-case-run.ts`, committed at PR #19 as an interim script outside the
harness and its tests. Fold the per-case report into the harness, with the
provenance `runProvenance` already records, and retire the script.

## Unit 6 - A prose probe beside the tuple run

Kind: process optimization (the triage rule in `ref-eval-design-guide.md`).

At the retros of designs 09 and 10, a no-tool probe (`scripts/prose-probe.ts`: the
case's own frozen prompt, fixture and question, unchanged) disagreed with the tuple
run on `fork-retro-followup-*` and on pro's `budget-paraphrase`. A first probe that
asked "which verdict applies and what the retro writes" cued the answer and was
withdrawn (PR #19 review). Rule to add to the guide: the probe uses the case's
question unchanged, covers every case of the triplet on every model, and is
committed with its output; a probe that disagrees with the tool run makes the case
"1, unconfirmed (probe disagrees)", never a 2 on its own.

## Unit 7 - The template's document gate admits follow-up files

Kind: clean-up (project template).

`skills/project-skeleton/init/.doc-verify.yaml` governs every
`design/[0-9][0-9]-*.md` as a lifecycle design, so a project made from the template
rejects the follow-up file that `flow-retro` §4 verdict 2 and the review sweep
write, as home.conf did until the retro of design 09. Carry home.conf's fix: the
`-followup` name, a follow-up module that checks the status word and the
references, and a line in the template's design guide. Its seed: a follow-up file
in a scratch project is NO-GO today.

## Unit 8 - Non-semantic corrections in place

Kind: a retro of the retro process.

Design 09 makes the retro edit nothing. Since then the owner ruled that a retro
may fix history and docs in place when the change is not semantic: a mis-stated
sentence, or design text whose correction helps the code. Semantic changes still
go through the verdicts. Open in the design: the test for "not semantic", where
each fix is recorded, and which documents it may touch (a landed design's body
included). Candidates waiting on it: design 10's two outgrown sentences
(unit 4).

## Unit 9 - The skills on the follow-up file's name

Kind: docs clean-up (skill text).

`design/00` now names a follow-up file `design/NN-<topic>-followup.md` (`8b39d38`),
while `flow-grill-review` (§3, the sweep) and `flow-retro` (§4 verdict 2) still say
`design/NN-<topic>.md`: one fact, two statements that disagree. Either the skills
take the `-followup` name, or the gate selects the follow-up shape another way (a
companion's `document.type`, as the owner-forwarded survey of document rules
proposes) and the name stays free.

## Unit 10 - A route for a row the instrument cannot measure

Kind: a retro of the retro process.

Design 09's retro found a row that fails on the tuple run while a probe disagrees.
`flow-retro`'s four verdicts have no route for "the row is unprovable because the
measuring instrument is not yet fit", so design 09 waits at `pending-retro`. Decide
whether that is a fifth outcome (hold, naming the instrument fix) or verdict 3
spent on the instrument.

## Status

draft-followup
