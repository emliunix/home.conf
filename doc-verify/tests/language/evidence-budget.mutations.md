# evidence-budget mutations (#196)

The mutation table for `evidence-budget.test.ts`. The committed runner is
`evidence-budget.mutations.mjs`; run it with

```
node doc-verify/tests/language/evidence-budget.mutations.mjs
```

⚠ **THIS FILE DESCRIBES A RUNNER THAT IS IN THE TREE.** A table that asserts a harness it does not
commit is prose, not a gate — the #216 review found exactly that twice. The runner is
`doc-verify/tests/language/evidence-budget.mutations.mjs`, it derives the repository root from its
own location, and it exits non-zero unless every row reddens the case its row names.

## What the runner does, and the one thing it refuses

For each row it copies the focused suite's inputs into a scratch tree, applies the single edit,
runs the focused suite with Vitest's **JSON** reporter, and reads **which assertions failed**.

⚠ **"DID ANYTHING FAIL" IS NOT THE QUESTION.** #216 recorded the cost of scoring `RED` on any
non-zero exit: a mutation that reddened an *unrelated* assertion was scored as if it had reddened
the named one, and two rows were silently false. This runner requires the row's own case title
among the failing titles. A run with no readable report is `HARNESS`; an absent anchor is `BROKEN`;
a run that failed elsewhere is `WRONG-CASE`. **None of the three is a pass.**

## The rows

| id | target | edit | the case it must redden |
| --- | --- | --- | --- |
| **M1** | `evidence-budget.test.ts` | `const CAP = 32_000` → `24_000` | *judges a union just under the calibrated cap* |
| **M2** | `src/engine/oracles.ts` | the item-cap comparison (`bytes > oracle.maxBytes`) → `false` | *BLOCKs a union above the calibrated cap…* |
| **M3** | `src/engine/oracles.ts` | the judge-state ceiling (`alone > limit`) → `false` | *keeps the cap BELOW the judge's state ceiling…* |
| **M4** | `evidence-budget.test.ts` | the expected message `above max_bytes 32000` → `16000` | *BLOCKs a union above the calibrated cap…* |

⚠ **M1 MUTATES THE FIXTURE, NOT THE ENGINE, AND THAT IS DELIBERATE.** M2 and M3 show the *engine*
enforces both limits. M1 shows the *under-cap* row is sensitive to the cap's actual **value** rather
than passing for an unrelated reason — the failure mode a bare `toBeUndefined()` assertion invites.
The two directions are different claims; one mutation cannot make both.

⚠ **M4 IS THE REMOVAL-RED'S OWN FALSIFIER.** The case's third row asserts that the *inherited* cap
blocks; M4 inverts the *calibrated* row's expected number, so a suite whose message assertion reads
a constant rather than the engine's output cannot pass both.

## Measured, at the committed tree

```
  RED         M1  judges a union just under the calibrated cap
  RED         M2  BLOCKs a union above the calibrated cap, naming max_bytes rather than the item
  RED         M3  keeps the cap BELOW the judge's state ceiling, so the cap is the binding rule
  RED         M4  BLOCKs a union above the calibrated cap, naming max_bytes rather than the item

4/4 mutations redden the case their row names
```

⚠ **THE FAILURE MESSAGE IS PART OF THE EVIDENCE, NOT DECORATION.** The engine reports the byte count,
the cap, and (when the judge ceiling binds) both the policy budget and the judge's own state budget
(`oracles.ts:313`). A reader who sees a BLOCK can tell *which* limit fired — a cap that blocked while
naming only the item is the defect #196 exists to remove. M2 and M3 are separate rows because those
are two distinct limits and the message must not conflate them.
