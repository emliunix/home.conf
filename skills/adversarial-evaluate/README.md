# adversarial-evaluate — design philosophy and dimensions

**What it is.** The method for an adversarial verdict on work: **an evaluation is a measurement with several
instruments**. Independent seats, one shared prompt, a pooled verdict. `SKILL.md` is the artifact; this
package is its instrument (`flow-skills-eval/design/03-skill-package-format.md`). The `verification` skill
points here when a claim needs a multi-seat verdict rather than a single check.

## Philosophy

1. **Diversity, not personas.** Every seat gets the same prompt, the same change set and the same rubric;
   the adversarial signal comes from *different models reading the same thing*, never from role-play.
2. **An evaluation does not change the artifact.** It records what the seats found and how the lead judged
   it. The work it judges owns its own acceptance check.
3. **A factual disagreement is reproduced, not voted on.** Consensus decides direction; the lead's own check
   settles facts; both readings are recorded when it cannot.
4. **The instrument is a file.** A prompt that lives in a temporary directory cannot be reproduced, and the
   verdicts that cite it cannot be re-run.
5. **The review set is derived, not remembered** — the commits since the previous pass, fixed before the
   first seat reads.

## Dimensions

| dimension | the question | how it is measured |
|---|---|---|
| **trigger** | does the entry surface fire on evaluation-shaped work, and stay silent on prose review and single impressions? | trigger pass over `tests/cases/trigger.yaml` triplets |
| **procedure** | does an evaluating agent run the six steps in order — set, roster, instrument, consensus, disposition, record? | control, entry-only and full arms on the same request |
| **coverage** | has the method been run on **each case kind**, not only on rounds? | the cases table, one trial per row |
| **production** | does the verdict land as an evaluating file with its range, the lead's judgement, its dispositions and its decision rows? | review of the produced record |
| **ablation** | does each step earn its place? | full vs full-minus-one-step on the same request |

Rubrics per dimension, each item naming the defect that must flip it, are in `tests/rubric.yaml`.

## What it refuses

Reviewing prose or style; one evaluator's impression presented as a consensus; a read-only role that edits
the artifact it judges; a verdict that changes nothing and binds no round.

## Maintenance

Every change lands a `CHANGELOG.md` row naming the trial that caused it, and regenerates
`tests/frozen.lock.json`. A change to the **description** is a change to the entry surface: it needs a
`trigger` run, not a reading.
