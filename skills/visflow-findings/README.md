# visflow-findings - design philosophy and dimensions

**What it is.** Triage to root cause: reproduce before accepting, ask why until the mechanism is named, then fix or record with the file that evaluates it.

SKILL.md is the artifact; this package is its instrument (flow-skills-eval/design/03-skill-package-format.md).

## Philosophy

Triage to root cause: reproduce before accepting, ask why until the mechanism is named, then fix or record with the file that evaluates it.

## Dimensions

| dimension | the question | arms |
|---|---|---|
| **trigger** | does the entry surface fire on a defect, a review or an interrogation lands, and stay silent on the excluded shapes? | entry-only, distractor set |
| **procedure** | does an agent follow the body's steps, in order, with observable evidence? | control, entry-only, full |
| **production** | does what the agent produces satisfy the skill's own acceptance check? | full |
| **ablation** | does each step earn its place? | full vs full-minus-one-step |

## What it refuses

not when the task is to log a finding without fixing it or recording its disposition..

## Maintenance

Every change lands a row here and in the repo record naming the trial that caused it. Run the lock assertions
in tests/frozen.lock.json before scoring, and regenerate the lock in the same change.
