# Taskboard Service Retrospective Disposition

## Outcome against intent

The work corrected three separate problems: a false ordinal assumption, a test-order defect that read a Temporal snapshot after bridge closure, and a blocking notification iterator that left a listener thread alive. The live test fell from about 302 seconds to 2.54 seconds; the full suite reported 269 passed and 30 skipped. Verification remains incomplete: only one of five named happy paths is programmed, trace assertions and the UI visual check are absent, and the repository owner for fixture-authoring guidance was not established.

## Concern selection

- `outcome.frozen-intent`: a green suite does not meet the user's broader verification intent.
- `architecture.domain-model`: the work corrected ordinal semantics and listener lifetime.
- `verification.false-green`: one wrong assertion was fixed while valuable-path coverage remains incomplete.
- `process.time-cost` plus `process.trap-path`: three long runs and compiler-error archaeology expose stop rules.

## Lessons learned

| Observation | Inference | Lesson | Destination | Mechanism | Freshness |
| --- | --- | --- | --- | --- | --- |
| Messages 1164-1165 show `(4, 0)` was correct because the surface wrapper consumes turns 0-3; the test expected `(0, 0)`. | High confidence: the test guessed an implementation position. A storage defect was falsified by inspection. | Assert ordinal agreement between adapter and machine journal, not a fixed turn. Scope: wrapped-surface service tests. | `taskboard-v4/tests/`; describe the invariant in `taskboard-v4/design/01-api-server.md` if it is the owner. | Use a cross-record equality assertion; run the live test and prove a deliberate mismatch fails. | Re-check when turn allocation, wrapper behavior, or journal schema changes. |
| Messages 1187-1204 isolate a live listener; a bounded notification read reduces the same test from about 302 seconds to 2.54 seconds. | High confidence: the blocking read caused delayed shutdown. Correcting snapshot order did not remove it. | Bounded requests need bounded notification reads, and shutdown must leave no listener alive. Scope: the service notification path. | `taskboard-v4/design/01-api-server.md` and `taskboard-v4/tests/`. | Add completion and liveness assertions around the real service path; run the live test and suite. | Re-check when notification, executor ownership, or shutdown changes. |
| Messages 1216-1221 establish that one of five happy paths is programmed; trace assertions and the UI visual check are missing. | High confidence: 269 passing tests prove only existing checks. | Represent every valuable service path end to end, with trace assertions and a visual check where UI behavior matters. | `taskboard-v4/designs/api-contract.md` owns paths; `taskboard-v4/tests/` owns checks; `taskboard-v4/worklog/01-api-server.md` holds outstanding work until a verified register exists. | Add four path tests, trace assertions, and the UI check; walk contract-to-test coverage and run checks directly before the suite. | Re-check when contract paths change; close worklog items only after checks pass. |
| Messages 1222-1225 record rejection of compiler-error archaeology and a request for valid-fixture guidance; no authoring-skill owner was established. | Medium confidence: a valid template and early structural validation should reduce iteration, but the durable owner is unknown. | Begin fixtures from a known-valid shape and reject structural errors early. Scope: taskboard fixtures. | Temporarily `taskboard-v4/worklog/01-api-server.md`; final owner unresolved pending a source-tree check. | Inspect for an existing helper, validator, or authoring authority; prefer an enforcing helper/test. Verification is blocked until ownership is known. | Revisit before the next fixture; reject or reroute if authority already exists. |

## Architecture and verification consequences

Objectives: implement the service contract, preserve consistent machine and adapter state, and exercise real service paths without hanging shutdown. Invariants: adapter and journal ordinals agree; reads do not outlive their bridge; waits are bounded; shutdown leaves no listener alive; every valuable path has an end-to-end check. Verification uses real cases, programmatic trace assertions, and a visual check only where UI behavior affects the result.

## Process cost and trap paths

Three long runs consumed about 908 seconds total (302.31, 303.76, and about 302), followed by the 2.54-second confirmation. Each exposed a different issue, so not all elapsed time was waste. Stop rules: compare persisted records before hard-coding orchestration coordinates; capture state before closing its owner; when a test passes but exit stalls, inspect live threads with a smaller probe before another full run. Compiler errors reject fixtures; they are not the authoring method.

## Unresolved and rejected

- Unresolved: discover the durable fixture-guidance owner and whether an open-work register exists.
- Rejected: the ordinal mismatch as a product defect; the recorded ordinal was correct.
- Rejected: the delay as acceptable overhead; the bounded-read result isolated a product defect.
- Rejected: complete valuable-path verification based on the green suite.

## Short trajectory

1. Pin intent and bounded evidence.
2. Separate the ordinal defect from snapshot read order.
3. Isolate the surviving listener behind the remaining 302-second runtime.
4. Verify the bounded read with the 2.54-second test and 269/30 suite result.
5. Compare that green result with the five-path, trace, and visual requirements.
6. Route to established owners; leave the missing authoring owner unresolved.
