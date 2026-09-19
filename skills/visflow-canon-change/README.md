# visflow-canon-change - design philosophy and dimensions

**What it is.** Canon moves only through an evaluating record: record first, the amended sentence cites it, contradicted predictions are corrected in place.

SKILL.md is the artifact; this package is its instrument (flow-skills-eval/design/03-skill-package-format.md).

## Philosophy

Canon moves only through an evaluating record: record first, the amended sentence cites it, contradicted predictions are corrected in place.

## Dimensions

| dimension | the question | arms |
|---|---|---|
| **trigger** | does the entry surface fire on this skill's own work, and stay silent on the excluded shapes? | entry-only, distractor set |
| **procedure** | does an agent follow the body's steps, in order, with observable evidence? | control, entry-only, full |
| **production** | does what the agent produces satisfy the skill's own acceptance check? | full |
| **ablation** | does each step earn its place? | full vs full-minus-one-step |

## What it refuses

not for a review, a plan or a commit moving it on its own..

## Maintenance

Every change lands a row here and in the repo record naming the trial that caused it. Run the lock assertions
in tests/frozen.lock.json before scoring, and regenerate the lock in the same change.
