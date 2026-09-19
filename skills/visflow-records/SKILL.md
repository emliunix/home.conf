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

## References
`method.md` · *Enumerating an experiment’s record* and *Extending a programme’s record*; `loop-surface/README.md` is the worked procedure.
