---
name: visflow-orient
description: >-
  Project specific method on spine-first onboarding and precedence in the visflow repository:
  single source of truth, constitution → README → method → the owning design doc, one
  statement per fact. Use in visflow when entering visflow, or when two of its documents
  disagree about what governs; not when the owning document is already named.
---

# Orient in visflow

Read in this order, and do not act on a diff before the owning document is read:

1. `constitution.md` — MUST READ FIRST: the proposition, the commitment, the roots that do work, the falsifiers.
2. `README.md` — the canon status table, the reading order it owns, and the open list pointer.
3. `method.md` — how work is done here (records, rounds, gates, delegation); `method-skills.md` is its activation index.
4. The design document that **owns the claim** (`graph-ir-v3.md` for the IR, `architecture.md` for product rules, `theory.md` for the theory core, `authoring.md` for the surface).
5. `local-env.md` if present — machine-local ports, servers, model routes. Absence is normal.

When two documents disagree, use `method.md`’s precedence order. Verify environment facts empirically; never carry a prior session’s runtime assumptions forward.

## References
`method.md` · *The reading order*; `AGENTS.md` grounding rules.
