# `core.present/3` — the committed mutations

Each mutation below must REDDEN the named tests and nothing else. Apply one at a time, run
`npx vitest run doc-verify/tests/language/present.test.ts`, then restore. The point is that every
guard is load-bearing: a green suite over a primitive whose bounds are unchecked proves nothing.

| # | mutation (in `doc-verify/src/engine/`) | reddens |
|---|---|---|
| M1 | `evaluate.ts`: delete the `if (presentIds.length === 0) { return; }` block | "reports a deterministic missing-coverage failure…" (the combined constraint answers `holds` over `[]`) |
| M2 | `evaluate.ts`: in `sectionIdsInOrder`, drop the `.sort((a, b) => a.order - b.order)` | "binds the present members in document order…" |
| M3 | `evaluate.ts`: in the `present` case, use `listed` instead of `sections.filter(...)` for `presentIds` | "omits a missing candidate rather than failing to bind" |
| M4 | `checker.ts`: delete the duplicate-candidate loop | "refuses a duplicate candidate" |
| M5 | `checker.ts`: delete the `listItems(candidates) === undefined` refusal | "refuses a non-list candidate argument" |
| M6 | `checker.ts`: delete the empty-list refusal | "refuses an empty candidate list" |
| M7 | `checker.ts`: delete the non-atom refusal | "refuses a non-atom candidate" |
| M9 | `checker.ts`: in `checkSafety` case `"present"`, stop adding `literal.present.name` to `bound` | every case (the oracle input is refused as unsafe) |

## M8 is deliberately NOT a mutation, and here is why

An earlier draft of this change also made `unionEvidence` return `undefined` for an empty list (so
"no sections" could never be asked about). Mutation-testing it showed the change is **not
load-bearing for this primitive**: the evaluator's zero-present guard returns first, so removing the
`unionEvidence` change reddened nothing. It was removed rather than shipped as unverified code.

**It is a real adjacent hole, and it is not this card's.** A module that writes
`core.union(D, [])` *directly* — with no `core.present/3` in the path — still asks the judge a
question over empty evidence and receives a fabricated label. That is a `core.union` validation
question in its own right (the smallest fix is a static refusal in `checker.ts`'s evidence-shape
pass, next to the union arity rule), and it should be carded separately rather than folded in here.
