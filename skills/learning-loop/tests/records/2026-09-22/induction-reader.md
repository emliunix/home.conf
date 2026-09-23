# Blinded future-maintainer assessment

## Measurement convention

I read only the two supplied retrospective files. File A is 5,698 bytes and 790 whitespace-delimited words; file B is 7,811 bytes and 1,113 whitespace-delimited words. I treat an unresolved ownership decision as a case where the retrospective says the authoritative owner or home is not established. I do not count an unknown exact test filename as an ownership decision when the owning test area is already named, but I do count it as a discovery hop. A source hop below means an additional discovery step needed before a maintainer can act; opening a directly named destination is not a discovery hop.

## Output A, independently assessed

### 1. Why the roughly 302-second run happened

The roughly 302-second behavior was caused by a product lifecycle defect: a blocking notification consumer left a live listener running during shutdown, so the notification read outlived bridge shutdown. Replacing that indefinitely blocking consumption with a bounded read reduced the live test to 2.54 seconds. This is causally distinct from both test defects:

1. The ordinal assertion was an invalid oracle. It hard-coded `(0, 0)` even though wrapper activity had legitimately consumed turns 0 through 3; `(4, 0)` agreed with the authoritative machine journal.
2. The Temporal snapshot was requested after bridge close, which was invalid test ordering.

Those two defects could cause false test failures, but neither explains the five-minute shutdown delay. Output A preserves that distinction, although the second test defect is easier to find in its process-cost paragraph than in its main lessons table.

### 2. Verification work that remains

- Add the other four of the five named happy-path end-to-end cases.
- Add programmatic trace assertions; the current suite total does not establish valuable-path trace coverage.
- Perform the relevant UI visual check.
- Preserve or strengthen lifecycle regression coverage with a bounded/cancellable notification read and a listener-liveness or shutdown-tolerant assertion.
- Keep the ordinal regression journal-relative rather than hard-coded.
- Validate the proposed fixture-authoring workflow with a canonical valid fixture, a validation command or test, and one fresh-reader trial after its owner is found.
- Confirm whether the lifecycle invariant is already present in the owning design before adding it there.

### 3. Owner or blocker for each follow-up

| Follow-up | Established owner or explicit blocker stated by A |
| --- | --- |
| Journal-relative ordinal regression | `taskboard-v4/tests/`; exact test path is absent. Put rationale in `taskboard-v4/designs/api-contract.md` only if needed. |
| Bounded notification and listener-shutdown regression | Existing service implementation owner; `taskboard-v4/design/01-api-server.md` if the lifecycle contract is absent. Exact source path is absent. |
| Four remaining happy paths, trace assertions, and UI check | `taskboard-v4/designs/api-contract.md`, `taskboard-v4/tests/`, and the existing worklog are named, but routing through a real open-work register is explicitly `BLOCKED` because no such register was established. |
| Preserve dated retrospective evidence | `taskboard-v4/worklog/01-api-server.md`; A says this has already been done. |
| Valid-fixture authoring guidance and fresh-reader check | Project-local skill/guide owner lookup is explicitly `BLOCKED`; A refuses to invent a path. |

Unresolved ownership decisions: **2**. They are the authoritative open-work register and the project-local skill/guide owner. There is also one shared exact-file discovery gap for the live service regression, but its owning test area is known.

Estimated discovery hops from A alone: **3**: locate the exact live service test, locate the authoritative open-work register, and locate the project-local skill/guide owner. The evidence pin is precise enough for audit, so I do not count opening it as a discovery hop.

## Output B, independently assessed

### 1. Why the roughly 302-second run happened

The roughly 302-second behavior was caused by the product lifecycle defect: an indefinitely blocking notification iterator kept the listener thread alive during shutdown. The bounded read removed that delay and produced the 2.54-second run. Output B explicitly separates this from the two test defects:

1. The test's fixed `(0, 0)` ordinal was an invalid oracle because wrapper execution consumed turns 0 through 3; the journal is authoritative.
2. The test requested its Temporal snapshot after closing the bridge, an invalid lifecycle ordering in the test.

The product defect explains the elapsed time. The oracle and ordering defects explain false failures or invalid evidence collection, not the five-minute wait.

### 2. Verification work that remains

- Discover and amend the existing live service test with journal-relative ordinal assertions, pre-close snapshot reads, and a direct assertion that the listener terminates.
- Run the focused live case and then the full suite, retaining both results in the worklog.
- Add end-to-end tests for the other four contract-defined happy paths.
- Add programmatic trace assertions to each applicable path.
- Add a UI visual check where a path has user-visible behavior.
- Connect each contract path to visible verification status in the API contract.
- Establish the project-local authoring-skill convention, then provide a canonical minimal valid fixture and direct validation command. B proposes this improvement but does not claim that its verification has already occurred.

### 3. Owner or blocker for each follow-up

| Follow-up | Established owner or explicit blocker stated by B |
| --- | --- |
| Lifecycle, ordinal-authority, and snapshot-ordering design invariants | `taskboard-v4/design/01-api-server.md`. |
| Four happy paths, trace checks, visual check, and per-path verification status | `taskboard-v4/designs/api-contract.md`. B explicitly rejects inventing a new open-work register and keeps this work in the established API contract. |
| Regression changes | The established area is `taskboard-v4/tests`, but the exact live-test filename is an explicit source-discovery blocker; B requires `rg --files taskboard-v4/tests` before editing. |
| Dated evidence and result retention | `taskboard-v4/worklog/01-api-server.md`. |
| Fixture-authoring guidance | No project-level skill destination is established. Inspect the existing project-local convention first; this is the explicit blocker. |

Unresolved ownership decisions: **1**. It is the project-local authoring-skill owner/home. The exact live-test filename remains a destination discovery task, not an ownership choice, because `taskboard-v4/tests` is established. The proposed open-work register is not unresolved: B explicitly rejects it for now.

Estimated discovery hops from B alone: **2**: locate the exact live service test and inspect the project-local skill convention. All other follow-ups have direct destinations.

## Comparison

### Correctness

Both outputs are substantively correct on the central maintenance facts. Each attributes the five-minute run to the blocking notification/listener lifecycle defect, distinguishes the invalid ordinal oracle and post-close snapshot read as test defects, reports the 2.54-second corrected run and 269-passed/30-skipped suite, and does not mistake that green suite for complete valuable-path verification.

Output B is clearer and slightly more complete for causal transfer. Its opening numbered list puts all three defects and their different roles together, and its verification design explicitly calls for listener termination rather than relying only on elapsed wall time. Output A reaches the same conclusion, but the snapshot-ordering defect is dispersed and its routing language alternates between established destinations and a still-unlocated open-work register.

Output A is more cautious about evidence provenance and freshness. It gives a bounded evidence pin, marks confidence and status, and calls out when design promotion is conditional on the invariant being absent. Those are useful correctness controls. Neither output overclaims that the remaining happy paths, traces, UI behavior, or authoring guidance have been verified.

### Transfer cost

Output A has the lower reading load at **790 words / 5,698 bytes**, versus B at **1,113 words / 7,811 bytes**. Its table is compact in total length but wide, and a maintainer has to assemble the full defect separation and routing state from several sections. It leaves **2 unresolved ownership decisions** and an estimated **3 discovery hops**.

Output B has the higher reading load and some repetition across dispositions, objectives, invariants, and verification design. In exchange, it has lower action-selection cost: the defect taxonomy is immediate, the disposition table names direct destinations, the non-existent register is explicitly rejected, and blockers are framed as concrete discovery steps. It leaves **1 unresolved ownership decision** and an estimated **2 discovery hops**.

For rapid comprehension with minimal reading, A is cheaper. For a future maintainer who must execute the follow-ups without inventing ownership, B is the lower-transfer-cost handoff despite being longer.
