# oracles — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-oracles-01 | `tests/oracles.test.ts` | in-process, a scripted judge keyed by evidence |
| P-oracles-02 | `tests/oracles.test.ts` | in-process |
| P-oracles-03 | `tests/cache.test.ts` | in-process; the file cache on a temp root |
| P-oracles-04 | `tests/span.test.ts` | in-process; B (judge sentence) and C (section fallback) |
| P-oracles-05 | `tests/confidentiality.test.ts` | in-process; the outbound policy |

The cache row is load-bearing: a keyless run reads the cache, so a cached answer decides an atom
with no key and no call.
