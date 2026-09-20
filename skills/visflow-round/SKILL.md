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
4. **Pre-register** — record the outcome expected of each candidate **before the first run**. A prediction written after the measurement is a regression gate, not a prediction. **Before the run, an independent seat reads the plan against the hypothesis** — is the hypothesis falsifiable by the named predicate, is the axis the one it turns on, is every expectation recorded first, what does the plan leave unmeasured — and the plan and its review are committed together. `worklog/parallel-plan-review/` (a plan, a protocol, three seats, an adjudication per round) is the worked instance; a plan no predicate can falsify is cheaper to fix before the run than after it.
5. **Run**, then **evaluate**: what measured, which candidate the measurement selects, what it leaves unmeasured, which expectations the run contradicted.
6. **Predicate** — the committed commands this round runs (the corpus predicate, then its suite), each reporting an honest `complete` flag; one command per track, not one for all of them. A skip is not a pass.

A run that disagrees with the prediction is the finding: correct the prediction in place and say so.

## The arrangement of a round (the full protocol)

*Moved here from `method.md` when that file became a manifest (2026-09-19).*

The stages above have an order, and it is the order a round is *designed* in, not only the order its files
are written in:

    hypothesis   what is claimed, in one sentence, with the cell that would refute it
    axis         the one dimension the candidates differ along, chosen because the hypothesis
                 turns on it -- not a list of everything that might vary
    candidates   two or three designs, one per point on the axis, each with the outcome expected
                 of it recorded *before* the first run
    evaluation   what the runs measured, which candidate the measurement selects, what it leaves
                 unmeasured, and which expectations the run contradicted

*(pstack: `principle-exhaust-the-design-space` -- the axis-and-candidates shape is "design it
twice" stated as a method: two or three genuine alternatives recorded before the run, never a
second flavour of the first shape; and `principle-test-behavior-not-implementation` -- the
evaluation reads the runs the way a user would, not the internals.)*

**The expectation is recorded before the run, and a run that disagrees is the finding.** A table written
from the measurements is a regression gate; a regression gate says nothing about whether the design
predicted anything. A round carries both and says which is which.

What proves it here: `cycle-obligation/grounding.md` (the claims under test, each with what would
falsify it, written before the plan), `graph-flow-v3/plan-round-2.md` ("The three falsifiers", then
the design decisions taken *before* each falsifier), `loop-surface/evaluate/round-1.md` (per-variant
verdicts, and the recorded selection that followed them). `use-cases/README.md` applies the same
order to one case at a time, where the candidates are the case's rival spellings.

## References
`method.md` · *The arrangement of a round* and *Running the predicates*; `graph-flow-v3/plan-round-2.md` is the exemplar; the round’s check belongs to `visflow-gate`.
