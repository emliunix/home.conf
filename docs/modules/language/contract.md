# language — contract

The language package parses a verification module, composes its `extends`, derives a document's
facts, checks the module statically, and runs it: it translates the module and the facts for the
kernel and asks the judge between rounds. What a run computes is defined by the model
(`docs/doc-verify-model.md`); this package hands the kernel its program and returns the engine
report.

## Public surface

| Module | Exports | Rule callers rely on |
|---|---|---|
| `doc-verify/src/engine/module.ts` | `loadModule`, `ModuleError` | a module is `schema_version: 2`, `kind: verification-module`, a `module` name, and `oracles` / `rules` / `constraints` |
| `doc-verify/src/engine/compose.ts` | `composeModules`, `engineLibraries`, `readEngineLibrary` | `extends` composes parents; `doc-verify:NAME` resolves a shipped library, an unknown one is refused |
| `doc-verify/src/engine/facts.ts` | `documentFacts`, `DocumentFacts`, `DocumentInput`, `InventoryQuery`, `CORE_BASE`, `CORE_DERIVED`, `ownEvidence`, `bodyEvidence`, `unionEvidence` | base facts `section/3`, `heading/3`, `depth/3`, `order/3`, `meta/3`, `selected/2`, `ref/4`, `resolves/2`, `section_ref/5`; derived `child/3`, `descendant/3`, `nests/3`, `dangling/4`, `spec_unresolved/4`; a check reads the repository only through `DocumentInput` |
| `doc-verify/src/engine/checker.ts` | `checkModule`, `Program`, `Oracle`, `Constraint`, `Literal` | a predicate that is neither declared, imported nor built in is refused when the module loads, and so is a non-ground negation the kernel cannot lift |
| `doc-verify/src/engine/terms.ts` | `Term`, `readCanonical`, `termText`, `writeTerm`, `quoteAtom` | terms are exchanged in canonical form; identity is by content |
| `doc-verify/src/engine/prolog.ts` | `runPureDml`, `assertRestrictedDml` | module parsing runs in a runtime with no judge or network channel |
| `doc-verify/src/engine/demand.ts` | `Demand`, `oracleAtomKey`, `atomText`, `UNKNOWN` | an oracle atom's key is `module::pred(args)`, the one identity the kernel, the oracles and the cache share |
| `doc-verify/src/engine/index.ts` | `runProgram`, `compileModule`, `EngineReport` | runs rounds until the kernel's demand is empty or the round cap; returns the engine report: constraints, oracles, coverage, findings, verdict |

A run whose coverage is incomplete (an atom never asked or never answered, or a halted kernel) and
whose verdict would otherwise be PASS is BLOCKED, decided by `coverage`.
