# report — verification

| Property | Check (deciding test) | Limit |
|---|---|---|
| P-report-01 | `doc-verify/tests/report/diagnostics.test.ts` | in-process |
| P-report-02 | `doc-verify/tests/report/report.test.ts` | in-process |
| P-report-03 | `doc-verify/tests/report/report.test.ts` | in-process; `exitCodeFor` |
| P-report-04 | `doc-verify/tests/report/keyless.test.ts` | spawns the built CLI; the `subprocess` project, 30 s timeout |
| P-report-05 | `doc-verify/tests/report/segments.test.ts` | in-process |

`doc-verify/tests/report/keyless.test.ts` is a subprocess-decided property; it spawns the built CLI, as
does `doc-verify/tests/selection/task61-selector-gate.test.ts` (which decides P-selection-01). The tests run
in two vitest projects: `unit` (in-process) and `subprocess` (the CLI tests, a 30 s timeout), so
a slow spawn does not flake the logic tier.
