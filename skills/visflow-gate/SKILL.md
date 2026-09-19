---
name: visflow-gate
description: >-
  Project specific method on gates as evidence in visflow: one command, honest complete flag,
  red/green mutation testing, fixture census, golden conformance, blast radius proven by
  running. Use in visflow when a check does not exist yet or is about to be trusted and no
  seeded defect has flipped it; not when the suite already runs green, when the task is to
  re-run a check that already exists, or when there is no defect the check must catch.
---

# Gates

A gate counts only when a **seeded defect makes it fail**. For every check, in order:

1. **Name the claim** the check exists for, in one line.
2. **One command per track** — a single committed entry point with an honest `complete` flag; a skip is not a pass.
3. **Two-directional** — green on the known-good fixture, red on a seeded defect of exactly its clause. A cell that cannot go red is not a cell; a cell whose seeded defect is "none" is a property claim and must say so.
4. **Name the fixture class** — every cell names the class it exercises, and a class with no fixture turns the census cell red.
5. **Fixtures live with the tests**; the curated artifact directory is read-only to gates.
6. **Prove the isolation fact by running code** (blast radius), not by argument.

A claim that lives only in a probe is decoration: re-home it into a named layer’s cell and delete the probe.

## References
`method.md` · *The practices* and *Running the predicates*; `graph-flow-v3/verification.md` + `mutations.md` (the sharpest example); `taskboard-v3/evaluation.md` (the layer rubric).
