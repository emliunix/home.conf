# Round 3 — live fixture run (2026-10-12, judge jev-1.13.0 through the TypeScript host)

Command: `node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --cap 300`. Spent 27 main
questions + 6 span follow-ups; every fixture PASSes the draft profile (structure intact), and no
seeded edit is caught by structure alone. Full per-row output is in the runner's terminal log;
the per-oracle summary it printed:

| Oracle | good | defective-gross | defective-subtle | false PASS |
| --- | --- | --- | --- | --- |
| `coverage_complete` (thr 0.5) | holds p=0.72 | **separates**: fails p=0.83 | no: `unknown` p=0.44, threshold-demoted → NEEDS-REVIEW | none |
| `evidence_not_law` | holds p=1.00 | **separates**: fails p=0.94 | **separates**: fails p=0.73 | none |
| `problem_resolved` | holds p=0.72 | **separates**: fails p=0.99 | no: holds p=0.65 | subtle |
| `scope_explicit` | holds p=0.98 | **separates**: fails p=0.82 (NEEDS-REVIEW verdict) | no: holds p=0.98 | subtle |
| `verification_falsifies` | holds p=0.99 | **no**: holds p=0.97 | **no**: holds p=0.99 | **gross and subtle** |

False passes: 4 of 10 defective fixtures (`problem_resolved/subtle`, `scope_explicit/subtle`,
`verification_falsifies/gross`, `verification_falsifies/subtle`).

Corpus run (`--corpus --repeat 2`, 104 main questions, 0 follow-ups): every one of 52 leaves per
run is `holds`; judge-unknown 0.00, threshold-demoted 0.00, tie 0.00 for all eight oracles;
stability 1.00 where assessable (`current_not_history` 29/29, `problem_resolved` 5/5) and 1.00 on
every smaller row; mean |Δp| between runs ≤ 0.026. Output in `round-3-corpus-live.txt`.

Ledger: 137 of 300 questions spent across the round (`probe/oracle-fixtures/.question-count`).
