# selection — contract

The selection package decides which documents a run covers, which verification modules
govern each, and what source the run reads.

## Public surface

| Module | Exports | Rule callers rely on |
|---|---|---|
| `doc-verify/src/config.ts` | `parseConfig`, `parseCompanion`, `documentRuleFor`, `documentTraceFor`, `MIGRATION_HINT` | a rule names a `pattern`, an `artifact_kind`, default `modules` and optional `types:`; a companion names its `document` (`kind`, optional `status`, optional `type`) |
| `doc-verify/src/selection.ts` | `resolveDocumentSelector`, `documentSelectorTrace` | ordered, last match wins; `exclude: true` removes a document |
| `doc-verify/src/snapshot.ts` | `captureSnapshots`, `SnapshotMode`, `MissingBlobError` | a run pins a baseline and a candidate id; the candidate is the staged index, a revision range, the named paths, or the tree; the run checks the diff's affected set, and each checked document reports its `impactPath` from a changed file |
| `doc-verify/src/dependencies.ts` | `observeDocument`, `DependencyIndex`, `inventoryExists` | a check reads the repository only through `DocumentInput` (`exists`, `files`, `readTarget`, `resolveSpec`), with `exists` answered by `inventoryExists`; a read outside it is invisible to the affected set |

The modes are the `check` modes of `docs/modules/report/contract.md` §Command line. A v1
`verification:` rule is refused before anything runs, with `MIGRATION_HINT`.

A new repository read in a check goes through `DocumentInput`, or the affected set misses the
documents it breaks: no check fails, a document is silently left out of the run.
