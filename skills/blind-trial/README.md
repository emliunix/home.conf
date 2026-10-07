# blind-trial — design philosophy and dimensions

**What it is.** Blinded trials as the measurement of a record or a surface. A **reader batch** asks whether
the record onboards a newcomer; an **author round** asks whether the surface lets someone produce a working
program. Both give someone the thing, let them use it, and count what happens. `SKILL.md` is the artifact;
this package is its instrument (`flow-skills-eval/design/03-skill-package-format.md`).

## Philosophy

1. **Measured, not asserted.** Onboarding and authoring quality are numbers from a batch, never one
   impression.
2. **The repository's own files.** A trial over a summary measures the summary's author.
3. **A still, tagged tree.** The freeze is witnessed by a tag, so every finding attributes to a revision.
4. **Per participant, never averaged.** Each trajectory is data about one path through the material.
5. **Every finding dispositioned, none blanket-remediated.** A fix copied into every document someone
   complained about recreates the defect.
6. **Acceptance implies execution.** A document that compiles but cannot run is not accepted.

## Dimensions

| dimension | the question | how it is measured |
|---|---|---|
| **trigger** | does the entry surface fire on measuring onboarding or authoring, and stay silent on a single impression, compile counts or a summary? | trigger pass over `tests/cases/trigger.yaml` triplets |
| **procedure** | does an agent apply the shared rules and the reader or author steps in order? | control, entry-only and full arms on the same request; the dispatch briefs, the tag and the commit log are checked |
| **production** | is the trial's record a measurement — per-participant metrics, a tag, executed acceptances, a disposition per finding? | review of the produced record against the tree at the tag |
| **ablation** | does each step earn its place? | full vs full-minus-one-step on the same request |

Rubrics per dimension, each item naming the defect that must flip it, are in `tests/rubric.yaml`.

## What it refuses

One reader's impressions presented as a batch; compile counts presented as authoring success; a summary
handed over in place of the repository; edits while the trial runs; a fix applied everywhere at once.
