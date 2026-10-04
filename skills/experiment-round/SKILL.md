---
name: experiment-round
description: >-
  First-principles experiment rounds and the programmes that hold them: one hypothesis, one axis, two
  or three genuine candidates, expectations pre-registered and reviewed by an independent seat before
  the run, an honest predicate; a question that fits no existing tree gets its own root, whose file set
  arrives as its stages arrive with the absences named. Use when a question needs an experiment, in an
  existing tree or in a new one; not when the experiment has already been run, or the task is to
  tabulate its results.
---

# Experiment rounds and programmes

## Where the question lives

1. **A question that fits an existing tree** is a round inside that tree.
2. **A question that fits no existing tree gets its own root directory**, never a round inside someone else's. A question that spans two trees (semantics measured in one, price in the other) belongs in a new root: a round in either answers only half.
3. **The file set arrives as its stages arrive** — a README, the grounding (the claims under test, each with what would falsify it), the gate ledger, the plan for round 1, a probe directory, results, tests, the round's verdict, the decision rows. Create what the stage needs, and **name the files you have not created yet and why**: a reader enumerates the tree by listing it and must be able to tell what is missing.

## Run a round

1. **Hypothesis** — what is claimed, in one sentence, with the cell that would refute it.
2. **Axis** — the one dimension the candidates differ along, chosen because the hypothesis turns on it; not a list of everything that might vary.
3. **Candidates** — two or three designs, one per point on the axis. A second flavour of the first shape does not count.
4. **Pre-register** — record the outcome expected of each candidate **before the first run**. A prediction written after the measurement is a regression gate, not a prediction. **Before the run, an independent seat reads the plan against the hypothesis**: is it falsifiable by the named predicate, is the axis the one it turns on, is every expectation recorded first, what does the plan leave unmeasured. The plan and its review are committed together (see `adversarial-evaluate`, the plan-before-run case).
5. **Run**, then **evaluate** — what measured, which candidate the measurement selects, what it leaves unmeasured, which expectations the run contradicted. Read the runs the way a user would, not the internals.
6. **Predicate** — the committed commands this round runs, each reporting an honest `complete` flag: one command per track, not one for all of them. A skip is not a pass. Whether each check can fail at all belongs to `seeded-defect-gate`.

**A run that disagrees with the prediction is the finding**: correct the prediction in place and say so. A round carries both its predictions and its regression gates, and says which is which. The records a round produces follow `record-conventions`.

## Worked instances (visflow)

- A reader asked where a cost experiment would live and had to infer the answer: nothing said that a question fitting no tree gets its own root.
- The full file set was once described as "the set every open programme already has"; a reader checked and found one programme without a gate ledger and another with only its grounding. Hence *as its stages arrive*, and the named absences.
- A dry-run walk found each round running two commands — the corpus predicate, then its suite — each with its own complete flag, which is why step 6 says one command per track.
- No skill owned an independent review of an experiment design; a three-seat, three-round plan review existed only as a worklog tree. It is the cheapest review there is, because it is the only one that can still change the outcome (step 4).

## Project binding

The repository's AGENTS.md (or its equivalent) names the concrete files this skill refers to by role: where programmes live, the method document that states the round arrangement, the conventional names of the grounding, gate ledger, plan, verdict and decision rows, and the model-route table the independent seat is drawn from, if it has one. Where one of these roles has no file, that absence is a finding to record, not a reason to invent one.
