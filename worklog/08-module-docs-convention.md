# Worklog - module docs convention

## C1 - Draft (2026-10-16)

Bob (Raft agent) drafted design 08 at the owner's request, after an audit of the
doc-verify module documents against `main` at `1fd1bb6`:

- `git diff --stat b9e950d origin/main -- docs design` is empty, while the same range
  changes `doc-verify/src/report.ts`, `src/engine/index.ts` and `src/types.ts` (#317).
- `docs/modules/language/contract.md` lists an `evaluate` module; `src/evaluate.ts`
  was deleted by PR #11.
- `design/` on `main` stops at 04; 05 to 07 are on `dv/trusted-kernel-trials` only.
- `src/snapshot.ts` already computes the change set for `--staged` and `--range`.



## C2 - Rescoped to the skills (2026-10-16)

The C1 draft proposed an engine gate (`governs:` in companions, change-set facts,
`module-docs-track-code`). It came from misreading the owner's "the impacted paths",
which asked which skills the formalization touches. The owner then accepted a
skills-and-template scope, with home.conf's own module documents as a follow-up.
The engine gate is a non-goal. Rebased onto `main` at `c94f19e` (after PRs #12 and
#13); PR #15 touches no skill or template file.

## C3 - Peer review round 1 (2026-10-16)

The Claude seat in herdr reviewed the C2 draft: 1 blocking, 5 should-fix, 3 notes.
The owner made this peer review the merge gate.

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | blocking: #11, #317 and #13 never went through a flow gate, so stage checks alone would not have caught them | Taken: the problem statement now says so, and a pull-request rule (`Module docs:` line) applies on both routes |
| 2 | should-fix: "no change to `docs/` or `design/`" is false (#11 added docs, #13 edited design/02) | Taken: narrowed to `docs/modules/` |
| 3 | should-fix: no route for a change without a design | Taken: the no-design route reuses raft-task-card's small-task test; a contract change is not small |
| 4 | should-fix: `canon.yaml` also checks architecture and index | Taken: it keeps those rules; only the module rules go, with two new seeds in the witness |
| 5 | should-fix: the frozen-prefix lock turns red; the eval harness is a better witness | Taken: lock re-approval is in scope; L0 and L1 witnesses use `flow-skills-eval` |
| 6 | should-fix: only the review stage has a witness | Taken: L0 assertion per stage, L1 triplets per stage |
| 7 | note: the returned-draft rule belongs to the Draft contract, not item 0 | Taken |
| 8 | note: no spine relations exist on `main` | Taken: the follow-up names `core.section_ref` now and the spine relations with designs 06 and 07 |
| 9 | note: the grep witness catches one wording | Taken: replaced by the L0 test |

## C4 - Implementation (2026-10-16)

The Claude seat passed the design at `6e248bd`
(https://github.com/emliunix/home.conf/pull/14#issuecomment-6201232836). Implemented on
the same branch:

- `skills/project-skeleton/SKILL.md`: the Module docs section, a Project docs row,
  and three new seeds in the validation protocol.
- Stage checks in flow-grill-review (Draft contract, Scope row), flow-common
  (Before dispatch, done checklist) and flow-retro (Close the loop, done checklist),
  each pointing at `project-skeleton` § Module docs. One line each in raft-task-card,
  spine-orient and finding-triage.
- Template: the design guide's order, `canon.yaml` reduced to the architecture and
  index rules, the four module rules in `.doc-verify.yaml` on `doc-verify:module-*`,
  the pull-request rule in `AGENTS.md`, a pointer in `docs/index.md`.
- `flow-skills-eval`: two L0 assertions; the frozen-prefix lock re-approved.

Witnesses, each seen red first:

| Witness | Red | Green |
| --- | --- | --- |
| L0: each stage points at Module docs | flow-retro's sentence removed: 1 failed / 9 | 47/47 |
| L0: no flow skill restates the quad | a `model.md` table row appended to flow-common: 1 failed / 9 | 47/47 |
| Module rules from the libraries | scratch contract without `Public surface`: NO-GO by `module-contract-has-surface` | scratch clean |
| Project rules survive | scratch architecture without `Boundary`, index without `Document index`: NO-GO each | scratch clean |
| Scratch project, keyed `check --all` | first run NO-GO: the library's `module-properties-are-claims` and `-current` rejected the placeholder property, which `canon.yaml` never checked; then NEEDS-REVIEW on the model placeholder (p=0.46) | PASS after the `core` example's property and model became checkable statements |
| Scratch project pytest | — | 12 passed |

Not run: the L1 triplets per stage (`vp run eval:full`), because no eval model key
is configured on this machine. They stay a named gap. `tools/rule_quality` was not
run either.

A keyless `check --all --profile draft` on a fresh skeleton is BLOCKED on `main` too
(the spine module's oracles, under #317's coverage rule), so it is not a regression
of this change.

Status: `pending-retro`.
