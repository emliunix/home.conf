# Taskboard service retrospective

## Outcome against intent

The work corrected two test defects and one product defect, reducing the live service test from 302-304 seconds to 2.54 seconds and ending with 269 passed and 30 skipped. It established that adapter ordinals must agree with the machine journal and notification reads must not outlive bridge shutdown. The worklog comments landed, but verification remains incomplete: only one of five happy paths is programmed, with no trace assertions or UI visual check.

**Evidence pin:** bounded, redacted excerpt `deepseek-harness-session-5b2684fd-831e-4ca9-aa07-32fce59932db`, messages 1154-1227, captured 2026-09-22. No artifact digest was supplied.

**Selected concerns:** `architecture.domain-model` for the corrected ordinal model; `verification.false-green` for missing valuable-path, trace, and UI coverage; `process.time-cost` for measured 302-second runs; `process.trap-path` for compiler-error archaeology.

## Lessons learned

| Status | Observation | Inference | Lesson | Destination | Mechanism | Verification / freshness |
| --- | --- | --- | --- | --- | --- | --- |
| verified existing | 1164-1165: `(4, 0)` matched the journal because the wrapper consumed turns 0-3; the hard-coded assertion was corrected. | High confidence: the journal is authoritative; inspection falsified an adapter offset bug. | Service-adapter tests must compare stored ordinals with the journal, not an assumed turn. | `taskboard-v4/tests/`; rationale in `taskboard-v4/designs/api-contract.md` only if needed. | Journal-to-adapter invariant assertion. | Corrected live test and 269/30 suite result; re-check when turn allocation or journal schema changes. Exact test path is absent. |
| verified existing | 1187-1204: a live listener was isolated; a bounded read cut the test from about 302 seconds to 2.54 seconds. | High confidence: the probe reproduced the listener and the replacement immediately removed the delay. | Request-scoped notification consumers must terminate before bridge shutdown. | Existing service implementation owner; `taskboard-v4/design/01-api-server.md` if the lifecycle contract is absent. | Bounded/cancellable read plus listener-liveness or tolerant shutdown-time regression check. | Live test 2.54 seconds and full suite green; re-check when transport or executor lifecycle changes. Exact source path is absent. |
| open; register blocked | 1216-1221: one of five happy paths exists; trace assertions and a UI visual check are absent. | High confidence: suite totals do not prove valuable-path coverage; equivalent lower-level coverage is unsupported. | A named service path is complete only with end-to-end outcome and trace checks, plus a visual check where relevant. | `taskboard-v4/designs/api-contract.md`, `taskboard-v4/tests/`, and existing worklog. No open-work register was established. | Add four cases, trace assertions, and the relevant visual check; link closure evidence from the register once found. | All five paths must pass; re-check when the contract list changes. Register lookup remains `BLOCKED`. |
| propose; owner blocked | 1222-1225: the user rejected compiler-error archaeology and requested valid-fixture guidance. | Medium-high confidence: a known-good construction path reduces trial and error; diagnostic quality was not assessable. | Start fixture authoring from the supported construction contract and validate the full shape before compiling. | Project-local skill/guide owner, not established; do not invent a path. | Canonical minimal fixture plus validation command/test and scoped authoring procedure. | One fresh reader must create a valid fixture without archaeology; re-check on schema/compiler change. Owner lookup remains `BLOCKED`. |

## Architecture and verification consequences

The journal is the ordinal authority. Bounded notification consumption is part of the bridge lifecycle. Both fixes have artifact-reported verification, but the latter should enter the owning design only if absent. Structural follow-through is four end-to-end cases, trace assertions, and one UI visual check. A direct mechanical walk was prohibited by this trial's bounded-read rule, so only fixture-established destinations are named.

## Process cost and trap paths

Three long runs took 302.31, 303.76, and about 302 seconds, at least 908 seconds total; the comparable fixed run took 2.54 seconds. Hard-coded ordinal assumptions caused one false failure. Reading the Temporal snapshot after bridge close caused another. Compiler errors are not an authoring contract; a validated minimal fixture is the proposed earlier stop rule.

## Structural follow-through

- Retain the dated evidence and unresolved verification list in `taskboard-v4/worklog/01-api-server.md`; the fixture says this is already done.
- Locate the real open-work register, then record four paths, trace checks, and the visual check with owner and closure evidence. Until then: `BLOCKED`.
- Locate the project-local skill/guide owner, propose the validated fixture workflow, then run one fresh-reader check. Until then: `BLOCKED`.

## Short trajectory

Read the procedure and its three references, pinned the supplied excerpt, selected four activated concerns, separated observations from causal claims, and routed only to established owners. No repository path was inspected or changed.

## Unscored feedback

The evidence/inference/mechanism split and no-invented-path rule were effective. The six-field table becomes wide when status and verification are added; a compact canonical form would help. Direct path verification also conflicts with bounded blinded trials unless artifact-reported verification is explicitly allowed.
