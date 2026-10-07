---
name: adversarial-evaluate
description: >-
  Multi-seat adversarial evaluation of work: a fixed review set derived from the commit range,
  independent seats chosen for model diversity rather than assigned personas, one read-only prompt file
  for every seat, findings pooled under a consensus rule with factual disagreements reproduced by the
  lead, every finding dispositioned, the verdict recorded. Use when a round, a plan before its run, a
  design or a unit of work needs an adversarial verdict before anything is trusted; not for reviewing
  prose or style, and not for one evaluator's impression presented as a consensus.
---

# Evaluate work adversarially

An evaluation is a **measurement with several instruments**: independent seats, one shared prompt, a
pooled verdict. The adversarial signal is **model diversity, not assigned personas** — every seat receives
the same prompt, the same change set and the same rubric.

1. **Name the subject and the review set.** The subject is the round, the plan, the design or the unit
   under evaluation. The **review set is the commits since the previous evaluation, derived from the range
   itself** — if that pass was untagged, say which range you took and why. Never evaluate a moving tree:
   the set is fixed before the first seat reads.
2. **Roster the seats.** Independent seats, routed per role from the project's model-route table, if it
   has one; **the author is never a seat**, and neither is a model whose own defects landed inside the
   range under review. Reuse the child that evaluated the same subject before rather than minting a fresh
   one (see `subagent-dispatch`). Three seats is the common shape; the count is a decision, and it is recorded.
3. **Hand one instrument to every seat.** The prompt is a **committed file, not an improvisation** —
   one per evaluation, named for its topic and date, read-only, naming the spine and the review set, with
   a fixed report shape: severity per finding, a capped finding count, and the next experiments ranked.
   Read-only: an evaluator that edits the artifact has destroyed its own instrument.
4. **Pool under a consensus rule.** Agreement across seats is the verdict. **A factual disagreement is
   reproduced by the lead, not voted on** — the lead's own check settles what the seats disagree about,
   and both readings are recorded when it cannot. The pooling artifact is an **Agreement Map**: which
   findings arrived *independently* (the strongest signal available), which from one seat only, which the
   lead reproduced, and which it refuted. **Nothing is attributed to a seat that did not report it.**
5. **Disposition every finding** — fixed, or recorded as a known limitation with this verdict (see
   `finding-triage`). A verdict that changes nothing still binds the next round: what the seats found is the
   next round's input.
6. **Record.** The verdict is an evaluating file named by the programme's convention (see `record-conventions`),
   with the commit range it evaluated, how the lead judged the pooled findings, and the next experiments
   ranked with the falsifiers first. One decision row per landed disposition. Where the fixes are
   consequential, follow with a **verification round** recording what they did to the findings — a
   verdict with no follow-up leaves its own dispositions untested.

An evaluation **does not change the artifact**: it records what the seats found and how the lead judged
it. The work it judges owns its own acceptance check.

## The cases this method covers

| case | the subject |
|---|---|
| **a plan, before the run** | is the hypothesis falsifiable by the named predicate, is the axis the one the hypothesis turns on, is every expectation recorded before the first run, what does the plan leave unmeasured. **The cheapest case: the only one where the review can still change the outcome** (see `experiment-round`, step 4) |
| **a round's evidence** | does the round honestly establish what it claims — claims backed by runs, gates that can fail, no contradiction with canon or its own record |
| **a design document** | are its claims true of the tree, and is the plan it implies sound |
| **a tree's record** | does the record match the artifacts it ships |
| **a unit of work** | the commit range itself, before the round closes |

Coverage is the point of the table: a method that has only ever evaluated rounds has not been tested on a
design document, whose claims are about a tree rather than about a run. Before citing a past evaluation as
an example of a case, check that it was produced by this method — several seats, one shared instrument, a
pooled verdict — and not by one author reading and reproducing.

## Worked instances (visflow)

- **A round's evidence — run by this method**: `loop-surface/evaluate/interrogation-1.md`, three seats,
  one prompt each, pooled by a lead. It also seated a model whose defects had landed inside the range
  under review, mitigated only by "reported before the panel opened" — the source of step 2's second
  exclusion. Of four interrogation records, two named no commit range at all.
- **A plan before the run — run by this method**: `worklog/parallel-plan-review/`, a plan and a protocol,
  three seats over three rounds, an adjudication per round; the seats reproduced claims at HEAD instead of
  reading prose.
- **A design document, a tree's record — not yet run by this method.** The reviews offered as examples
  were single-author ("read-then-reproduce") or one seat who had designed the pass under review.
- **A unit of work — the back half only**: a two-seat pooling with per-finding dispositions and the lead's
  re-check is a real Agreement Map, but that loop's briefs told the reviewer to write into the repository,
  which step 3 forbids.
- **The read-only, committed-prompt rule is newer than every exemplar above**: the first three committed
  prompts were recovered from a temporary directory, so no earlier evaluation satisfies it.
- **This skill's own cases table was corrected by an evaluation of the skill**: three seats found that three
  of its five rows cited artifacts not produced by this method, and the round-verdict row was deleted rather
  than given a manufactured exemplar.

## Project binding

The repository's AGENTS.md (or its equivalent) names the concrete files this skill refers to by role: the
spine order the prompt names, the prompts directory and its naming convention, the model-route table the
seats are drawn from (if it has one), the evaluating-file convention per programme, the decision-row file,
and the method document's section on adversarial review, where it has one. Where one of these roles has no
file, that absence is a finding to record, not a reason to invent one.
