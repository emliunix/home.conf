# Reader-batch retrospective disposition

## Outcome against intent

The first reader batch did not produce a comparable measurement: documentation was edited while later readers were still reading, and one reader directly observed changes to `method.md` and `worklog/next.md`. The subsequent round corrected the measurement protocol by pinning tag `reader-batch-3` to commit `63800aa`, recording the pin, freezing the tree, and waiting for all five readers. The excerpt establishes that operational correction, but it does not include per-reader revision checks or the reader reports needed to validate the resulting documentation conclusions.

Selected concerns: `collaboration.handoff`, because concurrent readers measured different trees; and `docs.fresh-agent-authority`, because the work was intended to test whether readers could locate current documentation authority and reject stale alternatives. `verification.false-green` is not selected: the excerpt shows an invalidated batch, not a check that passed despite a failed outcome.

## Lessons learned

| Status | Observation | Inference | Lesson | Destination | Mechanism | Freshness |
| --- | --- | --- | --- | --- | --- | --- |
| verified existing | A reader reported that `method.md` and `worklog/next.md` changed during the batch; the next round used tag `reader-batch-3` at `63800aa` and kept the tree frozen for five readers. | High confidence: mid-batch mutation destroyed the shared measurement basis. A reader mistake is unlikely because the parent was also editing and committing during the run. | A parallel reader batch is valid only when every reader measures the same pinned revision and the tree stays unchanged until all readers return. | The existing reader-batch protocol owner; the excerpt does not establish its exact file path. | Record an immutable revision, give it to every reader, prohibit tree edits until the batch drains, and retain trajectories as evidence. | Re-check whenever the batch runner, repository workflow, or source-control mechanism changes. |
| propose | Reader trajectories found authority conflicts and stale records, while their feedback was treated as leads until reproduced. | High confidence that a documentation edit alone cannot prove transfer to an unaided reader; medium confidence about the exact acceptance surface because no repository path or current protocol file is supplied. | A documentation-authority change should be accepted only after a fresh, blinded reader batch can locate the intended authority from a frozen post-change revision and distinguish it from historical alternatives. | The owner of documentation-authority acceptance or the reader-batch protocol; route is **BLOCKED** until that owner is located. | Add a post-change fresh-reader acceptance batch with pinned revision, captured file-reading trajectories, explicit authority conclusions, and reproduction of reported conflicts. | Run for every change to reading order, authority, or stale-record handling; retire or revise the check if authority discovery becomes mechanically enforced. |

## Verification consequences

Required now: resolve `reader-batch-3` to `63800aa`; confirm every reader was launched against and finished against that revision; confirm no tracked mutation occurred between the batch boundary timestamps; and reproduce each accepted reader finding at the pin. The excerpt asserts the freeze but does not contain these artifacts, so this report cannot mark those checks complete.

For a future documentation-authority change: freeze an immutable post-change revision before dispatch; use fresh readers without an answer key; capture ordered file-reading trajectories, dead ends, and conclusions; require all readers to identify the intended current authority and explicitly reject relevant historical alternatives; reproduce every lead at the pinned revision; and do not edit the tree until the batch is complete. A batch spanning multiple revisions is invalid and must be rerun, not averaged or selectively salvaged.

## Short trajectory

1. Fresh readers began exploring authority and stale records.
2. The parent edited and committed documentation before all readers returned.
3. A reader detected mid-read changes, invalidating cross-reader comparability.
4. The next round pinned `reader-batch-3` at `63800aa`, recorded the pin, froze the tree, and ran five readers.
5. Reader reports remained leads pending reproduction.

## Unresolved and rejected

- Unresolved: the excerpt does not identify the repository or exact protocol owner, so no destination path should be invented.
- Rejected: promoting this incident to a generic concurrency rule beyond reader-batch measurement; the evidence supports only the scoped protocol above.
