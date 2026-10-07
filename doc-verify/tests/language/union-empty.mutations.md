# `core.union` over an empty section list — the committed mutations

Task #191. Each mutation below must REDDEN the named tests and nothing else. Apply one at a time,
run `npx vitest run doc-verify/tests/language/union-empty.test.ts`, then restore. The point is that
the guard is load-bearing: a green suite over a refusal whose bounds are unchecked proves nothing.

The refusal is one block in `doc-verify/src/engine/checker.ts`, at the tail of `resolveLiteral`,
after the arity check. It reads the argument index that the oracle's `union` evidence form consumes
(via the `oracleUnionArgs` map) and refuses a literal empty list there. `resolveLiteral` is the
single funnel through which every call site resolves — a rule body, a negation, a `count` body, a
constraint `forall`, a constraint `require` — so one guard covers all of them, measured.

| # | mutation (in `doc-verify/src/engine/checker.ts`) | observed reddens |
|---|---|---|
| M1 | delete the `unionArg` refusal block | **2 tests** — "refuses a literal empty list at the call site and makes ZERO judge requests" and "refuses the same empty list from every call site" |
| M2 | drop the emptiness test: `if (listed !== undefined)` — refuse **any** literal list at the union's sections argument | **1 test** — "still accepts a non-empty literal list, and binds its evidence" |
| M3 | drop the argument-index scoping: test *every* argument of a union oracle for an empty list instead of `args[unionArg]` | **1 test** — "refuses only the union's OWN section argument, not any empty list an oracle takes" |

M1 is the mutation the task names. M2 and M3 bound the refusal from both sides: M2 shows the guard
cannot pass by forbidding every literal list, and M3 shows it cannot pass by forbidding every empty
list an oracle happens to take. A guard that reddens only under M1 could be scoped wrongly in either
direction and still look green.

## Byte-exactness

`checker.ts` before M1, after each mutation, and after every restore:

```
20be2970d1096ebeceea4dfc40068f917ddfc545
```

Every restore was verified with `git hash-object doc-verify/src/engine/checker.ts` against that blob,
not by `git status` — a dirty-tree check does not witness the bytes.

## Scope, deliberately unchanged

`core.present/3`'s semantics are untouched: the present primitive binds `P` to a **variable**, and
the guard fires only on a literal list at the union's sections argument, so the #190 route is not
reached. That is pinned by the "still accepts a variable list" case, which reddens if the guard
reaches through the variable. The declaration-shape check in `checkOracleHead` is also untouched —
`evidence: core.union(D, [])` written in the *declaration* was already refused there before this
change, because the union shape requires the list argument to be a variable over the oracle's inputs.
