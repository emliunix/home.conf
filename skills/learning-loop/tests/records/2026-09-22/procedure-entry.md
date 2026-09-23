## Disposition Report

### Trajectory

1. Read the bounded transcript evidence and identified the user’s requested outputs.
2. Separated three defects: invalid ordinal assertion, invalid snapshot-read ordering, and the product-level listener shutdown defect.
3. Compared measured runtime before and after the bounded notification read.
4. Reviewed the stated verification coverage and identified the remaining executable gaps.
5. Routed durable conclusions only to destinations established by the fixture; where no exact file was established, deferred the edit rather than inventing one.

### Objectives

- Keep service state consistent with the machine journal.
- Ensure bridge notification handling terminates promptly.
- Program valuable real-world service paths as end-to-end verification.
- Make valid fixture authoring guided and intentional.
- Preserve execution evidence and remaining work without confusing it with design authority.

### Invariants

- The adapter’s stored issue ordinal must equal the machine journal’s ordinal; it must not assume a fixed surface turn.
- Snapshot reads must occur while the bridge remains available.
- Notification consumption must be bounded so teardown cannot leave a listener thread alive.
- A passing live test must terminate promptly, not merely satisfy assertions.
- Valuable-path verification must use real-world E2E cases, programmatic trace checks, and a visual check where UI behavior matters.

### Findings and Dispositions

| Finding | Evidence | Inference | Disposition |
|---|---|---|---|
| Hard-coded issue ordinals encode the wrapper’s internal turn layout. | Messages 1164-1165: expected `(0, 0)`, actual `(4, 0)`; turns 0-3 were consumed by the wrapper. | The journal is the authoritative comparison surface. | **Encode as an invariant.** |
| Snapshot inspection was ordered after bridge closure. | Message 1175 calls this a separate test-order defect. | Service tests need explicit lifecycle phases. | **Correct in executable verification; mention in verification design.** |
| Unbounded notification consumption caused the five-minute shutdown. | Messages 1187-1204: listener remained alive; bounded read reduced runtime from about 302 seconds to 2.54 seconds. | Notification cardinality and termination belong in the runtime contract, not only in a regression test. | **Encode as a design invariant and retain a regression check.** |
| The suite’s service coverage is incomplete. | Messages 1216-1221: one of five happy paths programmed; trace assertions and UI visual check absent. | A passing full suite does not establish valuable-path completeness. | **Keep as explicit verification debt.** |
| Compiler-error archaeology is not an acceptable fixture-authoring workflow. | Messages 1222-1225: user requested a skill guiding valid fixture creation. | Fixture schema knowledge should be presented before compilation. | **Record the need now; defer the skill edit until its actual project path is discovered.** |
| Long test runs dominated process cost. | Three live runs took 302.31 seconds, 303.76 seconds, and about 302 seconds: at least about 908 seconds total, excluding investigation. The fixed run took 2.54 seconds. | Early listener-liveness isolation would have shortened the loop materially. | **Add a diagnostic rule to the project record and design verification notes.** |

### Proposed Source Changes

No source-project edits were made.

1. **`taskboard-v4/design/01-api-server.md`**  
   Mechanism: add a concise “Runtime lifecycle invariants” section covering bounded notification reads, prompt listener termination, snapshot access before bridge closure, and journal-derived ordinal validation.

2. **`taskboard-v4/designs/api-contract.md`**  
   Mechanism: add a verification matrix for the five already-named happy paths, with columns for E2E case, trace assertions, visual check where relevant, and current status. Preserve the source task’s path names; do not reconstruct them from this excerpt.

3. **`taskboard-v4/worklog/01-api-server.md`**  
   Mechanism: append a dated ledger entry recording:
   - the two test defects;
   - the surviving-listener root cause;
   - runtime improvement from about 302 seconds to 2.54 seconds;
   - full-suite result of 269 passed and 30 skipped;
   - four unprogrammed happy paths;
   - missing trace and UI visual checks;
   - the unresolved fixture-authoring skill request.

4. **`taskboard-v4/tests/`**  
   Mechanism: extend the existing service test created during this work with teardown/liveness and journal-ordinal assertions, then add the remaining four valuable paths and trace checks. The fixture does not identify the test filename, so this is not edit-ready until the source tree is inspected; no filename should be invented.

5. **Fixture-authoring skill destination**  
   Mechanism: first inspect the source tree for the established project-level skill convention. If none exists, record a placement decision before creating one. The only immediate exact destination available is the open action in `taskboard-v4/worklog/01-api-server.md`; the fixture explicitly does not establish a skill path.

### Verification Design

- Assert stored ordinal against the machine journal.
- Read snapshots before bridge shutdown.
- Assert no notification listener remains alive after completion.
- Set a prompt termination expectation that would fail the former 302-second behavior.
- Program all five valuable paths as E2E cases.
- Add programmatic trace assertions to each applicable path.
- Add one UI visual check for the relevant user-facing path.
- Run the focused live test, then the full suite; retain the observed 269-passed baseline for comparison.

### Process Improvements

- When assertions pass but teardown stalls, inspect live threads immediately.
- Treat multi-minute shutdown as a product defect until disproven.
- Separate assertion correctness, lifecycle ordering, and teardown behavior during diagnosis.
- Define valid fixture structure before authoring instead of discovering it through compiler failures.
- Track valuable-path coverage explicitly; suite totals alone conceal missing scenarios.

### Trap Paths to Retire

- Hard-coding wrapper-dependent turn ordinals.
- Reading service state after its bridge is closed.
- Classifying a repeatable five-minute shutdown as ordinary test overhead.
- Using compiler failures as the primary fixture schema documentation.
- Treating “full suite passes” as evidence that all named valuable paths are verified.

## Unscored Feedback

**Instructions I wished I had:** a required disposition schema, definitions for disposition states, and explicit guidance for handling a lesson whose durable destination is unknown.

**Where I re-read:** the distinction between the second test’s read-order defect and the separate shutdown defect; the final paragraph stating that neither a skill path nor a single open-work register was established.

**What I would delete from my own output:** the process-improvement and trap-path sections overlap somewhat with the findings table. In a tighter report, I would retain the table and remove those two summaries.
