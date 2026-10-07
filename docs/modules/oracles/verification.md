# oracles — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-oracles-01 | `doc-verify/tests/oracles/oracles.test.ts` | in-process, a scripted judge keyed by evidence |
| P-oracles-02 | `doc-verify/tests/oracles/oracles.test.ts` | in-process |
| P-oracles-03 | `doc-verify/tests/oracles/cache.test.ts` | in-process; the file cache on a temp root |
| P-oracles-04 | `doc-verify/tests/oracles/span.test.ts` | in-process; B (judge sentence) and C (section fallback) |
| P-oracles-05 | `doc-verify/tests/oracles/confidentiality.test.ts` | in-process; the outbound policy |

The cache row is load-bearing: a keyless run reads the cache, so a cached answer decides an atom
with no key and no call.
