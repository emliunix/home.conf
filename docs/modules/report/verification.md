# report — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-report-01 | `doc-verify/tests/diagnostics.test.ts` | in-process |
| P-report-02 | `doc-verify/tests/report.test.ts` | in-process |
| P-report-03 | `doc-verify/tests/report.test.ts` | in-process; `exitCodeFor` |
| P-report-04 | `doc-verify/tests/keyless.test.ts` | spawns the built CLI; the `subprocess` project, 30 s timeout |
| P-report-05 | `doc-verify/tests/segments.test.ts` | in-process |

`doc-verify/tests/keyless.test.ts` is the only subprocess-decided property; it spawns the built
CLI. The tests run in two vitest projects: `unit` (in-process) and `subprocess` (the CLI tests,
a 30 s timeout), so a slow spawn does not flake the logic tier.
