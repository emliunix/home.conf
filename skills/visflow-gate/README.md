# visflow-gate — design philosophy and dimensions

**What it is.** The method for gates in visflow: a gate counts only when a **seeded defect makes it fail**. `SKILL.md` is the artifact; this package is its instrument (`flow-skills-eval/design/03-skill-package-format.md`).

## Philosophy

1. **A gate that cannot go red is not a gate.** Every cell pairs a green run on the known-good fixture with a red run on a defect of exactly its clause. A cell whose seeded defect is "none" is a **property claim** and must say so.
2. **The claim comes first.** A check exists for a named claim, in one line; a check whose claim cannot be stated is a probe, and a probe is decoration.
3. **Honesty is a flag, not a hope.** One committed entry point with a `complete` flag; **a skip is not a pass**.
4. **Isolation is proven by running code**, never by argument.
5. **Fixtures live with the tests**; the curated artifact directory is read-only to gates.

## Dimensions

| dimension | the question | how it is measured |
|---|---|---|
| **trigger** | does the entry surface fire on gate-shaped work, and stay silent on the excluded shapes? | trigger pass over `tests/cases/trigger.yaml` triplets |
| **procedure** | does an agent produce the six steps in order? | entry-only vs full arm on the same request; the record is checked for the claim line, the single entry point, the red/green pair, the fixture class, the isolation run |
| **production** | does the gate the agent builds actually catch the seeded defect? | the acceptance check *is* a mutation test: seed a defect of the clause, require red, restore, require green |
| **ablation** | does each body step earn its place? | full vs full-minus-one-step on the same request |

Rubrics per dimension, each item naming the defect that must flip it, are in `tests/rubric.yaml`.

## What it refuses

Gates that only ever ran green; a suite whose "pass" is a compile; hand-kept fixture tables; isolation argued rather than run. A gate whose claim cannot be stated in one line is not this skill\u2019s work.
