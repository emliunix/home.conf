# Disposition Report

## Outcome

The work corrected three distinct defects:

1. **Invalid test oracle:** the test hard-coded ordinal `(0, 0)` even though the wrapper legitimately consumed turns 0–3. The journal is the correct comparison source.
2. **Invalid test ordering:** the test requested a Temporal snapshot after closing the bridge.
3. **Product lifecycle defect:** a blocking notification iterator kept a listener thread alive during shutdown. Replacing it with a bounded read reduced the live test from roughly 302 seconds to 2.54 seconds, about a 119× improvement.

The resulting suite passed with 269 tests passing and 30 skipped. Verification remains incomplete: only one of five named happy paths is programmed, with trace assertions and the relevant UI visual check still absent.

## Dispositions

| Finding | Disposition | Exact destination | Proposed mechanism |
|---|---|---|---|
| Shutdown must not depend on an indefinitely blocking notification iterator | **Promote to design invariant** | `taskboard-v4/design/01-api-server.md` | Add a service-lifecycle subsection stating that notification reads must be bounded or cancellation-aware and that bridge shutdown must leave no listener thread alive. |
| Stored issue ordinals derive from actual machine execution | **Promote to design invariant** | `taskboard-v4/design/01-api-server.md` | State that adapter ordinals are verified against the machine journal; tests must not assume a fixed turn number when wrappers may consume turns. |
| Snapshot and trace reads have lifecycle ordering requirements | **Promote to design invariant** | `taskboard-v4/design/01-api-server.md` | Document that snapshot and trace evidence must be collected before bridge closure unless the design explicitly retains a readable post-close snapshot. |
| Five valuable happy paths need executable coverage | **Retain as open verification work** | `taskboard-v4/designs/api-contract.md` | Add a verification-status field beside each existing named path: end-to-end test, programmatic trace assertions, visual check when relevant, and current status. Mark one programmed and four outstanding based on the fixture. |
| Regression coverage is needed for the corrected defects | **Implement after source-tree discovery** | No exact test file is established by the fixture | Run `rg --files taskboard-v4/tests` in the source task and identify the existing live service test. Amend that exact file with journal-relative ordinal assertions, pre-close snapshot reads, and a shutdown assertion that the listener terminates. No executable edit should be proposed until that filename is known. |
| Fixture creation should not rely on compiler-error archaeology | **Promote as an authoring improvement** | No project-level skill destination is established | First inspect the source tree for an existing project-local skill convention. Update the discovered authoring skill or create one only at the conventionally established location, using a valid minimal fixture template plus a direct validation command. Do not invent a skill path from this fixture. |
| A single open-work register would simplify routing | **Reject for now** | None | The source task did not establish such a register. Keep the verification gap in the API contract and dated evidence in the worklog until the project defines an authoritative register. |
| Retrospective evidence and owner comments need preservation | **Record** | `taskboard-v4/worklog/01-api-server.md` | Append a dated `2026-09-22` retrospective entry containing the three defect classes, the approximately 302s-to-2.54s result, suite result, remaining four happy paths, missing trace checks, missing visual check, and unresolved authoring-skill routing. |

## Objectives

- Keep service state and adapter observations consistent with the machine journal.
- Ensure service shutdown completes promptly and leaves no listener thread running.
- Program all five contract-defined happy paths as concise end-to-end cases.
- Verify relevant traces programmatically and UI behavior visually where applicable.
- Give fixture authors a valid construction path without iterative compiler-error discovery.

## Invariants

- Ordinal assertions compare recorded adapter state with the journal, not a hard-coded turn.
- Snapshot and trace evidence is read while its owning bridge remains available.
- Notification consumption is bounded or cancellable.
- Closing the service terminates its listener thread.
- Contract paths and executable verification status remain visibly connected.

## Verification Design

- Preserve the corrected live service case as the lifecycle regression.
- Assert journal-to-adapter ordinal equality.
- Assert snapshot availability before bridge closure.
- Assert listener termination without relying solely on elapsed wall time.
- Add one end-to-end test per remaining contract path.
- Add programmatic trace assertions to each applicable path.
- Add a UI visual check only where the contract path has user-visible behavior.
- Run the focused live case, then the full suite; retain both results in the worklog.

## Process Retrospective

**Measured overhead:** three approximately five-minute live runs consumed about 15 minutes of wall time before the bounded-read fix. Investigation and compiler-error archaeology are mentioned but not timed, so no fabricated estimate should be assigned.

**Process improvements:**

- After the first anomalous five-minute shutdown, inspect thread liveness with a minimal probe before repeating the full live test.
- Separate oracle defects, teardown-order defects, and product lifecycle defects instead of treating each rerun as evidence of one root cause.
- Derive assertions from authoritative runtime artifacts such as the machine journal.
- Validate lifecycle ordering explicitly in the test structure.
- Provide a valid fixture template and validation command once the project’s authoring-skill location is established.

**Unnecessary work and trap paths:**

- Hard-coding `(0, 0)` ignored wrapper-consumed turns.
- Reading a snapshot after bridge closure tested an invalid sequence.
- Repeated full five-minute runs delayed isolation of the live listener.
- Treating the shutdown delay as acceptable test overhead would have concealed a product defect.
- Using compiler errors as fixture documentation is avoidable authoring friction.
- Inventing a skill path or open-work register from incomplete project context would create competing authorities.

## Trajectory

1. Read the requested retrospective scope and expected outputs.
2. Followed the three live-test runs and separated assertion, ordering, and shutdown defects.
3. Treated the bounded notification read and 2.54-second result as the durable lifecycle finding.
4. Read the verification evidence and identified the difference between suite success and valuable-path coverage.
5. Read the routing constraints and limited proposed edits to established destinations; deferred any test-file or skill-path edit whose exact destination was not provided.

## Unscored Feedback

**Instructions I wished I had:** a required disposition vocabulary, the expected ledger-entry schema, the five named happy paths, the exact existing live-test filename, and the project’s skill-location convention.

**Where I re-read:** messages 1164–1204 to ensure the assertion, ordering, and listener defects were not collapsed into one issue; messages 1216–1225 to avoid overstating verification coverage; and the final destination warning before routing the skill and open work.

**What I would delete from my own output:** the objectives and invariants partially overlap with the disposition table. In a tighter artifact, I would keep the table, verification design, and ledger payload, then remove the repeated objective wording.
