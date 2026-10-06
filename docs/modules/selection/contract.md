# selection — contract

The selection package decides which documents a run covers, which verification modules
govern each, and what source the run reads.

## Public surface

| Module | Exports | Rule callers rely on |
|---|---|---|
| `config` | `parseConfig`, `parseCompanion`, `documentRuleFor` | a rule names a `pattern`, an `artifact_kind`, default `modules` and optional `types:`; a companion names its `document` (`kind`, optional `status`, optional `type`) |
| `selection` | `resolveDocumentSelector`, `documentSelectorTrace` | ordered, last match wins; `exclude: true` removes a document |
| `snapshot` | `captureSnapshots`, `SnapshotMode` | a run pins a baseline and a candidate id; the candidate is the staged index, a revision range, the named paths, or the tree |

`doc-verify check` takes exactly one of `--paths FILE...`, `--staged`, `--range A..B`, `--all`.
A bare positional file is `--paths`.
