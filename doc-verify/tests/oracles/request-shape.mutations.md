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

M1 is the mutation the task names. M2 bounds it from the other side: a guard that only reddens when
the feature is removed could still have changed every other consumer's behaviour by flip-flopping the
default, and M2 is what proves the default is still `batched`. M3 pins the third requirement of the
ruling — an unknown value must be refused at schema load rather than silently read as legacy.

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
compose.ts         accdce71a2439c635de4d99f969293c6ab544d419827d2a62e7d6ad41e3cd02d
checker.ts         331f6c8ce7630724aaf95c498f3eee7d41af77a31207b069c1d4fb26a2edd73c
index.ts           1050fd57a76dbd37429ae257ff4708e0ac53b2d709cf9fbef526d721c1f8da90
request-shape.test.ts  a90d5ed78c656cc67de82d856fd6392a60853f537a73e11edcf2939c831b0c0a
```
