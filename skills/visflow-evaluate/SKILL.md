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
   (`visflow-dispatch`). Three seats is the common shape; the count is a decision, recorded. One cited
   exemplar breaks this rule and says so itself: `loop-surface/evaluate/interrogation-1.md` seats a model
   whose defects had already landed inside the range under review, mitigated only by *"reported before the
   panel opened"*. The rule stands; the exemplar is not a licence.
3. **Hand one instrument to every seat.** The prompt is a **file, not an improvisation**:
   `worklog/prompts/prompt-eval-{topic}-{date}.md`, read-only, naming the spine and the review set, with a
   fixed report shape - severity per finding, a capped finding count, and the next experiments ranked.
   Read-only: an evaluator that edits the artifact has destroyed its own instrument. **This rule is newer
   than every exemplar cited below**: the three committed prompts were recovered from `/tmp` on 2026-09-19,
   so no earlier evaluation satisfies it - the rule is a change in practice, not a description of it.
4. **Pool under a consensus rule.** Agreement across seats is the verdict. **A factual disagreement is
   reproduced by the lead, not voted on** - the lead's own check settles what the seats disagree about,
   and both readings are recorded when it cannot. The pooling artifact is an **Agreement Map**: which
   findings arrived *independently* (the strongest signal available), which from one seat only, which the
   lead reproduced, and which it refuted. **Nothing is attributed to a seat that did not report it.**
5. **Disposition every finding** - fixed, or recorded as a canon limitation with this verdict. A verdict
   that changes nothing still binds the next round: what the seats found is the next round's input.
6. **Record.** The verdict is `evaluate/interrogation-N.md`; a round's own verdict is
   `evaluate/round-N.md`. One decision row per landed disposition, and the register row for the round.
   Where the fixes are consequential, follow with a **verification round** recording what they did to the
   findings - a verdict with no follow-up leaves its own dispositions untested.

An evaluation **does not change the artifact**: it records what the seats found and how the lead judged
it. The work it judges owns its own acceptance check.

## The cases this method has been run on

| case | the subject | the evidence, and what it actually is |
|---|---|---|
| **a round's evidence** | does the round honestly establish what it claims - claims backed by runs, gates that can fail, no contradiction with canon or its own record | **the method was run**: `loop-surface/evaluate/interrogation-1.md` (236 lines) - three seats, one prompt each, pooled by a lead. `cycle-obligation/`, `model-boundary/` and `frame-declaration/` carry one each, and **two of the four name no commit range at all** (the `R-SET` item is red on them) |
| **a plan, before the run** | is the hypothesis falsifiable by the named predicate, is the axis the one the hypothesis turns on, is every expectation recorded before the first run, and what does the plan leave unmeasured | **the method was run**: `worklog/parallel-plan-review/` - `plan.md` + `protocol.md`, three seats over three rounds (`kimi-k3`, `glm-5.3`, `-r2`, `-r3`), an adjudication per round; the seats reproduced claims at HEAD instead of reading prose. **This is the cheapest case: it is the only one where the review can still change the outcome** |
| **a design document** | are its claims true of the tree, and is the plan it implies sound | **not this method**: `worklog/architecture-review.md` (720) states its own method as *"read-then-reproduce"*, single author; `worklog/v3-design-review.md` (311) likewise. **The case is unrun** - it is the next experiment, not a precedent |
| **a tree's record** | does the record match the artifacts it ships | **not this method**: `machine-design/review-1.md` (50) is one seat - and that seat designed the pass it reviews. **Unrun** |
| **a unit of work** | the commit range itself, before the round closes | **the back half only**: `taskboard/reviews/evaluation-round-1.md` pools two seats' findings with per-finding dispositions and the lead's re-check - a real Agreement Map. But that loop's briefs **instruct the reviewer to write into the repo**, which the read-only rule forbids. **Not run as specified** |

**This table was corrected by an evaluation of this skill** - three seats, one prompt, pooled and
reproduced by the lead (`worklog/evaluate-skill-1.md`): **three of its five rows cited artifacts that had
not been run by this method at all**, and the "every row has been run at least once" claim it used to carry
was false as written. The round-verdict row was deleted rather than given a manufactured exemplar. Coverage
is the point of the table: a method that has only ever evaluated rounds has not been tested on a
design document, whose claims are about a tree rather than about a run.

## References

`method.md` · *The practices* (the adversarial-review row and its evidence), *Delegating work, and reusing a
child*; `worklog/prompts/` for the instrument and its naming convention; `pstack` · `interrogate` for the
multi-model mechanism this method uses but does not own.
