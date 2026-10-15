# 08 - Module docs convention in the skills

## User inputs

The owner named the module documents as the per-package canon:

> docs/modules/<pkg>/{contract,model,properties}.md yes that's what I mean

The owner stated that some documents sit beside that set rather than inside it:

> language is special doc additional to the triple or quad

The owner stated the order in which a change moves:

> It's actually a design file updates these docs, then the code

The owner asked to formalize the convention in the skills, and named where its rules
already live:

> I'm thinking if we should refine skills to formalize the module docs convention

> and that skill itself provides template doc-verify rules to the module docs quad

> I mean what skills we refine to make the modules doc convnetion formal

The owner accepted this scope: the skills and the project-skeleton template here,
and home.conf's own module documents as a follow-up task.

## Problem statement

The module documents under `docs/modules/<pkg>/` are meant to be each package's
current law, and the order is design → module docs → code. No skill says so, and no
rule applies to a change that never enters the design flow. Only
`skills/project-skeleton` mentions the documents, as a template: a table row, a
worked `core` example and a rule module. The template's design guide says a
decision "folds into `docs/`" after landing, which reverses the order.

The cost is visible in home.conf. Three merges in a row changed doc-verify's code
with no change to `docs/modules/`:
- PR #11 deleted the old evaluator and made `doc-verify/src/kernel/` the only one.
  `docs/modules/language/contract.md` still lists an `evaluate` module, and no
  module document covers the kernel.
- Fix #317 added a coverage record and made an incomplete PASS become BLOCKED.
  `docs/modules/report/` does not mention coverage.
- PR #13 added `core.section_ref`, which the language facts list does not name.

None of the three went through a flow gate: `main` has no design after 04, #13
had no design file, and #11's designs are on another branch. So the convention
has to hold at the pull request, not only inside the design flow.

## Scope - what we touch

The convention, owned by `skills/project-skeleton/SKILL.md`. A module-docs section
defines:
- the quad: contract (public surface and the rules callers rely on), model
  (concepts and state), properties (the claimed `P-<pkg>-NN` ids), verification
  (each id paired with the check that witnesses it, and its limit);
- additional documents beside the quad, such as `language`, which describe a
  language or protocol rather than one package;
- when a package earns its own module;
- the order: a design names the module documents it changes, those documents are
  updated from the design, and then the code follows;
- the two routes a change takes:
  - **design-backed:** the design names the module documents, and the flow gates
    below check them;
  - **no design:** the change does not alter a package's contract, model or
    claimed properties, which is the raft-task-card small-task test. If it does,
    it is not small and needs a design.
- the pull-request rule, which applies on both routes: a pull request that
  changes a package's code carries a `Module docs:` line in its description. The
  line names the module documents it updates, or says `none` with the reason the
  contract is unchanged.

The stage checks, each in the skill that owns the stage, pointing at
project-skeleton instead of restating it:
- `skills/flow-grill-review/SKILL.md`, Draft contract: Scope names the module
  documents the design changes. A draft that changes a package and names none is
  returned to the drafter.
- `skills/flow-common/SKILL.md`, implementation gate: before dispatch, the module
  documents named by the design are updated. The done checklist confirms it.
- `skills/flow-retro/SKILL.md`, closing pass: before `landed`, the module
  documents match what was built. A mismatch is a bounded correction.
- `flow-skills-eval/frozen-prefix.lock.json` is re-approved with
  `vp run lock:update`, because the three flow skills change.

One line each:
- `skills/raft-task-card/SKILL.md`: a design-backed card names its module
  documents next to its design link, and a small-task card states that no
  contract changes, which is already its test.
- `skills/spine-orient/SKILL.md`: for a fact about a package, the module documents
  are the owning document. A landed design is history.
- `skills/finding-triage/SKILL.md`: moving canon includes the module documents.

Template files in `skills/project-skeleton/init/`:
- `design/00-design-file-guide.md`: a design's decision updates `docs/modules`
  before the code that implements it lands.
- `skills/project-skeleton/init/doc-verify/modules/canon.yaml` keeps only its project-level rules, for
  the architecture document and the document index. Its four module rules duplicate the
  engine's `doc-verify:module-*` libraries and are removed. The four
  `docs/modules/*` entries in `.doc-verify.yaml` point at those libraries.
- `skills/project-skeleton/init/AGENTS.md`: the pull-request rule joins the working norms.
  `skills/project-skeleton/init/docs/index.md` gets one line pointing at the convention.
- `docs/modules/core/*`: the worked example follows the section definitions.

Follow-up, not in this design: home.conf applies the convention to its own
documents. That covers an `AGENTS.md` pointer and the pull-request rule, the
`language` contract (no `evaluate` row; `core.section_ref` named), the `report`
coverage record, and a `kernel` module. The spine relations and the kernel module
are written from designs 06 and 07, so they wait for the owner's ruling on
bringing designs 05 to 07 to `main`.

Non-goals:
- Any change to doc-verify's code or its engine libraries.
- A mechanical gate that ties module documents to code paths, or that checks the
  `Module docs:` line. It is a possible follow-up once the written rule has been
  used.
- Checking that a document's prose matches the code's behaviour. That stays with
  the judge-backed `current_not_history` and `pairs_every_property` questions.

## Rationale

The three merges that drifted did not go through the design flow, so a rule
placed only at the flow's stages would not have reached them. The pull request is
the one point every change passes. The `Module docs:` line makes the author decide,
in writing, whether the contract moved, and the reviewer sees that decision next
to the diff. The design flow's stage checks then make sure that, when a design
exists, the documents move before the code and still match after it.

The no-design route reuses raft-task-card's small-task test rather than adding a
second one. A change that alters a contract is not small, so it needs a design.
That puts a bug fix like #317, which changed what a report means, on the
design-backed route.

Each stage check lives in the skill that owns the stage, and the definitions live
once, in project-skeleton. The flow skills point there and do not restate them,
following the one-statement-per-fact rule in spine-orient.

`canon.yaml` keeps its architecture and index rules, because the engine libraries
have nothing equivalent. Only the module rules, which the libraries already
carry, are removed. Two copies of one rule set drift the same way the documents
did.

## Verification design

| Property | Failure witness | Command |
| --- | --- | --- |
| The skeleton states the convention | A scratch project initialized from the skill has no module-docs definition, no pull-request rule in `AGENTS.md`, or a design guide that still folds into `docs/` after landing | `skills/project-skeleton/scripts/init.sh` into a scratch directory, then `grep` the copied files |
| Module rules come from the libraries | A scratch project's module contract without `Public surface` passes, or `canon.yaml` still defines a `module-*` constraint | the skill's validation protocol, steps 1 and 3 |
| Project-level rules survive | A scratch project's architecture document without `Boundary`, or a document index without `Document index`, passes | the skill's validation protocol, step 3, with those two seeds added |
| Each stage carries its check | flow-grill-review's Draft contract, flow-common's implementation gate or flow-retro's closing pass does not mention `docs/modules`, or mentions it without pointing at project-skeleton | a new L0 assertion in `flow-skills-eval/tests/contract-lint.test.ts`, run by `vp test` |
| The flows point, not restate | A flow skill defines the quad itself | the same L0 test asserts no flow skill contains the four definitions |
| Stage behaviour | For each stage, a seeded case (a draft naming no module documents, a dispatch before the documents moved, a retro over a build that drifted from its documents) gets the wrong decision | L1 triplets (canonical, trap, paraphrase) per stage in `flow-skills-eval`, `vp run eval:full`; needs the eval model key |
| Skill packages stay valid | A changed skill fails its package lint, or the frozen-prefix lock is stale | `prek run --all-files` |

Each witness is first observed failing on a seeded defect, as the skeleton's
validation protocol requires. The pull-request rule has no mechanical witness: the
reviewer is its gate, and a mechanical check is a named non-goal.

## Open questions

- **Numbering.** The lowest unused number on `main` is 05, but 05 to 07 exist on
  `dv/trusted-kernel-trials`. This file takes 08 so that bringing those designs to
  `main` causes no collision.

## Goal

This design has no goal file. The owner's request is quoted in User inputs.

## Review

worklog/08-module-docs-convention.md

## Status

pending-retro
