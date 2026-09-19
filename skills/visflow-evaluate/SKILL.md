---
name: visflow-evaluate
description: >-
  Project specific method on adversarial evaluation of work in visflow: name the review set from the
  commit range, roster independent seats chosen for model diversity rather than assigned personas,
  hand every seat the same read-only prompt and rubric, pool the findings under a consensus rule and
  reproduce any factual disagreement, disposition every finding, and record the verdict in
  evaluate/interrogation-N.md. Use in visflow when a round, a design or a unit of work needs an
  adversarial verdict before anything is trusted; not for reviewing prose or style, and not for one
  evaluator's impression presented as a consensus.
---

# Evaluate work adversarially

An evaluation is a **measurement with several instruments**: independent seats, one shared prompt, a
pooled verdict. The adversarial signal is **model diversity, not assigned personas** - every seat receives
the same prompt, the same change set and the same rubric.

1. **Name the subject and the review set.** The subject is the round, the design, or the unit under
   evaluation. The **review set is the commits since the previous evaluation, derived from the range
   itself** - if that pass was untagged, say which range you took and why. Never evaluate a moving tree:
   the set is fixed before the first seat reads.
2. **Roster the seats.** Independent seats, route per role from `pstack/pstack-models.md`; the author is
   never a seat. Reuse the child that evaluated the same subject before rather than minting a fresh one
   (`visflow-dispatch`). Three seats is the common shape; the count is a decision, recorded.
3. **Hand one instrument to every seat.** The prompt is a **file, not an improvisation**:
   `worklog/prompts/prompt-eval-{topic}-{date}.md`, read-only, naming the spine and the review set, with a
   fixed report shape - severity per finding, a capped finding count, and the next experiments ranked.
   Read-only: an evaluator that edits the artifact has destroyed its own instrument.
4. **Pool under a consensus rule.** Agreement across seats is the verdict. **A factual disagreement is
   reproduced by the lead, not voted on** - the lead's own check settles what the seats disagree about,
   and both readings are recorded when it cannot.
5. **Disposition every finding** - fixed, or recorded as a canon limitation with this verdict. A verdict
   that changes nothing still binds the next round: what the seats found is the next round's input.
6. **Record.** The verdict is `evaluate/interrogation-N.md`; a round's own verdict is
   `evaluate/round-N.md`. One decision row per landed disposition, and the register row for the round.

An evaluation **does not change the artifact**: it records what the seats found and how the lead judged
it. The work it judges owns its own acceptance check.

## The cases this method has been run on

| case | the subject | worked example |
|---|---|---|
| **a round's evidence** | does the round honestly establish what it claims - claims backed by runs, gates that can fail, no contradiction with canon or its own record | `loop-surface/evaluate/interrogation-1.md` (236 lines); `cycle-obligation/`, `model-boundary/`, `frame-declaration/` each carry one |
| **a design document** | are its claims true of the tree, and is the plan it implies sound | `worklog/architecture-review.md` (720 lines), `worklog/v3-design-review.md` (311) |
| **a tree's record** | does the record match the artifacts it ships | `machine-design/review-1.md` (50) |
| **a unit of work** | the commit range itself, before the round closes | `taskboard/reviews/brief-claude-round*.md` |
| **a round's own verdict** | the round stating what it settled, and what stayed unmeasured | `*/evaluate/round-N.md` |

Coverage is the point of the table: a method that has only ever evaluated rounds has not been tested on a
design document, whose claims are about a tree rather than about a run.

## References

`method.md` · *The practices* (the adversarial-review row and its evidence), *Delegating work, and reusing a
child*; `worklog/prompts/` for the instrument and its naming convention; `pstack` · `interrogate` for the
multi-model mechanism this method uses but does not own.
