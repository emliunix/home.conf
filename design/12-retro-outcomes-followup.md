# 12 - Retro outcomes follow-ups

Follow-up file from the retro of design 09 (retro outcomes):
[worklog/09-retro-outcomes.md](../worklog/09-retro-outcomes.md), § Retrospective (2026-10-16).
It carries no obligation until someone picks it up; a unit picked up becomes the
scope of a normal design, and the heads are written then.

## Unit 1 - The template's document gate admits follow-up files

Kind: clean-up (project template).

`skills/project-skeleton/init/.doc-verify.yaml` governs every
`design/[0-9][0-9]-*.md` as a lifecycle design, so a project made from the template
rejects the follow-up file that `flow-retro` §4 verdict 2 and the review sweep
write, as home.conf did until the retro of design 09. Carry home.conf's fix: the
`-followup` name, a follow-up module that checks the status word and the
references, and a line in the template's design guide. Its seed: a follow-up file
in a scratch project is NO-GO today.

## Unit 2 - Non-semantic corrections in place

Kind: a retro of the retro process.

Design 09 makes the retro edit nothing. Since then the owner ruled that a retro
may fix history and docs in place when the change is not semantic: a mis-stated
sentence, or design text whose correction helps the code. Semantic changes still
go through the verdicts. Open in the design: the test for "not semantic", where
each fix is recorded, and which documents it may touch (a landed design's body
included). Candidates waiting on it: design 10's two outgrown sentences
(design 11 unit 4).

## Status

draft-followup
