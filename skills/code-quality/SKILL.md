---
name: code-quality
description: >-
  Use for current-model / era-reachability gates, suite discipline, or when a
  local identity is packed into a string (startsWith, slice, colon-join, `${a}:${b}`),
  a local choice is a string-union prop, a tagged union is dispatched with if-else,
  caught errors are hidden or generalized, or cross-module failures lose attribution
  or detail. Not for schema/wire enums, user-facing copy, HTTP status/error codes,
  or other architectural string contracts the project has named as wire.
---

# Code quality

Standing quality law. Distinct from flow procedure (`flow-grill-review` / `flow-retro`). Project P0 current-model law, when legislated, lives in that repo's `AGENTS.md` and is the first check; this skill is the reusable quality machinery.

## Standing gates

Quality checks, not flow procedure. Lifecycle lives in `flow-grill-review` / `flow-retro`.

- **Current-model P0 (ALWAYS top-1 of every review when the project has legislated it):** any second-world assumption, epoch vocabulary, compat arm, or ledger/history-predicated shape selection in code/comments/fixtures/tests/docs vocabulary stops the review before all else; shape checks are positive signature-match-else-refuse only; dual-world support is a violation at birth (temporary included). Semantics count, not just words — era-reachability test on every branch/variant/optional/nullable/tolerant-parse (if only a past era can produce the input, the arm is compat; rename cannot launder); struct classes incl. old-obligate dual arms, history-only optional plumbing, alias exports, tolerant parses of retired payloads, 2-impl abstractions with one dead era = P0 reject. If the project has no P0 contract, skip this bullet.
- **Positive-only boot:** live code and live data stand on current architecture. No compat shim, legacy arm, special-case, or carried old-era data at boot.
- **Suite discipline:** the project's named suites (typecheck + tests) green per slice, every time. A red tree wedges the workstream.
- **Finalize evidence:** a close is not quality-green without grep/diff/read evidence of epoch-vocabulary-zero (when P0 applies), positive-only boot, era-reachability struct classes, and green suites. Gate receipts are prerequisites, never that evidence. Report-acceptance does not discharge.

## Local-type

Standing law for local (file/module) identity.

### Three principles

1. **Type-encode.** A local value is a typed struct, enum, or discriminator. Do not pack it into a string and parse it later (`focus.startsWith("env:")`, `slice`, `Number(...)`, colon-joined tuples).
2. **Match, do not if-else.** Dispatch those encodings with an exhaustive `switch` / `match` on the discriminator. Nested `kind === A ? … : kind === B ? …` is if-else on the encoding.
3. **Local vs architectural.** Local-scope string encodings are replaceable. Architectural / global wire encodings stay strings: schema enums, operator copy, HTTP/error codes, and any discriminator the project's API contract names as wire. Match those exhaustively at the owning boundary; do not invent a local enum that shadows them.

## Error-fidelity

Standing law for local (file/module) error fidelity.

### Three principles

1. **Pure code returns typed failure.** A pure function represents expected failure with a `Result<T, E>`, `Either<E, T>`, or equivalent tagged union whose error arms are typed and exhaustively matched. It does not throw, return a neutral fallback, or erase the failure into `null` / `undefined` / `None` when the caller must distinguish the cause.
2. **Effectful code logs and rethrows.** When effectful code or a module catches an exception that it cannot completely and intentionally resolve, it immediately emits one structured `warn` / `error` record with the failure class and operation context, then rethrows the same error or a typed wrapper with `cause`. Catch-and-forget, log-and-return-success, and replacement with a generic error that drops the cause are forbidden.
3. **Cross-module APIs preserve attribution and detail.** An API or module boundary exposes a well-defined error discriminator carrying (a) the causal/operational attribution, such as HTTP transport, command failure, remote API error, or file absence, and (b) the caught detail, passed through in-process or serialized explicitly at the wire. Serialization must retain the useful causal chain while redacting secrets, raw headers, credentials, and unsafe upstream payloads. A generic message may accompany this structure; it may not replace it.

### Error-boundary decisions

- A failure fully handled by deliberate recovery is not rethrown; the recovery outcome itself must be typed and test-pinned. A default value is recovery only when the contract explicitly defines it as such.
- Logging occurs before rethrow or refusal. Do not rely on an outer layer eventually logging an error whose local operation context would be lost.
- Architectural wire discriminators remain wire strings. Match them exhaustively at the owning boundary; do not shadow them with a local enum.
- Public responses may be less detailed than internal errors for safety, but the structured internal error and log retain the safe causal detail. Redaction is not permission to collapse the failure class.

## Presence vs map

- **Presence predicate** (`phase.kind === "loading"` to disable or mount) matches one arm. Keep.
- **Per-arm map** (kind → copy or JSX / renderer) uses exhaustive `switch` / `match`. Convert.
- Shape checks, display joins, and dialect text written onto the wire are not encodings of program state. Keep.
- Catalog/default fallbacks named as architectural wire are not this law.

## Fail classes

| Class | Example | Act |
|---|---|---|
| packed-string-parse | `"env:${name}"`, `` `${id}:${id}:${path}` `` | CONVERT to a tagged struct |
| string-union-local | `afterMark?: "readyToConnect" \| "currentOn"` | CONVERT to `{ kind: … }` |
| ifelse-on-typed (map) | nested ternary of `kind` to copy/JSX | CONVERT to `switch` / `match` |
| kind-predicate | `disabled={list.kind === "loading"}` | KEEP |
| broken-partial | typed struct exists; leftover pack still live | CONVERT (finish typed path; delete the pack) |
| test-stale | pin greps the old string call site | CONVERT with the producer |
| arch-wire / arch-copy | `error.code === "manifest_missing"` | KEEP |
| pure-error-erased | pure parser returns `null` for several distinct failures | CONVERT to `Result` / `Either` with typed error arms |
| effect-caught-hidden | `catch { return false }` or generic fallback after an effect fails | CONVERT to structured log + rethrow, or a contract-defined typed recovery outcome |
| effect-cause-dropped | `catch (error) { throw new Error("failed") }` | CONVERT to preserve/rethrow `error` or wrap it with `cause` after structured logging |
| boundary-undiscriminated | cross-module API returns only `request_failed` for transport, remote, and file failures | CONVERT to a stable discriminator plus safe causal detail |
| boundary-detail-dropped | discriminator survives but caught detail is neither passed nor safely serialized | CONVERT to an explicit detail/cause carrier and pin |

## Three-pass sweep — strict

Do not mix. A partial conversion already in the tree is a tracked problem, not permission to skip to the fix.

1. **Manifest.** Inventory only. Every local-type hit: id, file:line, encoding, class, why local vs architectural. Every error hit: pure/effectful/boundary, caught type, log-before-exit state, rethrow/recovery path, discriminator, and detail/cause carrier. Include leftovers and half-finished conversions. No verdict. No edit.
2. **Analysis.** Every row: CONVERT \| KEEP \| OUT OF SCOPE + why. For error rows, state whether the failure is expected pure data, a completely handled recovery, an unhandled effect, or a cross-module contract. No edit. Pass 3 is the CONVERT set and only that set.
3. **Fix.** CONVERT rows only. Then the project's typecheck + the module's pins. Pins cover each typed error arm, structured log before rethrow/refusal, boundary discriminator, and safe causal-detail preservation. Stale greps retarget with the producer.

Receipt names the three passes actually run. Missing names stop.

## Seed fail → typed

```ts
// fail: local identity packed in a string
if (focus.startsWith("env:")) {
  const name = focus.slice("env:".length);
}

// pass: tagged union, matched
type Focus = { kind: "env"; name: string } | { kind: "argv"; index: number };
switch (focus.kind) {
  case "env": /* focus.name */ break;
  case "argv": /* focus.index */ break;
}
```

`sameFocus` switches on `a.kind` and compares `b` on the same arm (a `kind !==` guard does not narrow both). Same law in rust: `enum` + `match`, not `starts_with` + `split`.

## Red flags — STOP, return to the current pass

- "I'll convert as I inventory"
- "The working tree already started — just finish"
- "The wire code / copy key is if-else too"
- Nested ternary "is already matching the union"
- Inventing a local enum that shadows a wire string
- "The caller only needs to know it failed"
- "The outer layer will probably log it"
- "Returning false/null is simpler than carrying the error"
- "Security means we must drop every detail"

**All of these mean: you mixed a pass, erased a failure, or expanded past the owning boundary. Stop. Record the row. Do not edit until pass 3 names it CONVERT.**
