# visflow-round - design philosophy and dimensions

**What it is.** One axis per round: candidates recorded before the run, expectations pre-registered, a falsifier that could retire the claim.

SKILL.md is the artifact; this package is its instrument (flow-skills-eval/design/03-skill-package-format.md).

## Philosophy

One axis per round: candidates recorded before the run, expectations pre-registered, a falsifier that could retire the claim.

## Dimensions

| dimension | the question | arms |
|---|---|---|
| **trigger** | does the entry surface fire on this skill's own work, and stay silent on the excluded shapes? | entry-only, distractor set |
| **procedure** | does an agent follow the body's steps, in order, with observable evidence? | control, entry-only, full |
| **production** | does what the agent produces satisfy the skill's own acceptance check? | full |
| **ablation** | does each step earn its place? | full vs full-minus-one-step |

## What it refuses

not when the experiment has already been run, or the task is to tabulate its results..

## Maintenance

Every change lands a row here and in the repo record naming the trial that caused it. Run the lock assertions
in tests/frozen.lock.json before scoring, and regenerate the lock in the same change.
