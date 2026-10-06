# report — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-report-01 | `tests/diagnostics.test.ts` | in-process |
| P-report-02 | `tests/report.test.ts` | in-process |
| P-report-03 | `tests/report.test.ts` | in-process; `exitCodeFor` |
| P-report-04 | `tests/keyless.test.ts` | spawns the built CLI (subprocess tier, a longer timeout) |
| P-report-05 | `tests/segments.test.ts` | in-process |

`tests/keyless.test.ts` is the only subprocess-decided property; the rest run in-process. The
subprocess tier is tagged so its timeout does not flake the logic tier.
