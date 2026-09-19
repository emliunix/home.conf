# eval-prompt — design philosophy and dimensions

**What it is.** A general instrument: evaluate any instruction artifact — a prompt, a skill, a doc, a task brief — by blinded trials with a control arm. `SKILL.md` is the artifact; this package is its instrument (`flow-skills-eval/design/03-skill-package-format.md`).

## Philosophy

An artifact is validated by whether it changes an outcome, never by how it reads.

1. **Separate the two failure modes.** Metadata triggers; the body guides. The arms exist to tell *it never fired* from *it fired and misled* — a single "did it work?" answer cannot.
2. **A claim counts only against control.** A tie is decoration; worse is harmful. Where a clean control is unobtainable the result is a **sample**, and says so.
3. **Subjects must be blind, and blindness needs a fence.** A control that has read the rubric is not a control; the fence covers greps, so fenced material lives outside the tree for the batch.
4. **The material is the artifact.** Hand the bytes, record the digest, scope the verdict to what was abridged — a trial whose input is a paraphrase measures the paraphrase.
5. **Trajectory is evidence; feedback is leads.** Collect both, score only the first.
6. **Every part earns its place or is deleted** — and a part the trial never exercised is *unpriced*, not decoration.

## Dimensions

| dimension | the question | arms |
|---|---|---|
| **trigger** | does the entry surface fire at the right moment? | control, entry-only (control degenerate → distractor set, negatives, route repetition) |
| **procedure** | does the body make the agent follow the method? | control, entry-only, full |
| **comprehension** | does a doc get a reader to the right place? | control, headings-only, full |
| **production** | does a doc let someone produce a working artifact? | blind, assisted |
| **induction** | does it pay for itself? | control, full |
| **ablation** | does a part earn its place? | full vs full-minus-one-part |

Rubrics per dimension, with the defect each item must flip, are in `tests/rubric.yaml`; cases are in `tests/cases/`.

## What it refuses

Reviewing an artifact's prose; asking the artifact's author whether it works (the least blind subject available); standing in for the subject's own acceptance check — the trial measures the *contribution*, the acceptance check measures the *work*.

## Maintenance

Every change lands a `CHANGELOG.md` row naming the trial that caused it. A change to the **description** is a change to the entry surface: it needs a `trigger` run, not a reading. Run `tests/frozen.lock.json` assertions before scoring anything, and regenerate the lock in the same commit as the change.
