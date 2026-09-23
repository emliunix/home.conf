# Fixture: taskboard service retrospective

Source: `deepseek-harness-session-5b2684fd-831e-4ca9-aa07-32fce59932db`, messages
1154-1227, captured 2026-09-22 with `nmem`. This is a bounded, redacted excerpt. Paths retain their
source spelling; command credentials and unrelated transcript content are omitted.

## Transcript evidence

**1154-1158, user intent.** The user requests the final retrospective: lessons learned,
architecture improvements, process overhead by time cost, process improvements, unnecessary work,
trap paths, and a ledger entry. The user also requests concise lists of project objectives,
invariants, and verification design.

**1164, test output.** A live service test fails because it expected issue ordinal `(0, 0)` but the
system recorded `(4, 0)`. The same run emits an executor-shutdown warning and takes 302.31 seconds.

**1165, investigation.** Inspection shows the ordinal `(4, 0)` is correct because the surface
wrapper consumes turns 0 through 3. The useful assertion should compare the adapter's stored
ordinal with the machine journal instead of hard-coding a turn.

**1175, second run.** The test still takes 303.76 seconds and attempts to read a Temporal snapshot
after the bridge has closed. This is a test-order defect, separate from the long shutdown.

**1187-1190, product defect isolated.** After the assertion and read-order corrections, the test
passes but still consumes about 302 seconds. A smaller probe shows a listener thread remains alive.
The user classifies the delay as a major defect rather than acceptable test overhead.

**1196-1204, fix and verification.** The blocking notification iterator is replaced by a bounded
notification read. The same live test completes in 2.54 seconds, down from 302 seconds. The full
suite then reports 269 passed and 30 skipped.

**1216-1221, verification gap.** The user defines valuable verification as a real-world case
programmed as an end-to-end test, with programmatic trace checks and a visual check where relevant,
kept concise. Repository history shows that `service_store.py`, `service_api.py`, and
`service_worker.py` had no service test file before this work. Only one of five named happy paths is
programmed; trace assertions and the UI visual check remain absent.

**1222-1225, authoring and routing.** The user rejects compiler-error archaeology as the authoring
method and asks for a skill that guides valid fixture creation. The assistant records the comments
in the project worklog, distinguishes the workaround from the durable authoring improvement, and
lists the unprogrammed verification work.

## Available project destinations in the source task

- `taskboard-v4/worklog/01-api-server.md`: dated execution evidence and owner comments.
- `taskboard-v4/design/01-api-server.md`: current design authority.
- `taskboard-v4/designs/api-contract.md`: service contract and valuable paths.
- `taskboard-v4/tests/`: executable checks.
- The source task did not establish a project-level authoring skill path or a single open-work
  register. A procedure must not invent either without checking the source tree.
