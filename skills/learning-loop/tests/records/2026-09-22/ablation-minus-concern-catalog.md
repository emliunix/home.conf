# Taskboard service retrospective disposition

## Outcome against intent

The immediate objective succeeded: two test defects were corrected, a live listener was isolated, and its blocking iterator was replaced with a bounded read. The live test fell from roughly 302 seconds to 2.54 seconds; the full suite reported 269 passed and 30 skipped. Broader verification remains incomplete: only one of five happy paths is executable, with trace assertions and a relevant UI visual check still absent.

The concise project frame is:

- **Objectives:** prove real service behavior end to end, eliminate shutdown delay, preserve findings, and guide valid fixture authoring.
- **Invariants:** ordinals agree across adapter storage and the machine journal rather than matching a hard-coded turn; lifecycle-dependent state is read before the bridge closes; notification consumption terminates within the operation's bounded lifetime.
- **Verification design:** encode each valuable path as a concise end-to-end test, assert its trace, and add a visual check where UI behavior is claimed.

## Lessons learned

| Status | Observation | Inference | Lesson | Destination | Mechanism and verification | Freshness |
| --- | --- | --- | --- | --- | --- | --- |
| **verified existing** | 1187-1204 isolate a live listener; a bounded read cuts the test from about 302 seconds to 2.54 seconds, followed by 269 passed and 30 skipped. | **High:** the listener caused the delay; a focused probe and before/after timing separate it from the test corrections. | Notification consumption within a bounded operation needs bounded termination. | Owning notification-consumption code; regression in `taskboard-v4/tests/`. No exact implementation path is established. | Retain the bounded read and live regression. The fast live test and green suite verify it. | Notification API, ownership, or shutdown-model change. |
| **verified existing** | 1164-1165 show `(4, 0)` is correct because the wrapper consumes turns 0-3; the `(0, 0)` assertion was corrected. | **High:** the oracle, not ordinal production, was defective. | Compare cross-component identity with the authoritative journal, not an absolute turn. | `taskboard-v4/tests/`, governed by the service design or API contract. | Compare stored and journal ordinals; the corrected test joined the passing runs. | Ordinal contract or wrapper allocation change. |
| **verified existing** | 1175 and 1196-1204 show a snapshot read after bridge closure; correcting the order preceded success. | **High:** this was a separate test lifecycle defect. | Capture lifecycle-bound evidence before provider closure. | `taskboard-v4/tests/`. | Preserve read-before-close ordering in the live test. | Snapshot persistence becomes independent of bridge lifetime. |
| **open; route blocked** | 1216-1221 establish one of five paths is programmed; trace assertions and a UI check are absent. | **High:** green tests do not cover the user-defined scope. | Implement the remaining paths, trace checks, and relevant visual check as closure work. | Execution: `taskboard-v4/tests/`. Tracking: an open-work register, but none is established; owner lookup is required. | Add one concise end-to-end test per path, trace assertions, and a relevant visual check; close when they run. | API contract's path list changes. |
| **propose; route blocked** | 1222-1225 reject compiler-error archaeology and request valid-fixture guidance; no skill path is established. | **Medium-high:** guidance was missing; whether a builder or schema can enforce it is unknown. | Document the supported fixture path and prefer a valid example or builder over compiler trial-and-error. | Existing project-local authoring guidance owner after lookup; builder/schema with owning test support code. | Propose scoped guidance and an example; add a structural check if supported. Verify it directly, then use one fresh reader. | Fixture types, constructors, or diagnostics change. |

## Architecture and verification consequences

The bounded read is the only demonstrated architecture consequence: operation lifetime now constrains listener lifetime. No wider redesign is justified. Verification should follow the contract's five valuable paths rather than generic coverage targets. The missing register is a governance gap; `taskboard-v4/tests/` is the established execution surface.

## Process cost and trap paths

Three slow runs consumed about 908 seconds (15.1 minutes) of command time before the 2.54-second confirmation; total author time is unknown. Investigation separated an invalid oracle, an after-close read, and the listener leak. Traps were accepting the delay as test overhead, hard-coding wrapper-sensitive turns, reading state after teardown, and using compiler errors as fixture documentation.

Rejected: “all slow tests are product defects” over-generalizes; a global absolute-ordinal convention contradicts wrapper behavior; an exact authoring-skill filename is unsupported.

## Short trajectory

1. Reproduced the live failure and found the ordinal expectation was wrong.
2. Corrected the oracle, then exposed and fixed an independent read-after-close ordering defect.
3. Used a smaller probe to trace the persistent 302-second delay to a live listener.
4. Replaced the blocking read, verified the 2.54-second result and full suite, then identified the remaining verification and authoring work.

No repository change is applied because the trial is read-only. The evidence says worklog comments were recorded but provides no artifact bytes to verify that ledger entry.
