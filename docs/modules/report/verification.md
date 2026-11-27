# report — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-report-01 | `doc-verify/tests/report/diagnostics.test.ts` | unit; the precedence table |
| P-report-02 | `doc-verify/tests/report/report.test.ts` | unit; in-process |
| P-report-03 | `doc-verify/tests/report/report.test.ts` | unit; `exitCodeFor` |
| P-report-04 | `doc-verify/tests/report/keyless.test.ts` | subprocess; spawns the built CLI |
| P-report-05 | `doc-verify/tests/report/segments.test.ts` | unit; in-process |
| P-report-06 | `doc-verify/tests/report/cli.test.ts` | subprocess; spawns the built CLI |
