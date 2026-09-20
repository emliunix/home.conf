---
name: visflow-records
description: >-
  Project specific method on convention over configuration for visflow records: enumerate by
  naming, commits beat the manifest, generated indexes, pinned counts, one decision row (ADR)
  per landed unit. Use in visflow when finding what a programme has run, or adding a record to
  one; not when the task is to trust the manifest, or to hand-write a page a script generates.
---

# Records

**Read a record**: enumerate by naming convention with `ls` (a round’s verdict is `evaluate/round-N.md`, the gate ledger is `verification.md` + `mutations.md`, decisions are `decisions.tsv`), then check the set against the commits. The manifest is a convenience; the commits win, and a mismatch is itself a finding to record.

**Add a record** — four steps, in order:
1. create the file (named by convention, not by invention);
2. append its row to the programme’s index;
3. regenerate anything generated, in the same commit as the evidence it reads;
4. hand-edit the counts a test pins.

**Decision rows**: one row per landed unit — timestamp, decision, why, evidence, result.

## Worklog names (2026-09-19)

`worklog/` is the layer a reader enumerates *before* any programme, so its names carry a convention too:

- **A new record** is `worklog/{YYYY-MM-DD}-{slug}.md` — the date is the day the record's subject was
  fixed, and a frontmatter `created:` must agree with it.
- **Living documents keep stable names**, because canon and the spine point at them: `next.md` (named by
  the canon frontmatters as their open list), `experiment-manifest.md`, `experiments-and-lessons.md`,
  `project-understanding.md`, `pstack-decision-log.tsv`. Adding a name to this list is a deliberate act,
  recorded in a decision row.
- **A round home is a directory** named for the topic (`dryrun-walk/`, `canon-check/`,
  `parallel-plan-review/`); files inside are named for their role — `{seat}-r{n}.md` (the round number
  belongs in the name: three rounds over the same seats otherwise collide on a bare `{seat}.md`, and
  `parallel-plan-review/` shows the drift — `kimi-k3.md` for round 1 beside `kimi-k3-r2.md` and
  `kimi-k3-r3.md`; the bare first-round names predate this and keep theirs, as forward-only requires),
  `round-{n}-adjudication.md` — not dated, because the round's own record carries the dates.
- **Forward-only.** The 38 top-level files created before 2026-09-19 keep their names: they used 38
  different names, and renaming them would break citations across the repository for no gain. The
  grandfather list lives in the checker, not in a document that would drift from it.
- **The check** is `python3 worklog/tools/check_names.py`: non-zero when a top-level `worklog/` file is
  neither dated nor on the living-or-grandfathered list, or when a dated name disagrees with its
  `created:`. A rule with no check is speculation — this one included.

## Enumerating an experiment's record (the full protocol)

*Moved here from `method.md` when that file became a manifest (2026-09-19).*

There is no central manifest to trust, and there does not need to be one: every programme names its
records by convention, so a reader can enumerate the set with `ls` and then check it against the
commits. **The convention is the contract; `worklog/experiment-manifest.md` is only a convenience.**

| Record | Convention | Example |
|---|---|---|
| A round's verdict | `evaluate/round-N.md`, one per round | `graph-flow-v3/evaluate/round-2.md` |
| A per-question evaluation | `evaluate/<question>.md` | `graph-flow-v3/evaluate/f2-retry.md` |
| The arrangement of a round | `plan-round-N.md` (or `plan.md`) | `graph-flow-v3/plan-round-2.md` |
| The gate ledger | `verification.md` plus `mutations.md`, one row per gate with the defect that breaks it | `graph-flow-v3/mutations.md` |
| A probe's raw output | `results/<probe>.json`, named for the probe that wrote it | `temporal/race_probe.py` -> `results/race-probe.json` |
| The aggregate | `results/measurements.json` and `baseline-trace.json` | written by the CLI's `run` |
| A corpus | `corpus/<fixture>.<axis>.flow.md` plus `corpus/expected.tsv` | `loop-surface/corpus/undeclared-cycle.v1.flow.md` |
| The ground stage | `grounding.md` | `catch-surface/grounding.md` |
| A stream's verdict | **every experiment gets one**, named for the round or the question. `research/` ran without one until `research/evaluate-round-1.md`, and graph-flow-v3 round 3 until `evaluate/round-3.md`; readers noticed both, not us |
| The decisions | `decisions.tsv`, one row per landed unit | `loop-surface/decisions.tsv` |

**A list collected this way can be wrong, and saying so is part of using it.** Known mismatch
classes, each of which has already happened here:

- **A round with no verdict file.** `graph-flow-v3` round 3 produced four `f2-*` evaluations and a
  decision row but no `evaluate/round-3.md`; enumerating by convention finds the parts and not the
  whole, so the round's verdict has to be read across its files.
- **A result file older than the fix it is cited for.** A `results/*.json` is a run, not a property.
  Check its date against `git log` for the change it supports before citing it.
- **A hand-maintained page that looks generated.** `graph-flow-v3/mutations.md` has no generator
  (the v2 trees do: `a/harness/mutations.py`, `b/gen_mutations.py`); `loop-surface/corpus.md`
  does, and it was still one edit stale when a reader checked it. Regenerate a generated page in the
  same commit as the evidence it reads.
- **An index that lags.** The manifest had two stale cells within a day of being written, which is why
  it is a convenience and not the contract.

When the list you collected and the commits disagree, **the commits win**, and the disagreement is
itself a finding: record it rather than reconciling it silently.

## References
`method.md` · *Enumerating an experiment’s record* and *Extending a programme’s record*; `loop-surface/README.md` is the worked procedure.
