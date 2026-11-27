# report — properties

| Id | Property | Statement |
|---|---|---|
| P-report-01 | verdicts | an engine report's verdict and a finding's verdict are as `docs/modules/report/model.md` §Verdict states, and a run's verdict is the worst of its parts in the precedence NO-GO, BLOCKED, NEEDS-REVIEW, PASS |
| P-report-02 | span and reason | a non-passing semantic finding names its deciding span and a reason (low confidence, no key, over budget, unasked evidence) |
| P-report-03 | verdict exit codes | each verdict exits with its code in `docs/modules/report/contract.md` §Command line |
| P-report-04 | keyless | without a key the structural checks decide and a judge-dependent document is BLOCKED |
| P-report-05 | section ids | segments are stable ids with line and byte spans |
| P-report-06 | refusal exit codes | a usage error, an unstaged configuration, a missing configuration and an internal error exit with their codes in `docs/modules/report/contract.md` §Command line |
