# experiment-round — design philosophy and dimensions

**What it is.** The method for answering a question by experiment: a round inside an existing tree, or a new programme with its own root when the question fits no tree. `SKILL.md` is the artifact; this package is its instrument (`flow-skills-eval/design/03-skill-package-format.md`).

## Philosophy

1. **Design it twice.** Two or three genuine candidates along one axis the hypothesis turns on; a second flavour of the first shape is not a candidate.
2. **The prediction comes first.** Expectations written before the first run are predictions; written after, they are regression gates. A round carries both and says which is which.
3. **The plan is reviewed while it can still change.** An independent seat reads the plan against the hypothesis before the run — the cheapest review there is.
4. **A run that disagrees is the finding.** The prediction is corrected in place, not the evidence.
5. **A question gets the root it fits.** One that fits no tree, or spans two, gets its own; its file set arrives as its stages arrive, and what has not arrived is named.

## Dimensions

| dimension | the question | how it is measured |
|---|---|---|
| **trigger** | does the entry surface fire on a question that needs an experiment, in an existing tree or a new one, and stay silent on tabulating a finished run? | trigger pass over `tests/cases/trigger.yaml` triplets |
| **procedure** | does an agent place the question, then produce hypothesis, axis, candidates, reviewed pre-registration, run-and-evaluate and predicate in order? | entry-only vs full arm on the same request; the record is checked for each stage and for the review committed with the plan |
| **production** | does the round's predicate run, report an honest complete flag, and does the evaluation name what the run contradicted? | the committed commands are run; the verdict is read against the pre-registration |
| **ablation** | does each step earn its place? | full vs full-minus-one-step on the same request |

Rubrics per dimension, each item naming the defect that must flip it, are in `tests/rubric.yaml`.

## What it refuses

Tabulating a run that already happened; predictions written after the measurement; one candidate in two flavours; a round squeezed into a tree the question does not fit; a skeleton that pretends to be complete.
