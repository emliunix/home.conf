# `core.present/3` — the committed mutations

Each mutation below must REDDEN the named tests and nothing else. Apply one at a time, run
`npx vitest run doc-verify/tests/language/present.test.ts`, then restore. The point is that every
guard is load-bearing: a green suite over a primitive whose bounds are unchecked proves nothing.

| # | mutation (in `doc-verify/src/engine/`) | observed reddens |
|---|---|---|
| M1 | `evaluate.ts`: delete the `if (presentIds.length === 0) { return; }` block | **2 tests** — "reports a deterministic missing-coverage failure…" and "is bounded to the named document…" |
| M2 | `evaluate.ts`: replace `sections.filter((id) => wanted.has(id))` with `listed.map((c) => termText(c)).filter((id) => sections.includes(id))` — candidate order among the present members | **1 test** — "binds Present in DOCUMENT order even when the candidate list is reversed" |
| M3 | `evaluate.ts`: replace `sections.filter(...)` with `listed.map((c) => termText(c))` — the candidate list itself, absent members included | **7 tests** — the present-set, order, one-oracle, zero-present, bounded-length and one-document cases |
| M4 | `checker.ts`: skip the duplicate-candidate scan | **1 test** — "refuses a duplicate candidate" |
| M5 | `checker.ts`: accept a non-list `Candidates` (`listItems(candidates) ?? []`) | **1 test** — "refuses a non-list candidate argument" |
| M6 | `checker.ts`: delete the empty-list refusal | **1 test** — "refuses an empty candidate list" |
| M7 | `checker.ts`: delete the non-atom refusal | **1 test** — "refuses a non-atom candidate" |
| M9 | `checker.ts`: in `checkSafety` case `"present"`, stop adding `literal.present.name` to `bound` | **7 tests** — every binding case is refused as unsafe |


## Two things deliberately NOT mutations, and why

An earlier draft of this change also made `unionEvidence` return `undefined` for an empty list (so
"no sections" could never be asked about). Mutation-testing it showed the change is **not
load-bearing for this primitive**: the evaluator's zero-present guard returns first, so removing the
`unionEvidence` change reddened nothing. It was removed rather than shipped as unverified code.

**And the order sort is not one either.** Dropping `ordered.sort((a, b) => a.order - b.order)` from
`sectionIdsInOrder` reddens **nothing**: the helper reads `core::order` facts, which are emitted in
document order, so the sort is defensive rather than load-bearing. It is kept because the invariant
belongs to `core::order` and the sort states it where a reader looks for it — but the tests that pin
document order are M2 and M3, and their observable is the **bound list in the oracle's atom**, not
`oracle.sections`: `unionEvidence` filters `document.sections`, so it re-orders whatever it is handed
and cannot witness this property at all. (A first version of that test asserted `oracle.sections` and
passed under every mutation, including the wrong-order one.)

**It is a real adjacent hole, and it is not this card's.** A module that writes
`core.union(D, [])` *directly* — with no `core.present/3` in the path — still asks the judge a
question over empty evidence and receives a fabricated label. That is a `core.union` validation
question in its own right (the smallest fix is a static refusal in `checker.ts`'s evidence-shape
pass, next to the union arity rule), and it should be carded separately rather than folded in here.
