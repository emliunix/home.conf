# language — contract

The language package parses a verification module, composes its `extends`, derives a document's
facts, and evaluates the constraints under the two-bound semantics into an engine report.

## Public surface

| Module | Exports | Rule callers rely on |
|---|---|---|
| `module` | `loadModule`, `ModuleError` | a module is `schema_version: 2`, `kind: verification-module`, a `module` name, and `oracles` / `rules` / `constraints` |
| `compose` | `composeModules`, `engineLibraries` | `extends` composes parents; `doc-verify:NAME` resolves a shipped library, an unknown one is refused |
| `facts` | `documentFacts`, `DocumentFacts` | `section/3`, `heading/3`, `depth/3`, `order/3`, `meta/3`, `selected/2`, `ref/4`, `resolves/2`, and derived `child/3`, `descendant/3`, `nests/3`, `dangling/4` |
| `evaluate` | `evaluate` | two bounds: an unknown oracle reads false in the certain bound and true in the possible bound |
| `index` | `runProgram`, `compileModule` | returns the engine report: constraints, oracles, findings, verdict |
