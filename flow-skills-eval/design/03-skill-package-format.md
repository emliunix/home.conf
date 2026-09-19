# 03 — Skill package format

Status: **proposed** (2026-09-19). Extends `ref-eval-design-guide.md` to the skills themselves: a skill is not a lone `SKILL.md` but a package whose instrument travels with it.

## Why

Five iterations of trials on `eval-prompt` and the ten `visflow-*` skills produced the evidence:

- an arm given the skill **without** its case table **invented its own rubric**, so two subjects under the same variant could not be scored comparably;
- trigger trials were run against catalogs of the entry surfaces which **went stale** because the cases lived outside the skills they tested;
- negatives written in the clause vocabulary made a surface look discriminating when it was matching **words, not situations** (the trap/paraphrase pair exists precisely for this).

Putting the rubric and the cases **inside the package** makes the subject and its instrument move together, and the frozen lock makes staleness a failing check rather than a discipline.

## Layout

```
<skill-name>/
  SKILL.md           # the artifact. The only file the harness reads; frontmatter = entry surface.
  README.md          # design philosophy + the dimensions this skill is tested on.
  CHANGELOG.md       # one row per change: date, what changed, the finding, the record that showed it.
  tests/
    rubric.yaml      # dimensions -> rubrics -> items, each naming the defect that must flip it.
    cases/
      <dimension>.yaml   # cases as canonical / trap / paraphrase triplets, each citing its SKILL.md line.
    frozen.lock.json # SHA-256 of SKILL.md + of each case file; a trial asserts the lock before scoring.
```

`README.md`, `CHANGELOG.md` and `tests/` are **extensions** beyond the skill-authoring anatomy (`SKILL.md` + `scripts/` + `references/` + `assets/`): the harness ignores them, and this project consumes them. Keep them out of `SKILL.md` context - they are the instrument, not the skill.

## Dimensions, rubrics, items

A skill is tested on **dimensions** (for `eval-prompt`: trigger, procedure, comprehension, production, induction, ablation). Each dimension holds **one or more rubrics** - a rubric is a scoring scheme with its own arms and pass bar - and each rubric holds **items**, each of which names the defect that must flip it. An item that no defect can flip is a **property** and says so.

## Cases are triplets

Per `ref-eval-design-guide.md` rule 2, every behaviour gets *canonical* / *trap* / *paraphrase*. For an entry surface the three are:

| kind | what it is | what it kills |
|---|---|---|
| canonical | a task in the skill vocabulary | measures nothing on its own |
| trap | the forbidden case dressed in the skill vocabulary | false positives |
| paraphrase | the same case with the vocabulary removed | **lexical guards** - the failure this project measured |

Rule 4 applies unchanged: **each case cites the `SKILL.md` line that makes its expectation correct**, so cases die traceably with the rules they test.

## Profiles

- **smoke** - L0 (rubric lint: every item names a flipping defect, every case cites a line) + the trigger dimension. Runs on any skill edit.
- **full** - all dimensions, all triplets, plus a frozen-lock assertion. Runs at release or on a structural change.
