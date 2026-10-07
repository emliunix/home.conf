# report — properties

| Id | Property | Statement |
|---|---|---|
| P-report-01 | finding verdicts | a violated error is NO-GO, a violated warning is WARN and does not move the verdict, an undetermined binding is NEEDS-REVIEW or BLOCKED |
| P-report-02 | span and reason | a non-passing semantic finding names its deciding span and a reason (low confidence, no key, over budget, unasked evidence) |
| P-report-03 | exit codes | PASS 0, NO-GO 1, NEEDS-REVIEW 2, BLOCKED 3 |
| P-report-04 | keyless | without a key the structural checks decide and a judge-dependent document is BLOCKED |
| P-report-05 | section ids | segments are stable ids with line and byte spans |
