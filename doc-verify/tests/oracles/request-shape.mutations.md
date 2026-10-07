# `request_shape` — the committed mutations

Task #192. Each mutation must REDDEN the named tests and nothing else. Apply one at a time, run
`npx vitest run doc-verify/tests/oracles/request-shape.test.ts`, then restore. The point is that
the guard is load-bearing: a green suite over a setting whose bounds are unchecked proves nothing.

`request_shape` decides how one round's demanded atoms become judge requests. `batched` is the
shipped behaviour and the default; `per-atom` asks each demanded atom alone, so no answer depends
on which other atoms the document demanded in the same round. The setting is read in
`partitionBatches` (`doc-verify/src/engine/oracles.ts`), declared in `moduleSchema`
(`doc-verify/src/engine/module.ts`), and composed with the `rounds` idiom (`compose.ts`).

| # | mutation | observed reddens |
|---|---|---|
| M1 | `oracles.ts`: delete the `if (input.requestShape === "per-atom") { return prepared.map((entry) => [entry]); }` branch | **2 tests** — "asks one request per demanded atom under `per-atom`" and "labels the same atom by its batch, changing the verdict" |
| M2 | `module.ts`: `request_shape ?? "batched"` → `?? "per-atom"` (the default stops being the shipped behaviour) | **2 tests** — "defaults to batching one document's atoms into a single request" and "labels the same atom by its batch, changing the verdict" |
| M3 | `module.ts`: `request_shape: z.enum(["batched", "per-atom"])` → `z.string()` (an unknown value is silently treated as legacy instead of refused) | **1 test** — "rejects an unknown request_shape at schema load rather than treating it as legacy" |
| M4 | `compose.ts`: delete the `request_shape !== undefined` guard at the composition site (the refusal an operator actually reaches) | **2 tests** — "refuses an unknown value during composition, before the schema can drop it" and "still carries a legitimate value through composition" |

M1 is the mutation the task names. M2 bounds it from the other side: a guard that only reddens when
the feature is removed could still have changed every other consumer's behaviour by flip-flopping the
default, and M2 is what proves the default is still `batched`. M3 pins the third requirement of the
ruling — an unknown value must be refused at schema load rather than silently read as legacy.

**M4 is the correction to my own first object, and it exists because M3 was measuring the wrong
route.** `refuses an unknown value during composition` is the test the first object lacked: `run(moduleYaml)`
hands `runProgram` a module text directly, but the CLI — and therefore every pre-commit hook and
`pnpm check` — reaches the schema through `composeModules`, which rebuilds the module from a known
key list (`MERGED = [params, oracles, rules, constraints]`). `request_shape` is not on that list, so
before this fix an unknown value was **dropped before `.strict()` could see it** and the module
silently fell back to `batched`: measured against the pinned engine, `request_shape: bogus` on
design/121 exited 0 with `PASS`, byte-indistinguishable from `batched`, while `per-atom` was
correctly `PASS` on design/101 and `NO-GO` when batched. The green M3 test proved only that the
schema *would* reject the value on a route the operator never takes. M4 makes the design 04 sentence
("an unknown value is rejected when the module loads") true on the route that loads it.

**The label consequence is a test, not an inference.** The last case is a scripted judge that reads
its own request: the Rationale atom is labelled `problem` when it shares a request with other atoms
and `rationale` when asked alone, modelling the measured design/101 batch-composition effect
(`problem_scope_rationale` answers differently in a 5-question round than it does alone). Under
batching the `error` constraint is violated and the verdict is `NO-GO`; under `per-atom` it is
satisfied and the verdict is `PASS`. So the reddened case is a **verdict change**, which is what the
ruling asked the committed red to prove.

## Byte-exactness

Each file before the mutations, after each mutation, and after every restore:

```
oracles.ts         88f769ef496b5c395b24f1cafb357249a03379d73962b64fcc4b5c3790f40c6a
module.ts          7e955ef8a2bfe70f09be1a80b92119c88e0a6ddd994c7fc1a694b0b5c7b8f727
compose.ts         12091e483da1292cd1d83ed646589b694ac485aeda663b8693115b695ce60fd5
checker.ts         331f6c8ce7630724aaf95c498f3eee7d41af77a31207b069c1d4fb26a2edd73c
index.ts           1050fd57a76dbd37429ae257ff4708e0ac53b2d709cf9fbef526d721c1f8da90
request-shape.test.ts  26e736b458ffb5fb41d77c58088b21aba2605cf3917e4fcb583065c4ed159555
```
