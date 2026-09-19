---
name: eval-prompt
description: >-
  Evaluate an instruction artifact by blinded trials: control, entry-only and full arms,
  trajectory plus post-trial feedback, rubrics by case (trigger, procedure, comprehension,
  production, induction, ablation), loadability and material-integrity checks, a blinding read
  fence, and a delta-against-control bar. Use when you need to know whether a prompt, skill,
  brief or doc actually changes an agent or reader outcome; not for reviewing its prose or
  asking its author.
---

# eval-prompt

Evaluate an **instruction artifact** by blinded trials with a control arm. *Prompt* here = any instruction surface handed to a model or person: a **prompt**, a **skill** (entry surface + body), a **doc**, a **brief**. Keep the artifact under test ("the artifact") apart from the text given to subjects ("the task").

## Cases

| Case | Question | Arms | Passes when |
|---|---|---|---|
| **trigger** | does the entry surface fire at the right moment? | control, entry-only | the right artifact is selected and no wrong one is. The control is **degenerate** here — use a **distractor set**, **negative tasks** (nothing should fire), and **repetition across routes** |
| **procedure** | does the body make the agent follow the method? | control, entry-only, full | every mandatory step observed, in order; the artifact accepted |
| **comprehension** | does a doc get a reader to the right place? | control, headings-only, full | the reader lands on the right files; no wrong inference uncorrected |
| **production** | does a doc let someone produce a working artifact? | blind, assisted | acceptance implies execution — what it accepts, it runs |
| **induction** | does it pay for itself? | control, full | at equal outcome, the full arm is cheaper |
| **ablation** | does a part earn its place? | full vs full-minus-one-part | each part **either** degrades the outcome (keep, record why) **or** changes nothing — and is **deleted** |

No case named → run **trigger**, then **procedure**. The cheap first move is always the **trigger probe**: one model, all entry surfaces in one context, one classification pass, no task execution.

**Ablation** is the empirical form of `principle-subtract-before-you-add`: remove one component at a time — a section, a rule, an example, a sentence of the entry surface — and re-run the case’s arms. Exempt and **named** instead: blinding, freeze, and any safety rule; a sampled trial cannot price a rare event.

## Preconditions

**Loadability.** Before a trigger verdict means anything, confirm the subjects can actually *load* the artifact. If they cannot — a skill the harness does not expose, a doc nobody can open — the trial measures **intent matching** only, and the verdict says so.

**Lint the artifact before you measure it.** A loadability failure has causes that look identical from a subject: wrong install root, a session that started before the install, and a file no loader can parse. Check them in that order, cheapest first — parse the frontmatter, then confirm the exposed catalog contains the name. An unquoted `: ` inside a `description:` makes the frontmatter invalid YAML; every loader silently drops the skill, and five trials can then measure an artifact that can never fire. Report the cause you established, not the one you inferred.

## Blinding needs a read fence

Subjects must not learn which artifact is under test, **and must not read the pre-registration**. Keep the rubric, the arms and the predictions outside the tree under test until the batch closes; or name the fence in the task and verify compliance. **The fence covers greps**: a subject searching the tree for task keywords will be served fenced *lines*. Keep fenced material **outside the tree** for the duration of the batch, and land it in the record at close. A control that has read the rubric is not a control.

## Material integrity

Record the artifact’s digest and length, and hand subjects **those bytes**. If you abridge or paraphrase, mark it and **scope the verdict to the abridged material**: a trial whose input is a paraphrase measures the paraphrase. When two records disagree on a checkable fact about the material, neither is evidence until one is reproduced against it.

## Running a trial

1. **Declare** the subject — case, artifact paths, digest, and whether the subjects can load it — and what is held constant: task, model, effort, tools, environment.2. **Pre-register** the rubric, the arms, and the expected outcome per task, **before the first run**. Where an intended routing is genuinely ambiguous, record **both readings** and score the ambiguity as a finding — never as a miss against an intention the subject could not know.3. **Freeze** the artifact, the tree and the rubric for the batch.4. **Separate the subject from the scorer.** The expected routing per task is an **answer key**: it belongs to the pre-registration and to whoever scores, **never in the subject’s hand-out** — a subject that invents the key and then scores itself against it has measured nothing, and a subject handed it has nothing left to demonstrate. If the artifact ships as a package (`tests/rubric.yaml`, `tests/cases/`), hand the subject the package **minus the key** and pin what you handed with its digest.5. **Trajectory** — one file per trial: what it read, what it ran, what it decided, in order, plus the artifact it produced. Score that, never a memory of the run. Then, **after** the trial, ask for **feedback** on the artifact — where it re-read, what it skipped and why, what it would delete — and record it in the same file. Trajectory is evidence; feedback generates leads: not evidence until something reproduces it, and never scored.6. **Score** per rubric item, per trial, then report the **delta against control**: a claim counts only when control is worse — a tie is decoration, worse is harmful. If no clean subject can be obtained, say so and label the result a **sample**.7. **Disposition** every finding: fixed, or recorded with the trial that shows it. Where the host project has its own disposition rules, follow those.
## Self-application

Run it on itself: `trigger` on its own description, `procedure` on its own body, `ablation` on its own sections.

## Refusing

Not prose review; not asking the author (the least blind subject available); not a substitute for the case’s own acceptance check — the trial measures the artifact’s *contribution*, the acceptance check measures the *work*.
