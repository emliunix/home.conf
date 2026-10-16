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

## C5 - Implementation review (2026-10-16)

The Claude seat passed the implementation at `6e7517e` with nothing blocking
(https://github.com/emliunix/home.conf/pull/14#issuecomment-6201395507).

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | should-fix: P-core-01 is paired with `assert True`, and the template ships no `one_function` | Taken, the reviewer's second option. Marking the limit as a placeholder kept failing the judge's `current_not_history` (p=0.56, then 0.47), so the template now ships `src/example.py::one_function` and a test that calls it. Seeded red: a stateful `one_function` fails the test. Scratch pytest 12 passed; keyed `check --all` PASS |
| 2 | note: the restatement test catches table rows, not lists | Recorded; it stays a table-only check |
| 3 | note: L1 triplets and rule_quality not run | The L1 gap blocks `landed`, not the merge; design 08 stays `pending-retro` until they run with the eval key, each seen red first. rule_quality's mutations do not cover the changed rules |
| 4 | note: the status went from draft to pending-retro without `reviewed` | The design passed review at `6e248bd` (C4); the status word recorded there was not committed separately |

## Retrospective (2026-10-16)

Closing pass by Bob on `main` at `f9af433`. Trigger: closing stage; the L1 run is
now possible (design 10).

### First-principles bottom line

**Derivation.** The problem: module documents are meant to be each package's
current law, moved design → module docs → code, but no skill says so and drift
happened on changes that never entered the design flow. The minimal machine: (1)
the convention stated once; (2) a rule at the one point every change passes, the
pull request; (3) a check at each flow stage that moves the documents, pointing at
(1); (4) the template carrying the convention to new projects.

**Diff against the as-built.** (1) `project-skeleton` § Module docs; (2) the
`Module docs:` line in the template `AGENTS.md`; (3) the stage checks in
flow-grill-review, flow-common and flow-retro, held by the L0 tests; (4) the
template's design guide, `canon.yaml` and `.doc-verify.yaml`. The one-liners in
raft-task-card, spine-orient and finding-triage sit on the paths agents read
before a change, which keeps (1) reachable.
- (P0) none.
- (a) the template's `src/example.py::one_function` and its test (C5 finding 1):
  the engine's `module-properties-*` libraries reject a placeholder property, so
  the worked example needs real code to pair with. Constraint: the library rules
  this design moved the template onto.
- (a) `flow-retro` §5 no longer says "a mismatch is a bounded correction", as this
  design's Scope states: design 09 replaced it with "contradiction blocks, other
  mismatch is a follow-up unit". Constraint: design 09's no-direct-edits rule. The
  stage check still exists and still points at project-skeleton, so the row holds.
- (b) none. (c) none.

**Heads.** The Problem statement holds. Scope held. The Rationale survives, with an
observation: the pull-request rule depends on authors using it, and PR #15 (opened
before #14 merged, still open) changes doc-verify's constraint language (`line:`)
with no `Module docs:` line. A mechanical check stays a named non-goal; the
observation goes to the re-close's follow-up file.

### Evidence

- `vp test --run` on `f9af433`: 66/66, including the two L0 assertions of C4.
- `flow-skills-eval/src/eval/cases.ts` has no module-docs case: none of the 43
  case ids covers a draft naming no module documents, a dispatch before the
  documents moved, or a retro over a build that drifted from its documents.
  Design 09 also named this ("its retro-stage L1 case ... is written against this
  design's §5 wording"); it was not written there either.

### Findings and routes

1. **Blocking.** Row "Stage behaviour" is unprovable: its L1 triplets were never
   written, so the command has nothing to run. C4 recorded the run as a gap for want
   of a key; the cases themselves were missing too. Implementation defect.

### Verdict

**3 - route back to implementation.** Status stays `pending-retro`; round 2 of
`flow-common`'s round budget. The round writes three triplets (canonical, trap,
paraphrase) against the merged stage text, each with a quoted `// Cite:` that the
citation check resolves and a tuple that has a `CONSISTENT_TUPLES` row:
- review stage: a draft that changes a package and names no module documents;
- dispatch: implementation about to start before the named documents moved;
- retro: a build that contradicts one of its module documents' rows (blocking) and
  one that mismatches without contradicting (follow-up);
then runs them on both models and triages any miss by design 10's rule. This flow
re-closes afterwards.

## C6 - Implementation round 2 (2026-10-16)

Routed back by the retrospective above. Round 2 of the round budget.

- `flow-skills-eval/src/eval/cases.ts`: nine cases, `module-docs-{review,dispatch,retro}-{canonical,trap,paraphrase}`,
  each with a quoted `// Cite:` the citation test resolves. Expected tuples were
  written before any run: review `remediate, unchanged, design_body` (the drafter
  names the documents in Scope); dispatch and retro `remediate, unchanged,
  module_docs`.
- `decisions.ts`: a `write_target` value `module_docs` ("a package's module
  documents under `docs/modules/`"). The schema could not name a module document
  at all; no existing tuple uses or changes meaning with it. One new
  `CONSISTENT_TUPLES` row; lock re-approved.
- `vp test --run` 66/66, `tsc` clean. Seeded red: a cited fragment altered (1
  failed); the new tuple row dropped (1 failed).

**Seeded skill defects** (the stage's module-docs sentence removed from the skill
the prompt loads, ×3 per model):

| Stage | With the sentence | Without it | Witness? |
| --- | --- | --- | --- |
| dispatch | `write_target: module_docs` on every run | `none` on every run (both models) | yes, on the write target |
| retro | 9/9 both models | 9/9 both models | no: the row test alone ("a failing row blocks") gives the same verdict |
| review (first fixtures) | flash 6/9 | flash 6/9 | no: the fixture said "names no document under `docs/modules/`" |
| review (revised fixtures, hint removed) | `set_status, reviewed` on canonical, both models | the same | the case fails with the rule in place |

The review fixtures were revised once to remove the hint; the expected tuples did
not change. One skill edit was tried and reverted: adding the Scope check to
flow-grill-review §4's GO list did not change either model's canonical answer.

**Graded runs** (`worklog/08-module-docs-convention/round2-*.tsv`): flash 12/27,
pro 15/27.

| Case | D | Reading / evidence |
| --- | --- | --- |
| `module-docs-review-canonical` | 1 | Both models pass the gate (`set_status, reviewed`). Flash's prose: the gate passes and the contract "must be reconciled before implementation". The Draft-contract sentence does not stop a review that has otherwise passed |
| `module-docs-review-trap` | 2 (deferred) | `reject_finding` for "decline the drafter's proposal", the act vocabulary (design 11 unit 1) |
| `module-docs-review-paraphrase` | 1 | Both return the plan but name `module_docs`: they would update the page now, not name it in Scope. Same finding as canonical: the review-stage rule is read as "update the docs", not "the design names them" |
| `module-docs-dispatch-canonical` | 2 (deferred) | flash `implement, …, module_docs`: the write target is right; updating a document from the design reads as implementation. Prose (flash): "update the contract … before writing `src/report.ts`" |
| `module-docs-dispatch-paraphrase` | 2 (deferred) | same, both models; pro's prose says the same |

## Retrospective - re-close after round 2 (2026-10-16)

**Bottom line** unchanged from the first pass; the round changed only the eval.

**Findings and routes.**
1. **Blocking.** Row "Stage behaviour" fails at the review stage: with the merged
   skills, both models pass a review gate on a draft that changes a package and
   names no module document. The dispatch stage is witnessed (seeded red flips the
   write target); its remaining misses are the act vocabulary.
2. **Not blocking.** The retro-stage cases do not witness §5's sentence: the row
   test decides them alone. The part only §5 adds ("any other mismatch is a
   follow-up unit") needs a case that the schema can score once stage and act are
   split (design 11 unit 1).
3. **Not blocking.** PR #15 changes doc-verify's constraint language with no
   `Module docs:` line (observation from the first pass).

**Route for finding 1, open.** Design 08 places the review check in the Draft
contract table, a precondition read before review starts. One wording edit at the
GO list did not help. If the placement is the cause, the design body prescribes it,
and that is verdict 4 (breakout); if the wording is, it is verdict 3 and round 3,
which `flow-common` spends on the brief ("Rewrite the brief much more than the
code"). The choice is put to the owner and the reviewer; status stays
`pending-retro`.

## C7 - Implementation round 3 (2026-10-16)

The PR #19 review (finding 2) showed the round-2 review fixtures sat at the gate
("every accepted P1 is solved"), where `flow-grill-review` says "Nothing more is
required", so passing was a valid reading. Round 3, spent on the instrument as
`flow-common` prescribes for rounds 3–4: the three review fixtures now show a draft
just submitted, before any angle runs, which is the moment the Draft contract
names. Expected tuples unchanged.

Tuple runs (`round3-full-*-x3.tsv`, the whole corpus, also owed for the
`module_docs` value):

| Case | flash | pro | Prose probe (`probe-review-round3.md`, case's own question) |
| --- | --- | --- | --- |
| `module-docs-review-canonical` | 0/3 `implement, …, none` | 0/3 `reject_finding, …, none` | both miss: flash "run the P0 check first", pro "the draft satisfies the Draft contract" |
| `module-docs-review-trap` | 3/3 | 0/3 `reject_finding` | both return the draft to the drafter |
| `module-docs-review-paraphrase` | 0/3 `implement` | 0/3 `reject_finding` | pro returns the draft; flash names the gap but sends it into review |

Dispositions: canonical **1** (both models, probe agrees with the tool); trap pro
and paraphrase pro **2 (deferred)**, "return the draft" read as `reject_finding`
(design 11 unit 1); paraphrase flash **1, unconfirmed** (its prose names the gap).
When the fixture's drafter mentions the documents, both models apply the rule;
when nothing points at them, neither does.

**The 43 older cases after the `module_docs` value:** flash 105/126 (103 at
design 10's final), pro 91/126 (98). No older case answered `module_docs`. Pro's
drops are `run_retro` / `reject_finding` answers (`gate-pending-landed-canonical`,
`fork-retro-p0-paraphrase`, `fork-p0-violation-trap`, `gate-reviewed-pending-trap`
2/3), the stage-vs-act class, not the new value.

## Retrospective - re-close after round 3 (2026-10-16)

**Finding 1, re-measured.** At the moment design 08 specified, both models take a
draft that changes a package and names no module document into review unless the
fixture points at the documents. The probe agrees with the tool run, so this is a
skill finding, not the instrument. Three wordings of the rule were tried in round
2 and round 3's experiments (the Draft contract as merged, the GO list, a P1 at
item 0); none changed it.

**Verdict proposed: 4 - breakout**, for the owner as manager to rule. The design
prescribes the check as reviewer judgement only, and names a mechanical gate as a
non-goal; the evidence says judgement alone does not catch the omission. The
candidate correction is the conditional section the owner-forwarded survey of
document rules describes (Scope must name `docs/modules/<pkg>/` when it names that
package's code), decided from a deterministic fact. Status stays `pending-retro`
until the owner rules; on breakout the manager reverts design 08 to `draft`.
