# failure-pattern-library

A skill for capturing and consulting process and communication failures, kept as raw material for
continuous improvement of docs, prompts, skills, and project setup.

## What is here

| file | what it holds |
|---|---|
| `SKILL.md` | the entry point: capture, consult, and the path rule that governs both |
| `references/criteria.md` | the admission and classification criteria |
| `references/entry-template.md` | the fields an entry carries — **the half that makes a criterion evaluable** |
| `tests/l0.py` | the lint: the criteria list and the template must agree |
| `tests/seeded-defects.md` | nine seeded defects, each flipping a clause of its own |

## The property the lint enforces

A criterion with no field behind it cannot be evaluated. This was measured, not assumed: two criteria
proposed for a live library of 109 entries included one — *"more than two failed attempts"* — that
**no entry could satisfy**, because the template had no field for an attempt count
(`10` entries mention "attempt"; **`0` record a number**).

So `tests/l0.py` checks the two files against each other, and `tests/seeded-defects.md` records the seed
that flips each clause.

## Running it

```bash
uv run --with pyyaml python tests/l0.py     # exit 0 = clean, 1 = a defect
```

The repository's `skill-l0` hook runs this automatically on any edit under `skills/`.
