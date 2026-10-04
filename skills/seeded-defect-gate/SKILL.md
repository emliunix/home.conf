---
name: seeded-defect-gate
description: >-
  Gates as evidence: a check counts only when a seeded defect flips it - the claim named first, one
  command per track with an honest complete flag, red/green on a defect of exactly its clause, a fixture
  census, blast radius proven by running. Use when a check does not exist yet or is about to be trusted
  and no seeded defect has flipped it; not when the suite already runs green, when the task is to re-run
  a check that already exists, or when there is no defect the check must catch.
---

# Gates

A gate counts only when a **seeded defect makes it fail**. For every check, in order:

1. **Name the claim** the check exists for, in one line. A check whose claim cannot be stated is a probe.
2. **One command per track** — a single committed entry point with an honest `complete` flag; a skip is not a pass.
3. **Two-directional** — green on the known-good fixture, red on a seeded defect of exactly its clause, then green again when the defect is restored. A cell that cannot go red is not a cell; a cell whose seeded defect is "none" is a property claim and must say so.
4. **Name the fixture class** — every cell names the class it exercises, and a class with no fixture turns the census cell red.
5. **Fixtures live with the tests**; the curated artifact directory is read-only to gates.
6. **Prove the isolation fact by running code** (blast radius), not by argument.

A claim that lives only in a probe is decoration: re-home it into a named layer's cell and delete the probe. If a gate flips for a reason other than its seeded defect, that is a new finding (see `finding-triage`), not a pass.

Which boundary a check exercises, and the evidence level it can therefore support, belongs to `verification`; this skill owns whether the check can fail at all.

## Worked instances (visflow)

- The sharpest ledger pairs a verification document with a mutations table: one row per gate, each with the defect that breaks it (`graph-flow-v3/verification.md` + `mutations.md`). A layer rubric names which layer each cell belongs to (`taskboard-v3/evaluation.md`).
- That mutations table is hand-maintained while two sibling trees generate theirs: the "hand-maintained page that looks generated" class that `record-conventions` lists among its mismatches.

## Project binding

The repository's AGENTS.md (or its equivalent) names the concrete files this skill refers to by role: the committed entry point per track, the gate ledger and its mutation table, the fixture directories, the curated artifact directory gates may not write, and the method document's section on running the predicates, where it has one. Where one of these roles has no file, that absence is a finding to record, not a reason to invent one.
