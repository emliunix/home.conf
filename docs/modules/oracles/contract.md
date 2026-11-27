# oracles — contract

The oracles package turns oracle atoms into keyed judge questions, thresholds the answers, caches
them, and attaches a deciding span to each non-passing atom. It resolves the judge key.

## Public surface

| Module | Exports | Rule callers rely on |
|---|---|---|
| `doc-verify/src/engine/oracles.ts` | `askRound`, `OracleStore`, `applyThreshold`, `memoryOracleCache`, `sentenceSpans`, `sectionSpan`, `OracleCache`, `RequestRecord` | one keyed batch per document; a question id matches its evidence key |
| `doc-verify/src/judge.ts` | `productionBackend`, `PolicyViolationError`, `judgePrerequisiteGap` | the JEV backend; a missing key is BLOCKED, never faked; `judgePrerequisiteGap` names what is missing before a run asks |
| `doc-verify/src/cache.ts` | `fileOracleCache`, `CACHE_DIR` | a per-atom cache under `.doc-verify-cache/`, keyed as `docs/modules/oracles/model.md` §Cache states |
| `doc-verify/src/local-env.ts` | `loadDocVerifyEnv`, `resolveDocVerifyEnvPath` | the key comes from `TYPESAFE_API_KEY`, or from `API_KEY` in `.env.doc-verify` at the canonical checkout root |

A follow-up span question is asked only for a non-passing atom, is cached like any atom, and a
real follow-up call is a `RequestRecord`.
