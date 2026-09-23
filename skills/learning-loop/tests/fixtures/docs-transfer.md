# Fixture: reader batch changed during measurement

Source: `deepseek-harness-session-8a8dc1d0-a8ac-46a6-b849-0a480219230a`, messages
2176-2311, captured 2026-09-22 with `nmem`. This is a bounded, redacted excerpt.

## Transcript evidence

The user requests several fresh agents to explore different topics and report their file-reading
trajectories, dead ends, and conclusions. The first readers identify authority conflicts and stale
records. The parent edits and commits documentation while later readers are still working. One
reader then reports that `method.md` and `worklog/next.md` changed during its read, so the batch no
longer measures one repository state.

The user extracts the lesson: wait for every reader before changing the tree. In the next round the
parent trims the spine, creates tag `reader-batch-3` at commit `63800aa`, records the pin, and keeps
the tree frozen while five readers run. Reader trajectories remain the evidence; their feedback is
treated as leads until reproduced.
