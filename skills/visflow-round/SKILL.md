---
name: visflow-round
description: >-
  Project specific method on first-principles experiment rounds in visflow: design-twice
  candidates, tracer-bullet spikes, one axis, pre-registered expectations, a falsifier per
  round, an honest predicate. Use in visflow when a question needs an experiment in an
  existing tree; not when the experiment has already been run, or the task is to tabulate its
  results.
---

# Run a round

1. **Hypothesis** — what is claimed, in one sentence, with the cell that would refute it.
2. **Axis** — the one dimension the candidates differ along, chosen because the hypothesis turns on it.
3. **Candidates** — two or three designs, one per point on the axis. A second flavour of the first shape does not count.
4. **Pre-register** — record the outcome expected of each candidate **before the first run**. A prediction written after the measurement is a regression gate, not a prediction.
5. **Run**, then **evaluate**: what measured, which candidate the measurement selects, what it leaves unmeasured, which expectations the run contradicted.
6. **Predicate** — one committed command runs every track and reports an honest `complete` flag. A skip is not a pass.

A run that disagrees with the prediction is the finding: correct the prediction in place and say so.

## References
`method.md` · *The arrangement of a round* and *Running the predicates*; `graph-flow-v3/plan-round-2.md` is the exemplar; the round’s check belongs to `visflow-gate`.
