# oracles — contract

The oracles package turns oracle atoms into keyed judge questions, thresholds the answers, caches
them, and attaches a deciding span to each non-passing atom.

## Public surface

| Module | Exports | Rule callers rely on |
|---|---|---|
| `oracles` | `askRound`, `OracleStore`, `applyThreshold`, `memoryOracleCache`, `sentenceSpans`, `sectionSpan` | one keyed batch per document; a question id matches its evidence key |
| `judge` | `productionBackend`, `PolicyViolationError` | the JEV backend; a missing key is BLOCKED, never faked |
| `cache` | `fileOracleCache` | a per-atom cache under `.doc-verify-cache/`, keyed by (model, question, labels, evidence hash, policy) |

A follow-up span question is asked only for a non-passing atom, is cached like any atom, and a
real follow-up call is a `RequestRecord`.
